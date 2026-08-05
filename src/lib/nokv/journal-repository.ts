import 'server-only';

import { randomUUID } from 'node:crypto';
import { callWorkbenchTool, isNokvEnabled, NokvToolError } from './mcp-client';
import { collectBlob, materializeBlob } from './blob-cli';
import {
  buildBlock,
  extractBlock,
  parseDoc,
  serializeDoc,
  type JsonValue
} from './journal-doc';
import {
  foldLedger,
  ledgerShardPath,
  newEventId,
  serializeEvent,
  type FoldedState,
  type LedgerEvent
} from './ledger';
import { getLocalDayRange } from '@/lib/timezone';
import {
  NokvUnavailableError,
  type DailySummary,
  type DayBundle,
  type EntryStats,
  type JournalDataRepository,
  type JournalEntry,
  type MoodEntry,
  type PeriodReflection,
  type PeriodType,
  type YmdString
} from '@/lib/data/repository';

// NoKV journal backend (design: docs/nokv-data-migration-design.md).
// One long-lived workbench per user: jr-{clerkUserId}.
//   outputs/days/{date}.json           day document (mood ⊕ summary ⊕ reflection)
//   outputs/entries/{date}/{id}.json   per-entry document (audio meta ⊕ transcript)
//   outputs/text/{date}/summary.txt    keyword-search sidecar (derived, LWW)
//   outputs/reflections/{type}/{start}.json
//   input/audio/{date}/{id}.webm       blob via the CLI channel
//   logs/ledger/{YYYY-MM}.jsonl        derived event ledger (folded read model)
//   metadata/latches/...               create-only edit-protection latches
// jr-* workbenches are NEVER committed/snapshotted (tombstone GC depends on it).

const WB_ID_RE = /^[A-Za-z0-9_-]+$/;
const ENTRY_ID_RE = /^e(\d{4})(\d{2})(\d{2})T\d{6}-[0-9a-f]{8}$/;
const DOC_TIMEOUT_MS = 15_000;
const SCAN_TIMEOUT_MS = 10_000;
const MAX_DOC_BYTES = 4 * 1024 * 1024;

const ALLOWED_TOOLS = new Set([
  'workbench_create',
  'workbench_put_file',
  'workbench_append',
  'workbench_read',
  'workbench_list',
  'workbench_grep',
  'workbench_edit',
  'workbench_stat'
]);

interface DayDoc {
  schema: string;
  user_id: string;
  date: string;
  tz: string;
  mood: {
    day_quality: string;
    emotions: string[];
    created_at: string;
    updated_at: string;
    legacy_id?: string | null;
  } | null;
  summary: {
    text: string;
    entry_count: number;
    mood_quality: string | null;
    dominant_emotions: string[];
    generated_at: string;
    updated_at: string;
  } | null;
  reflection: {
    achievements: string[];
    commitments: string[];
    mood_overall: string | null;
    mood_reason: string | null;
    flashback: string | null;
    stats: Record<string, JsonValue> | null;
    gen_version: string | null;
    edited: boolean;
    last_generated_at: string | null;
    legacy_id?: string | null;
  } | null;
}

interface EntryDoc {
  schema: string;
  id: string;
  legacy_audio_id: string | null;
  user_id: string;
  date: string;
  created_at: string;
  audio: {
    path: string;
    mime_type: string;
    size_bytes: number;
    duration_ms: number | null;
    deleted: boolean;
  };
  transcript: {
    text: string;
    rephrased_text: string | null;
    language: string | null;
    updated_at: string;
  };
}

interface ReflectionDoc {
  schema: string;
  id: string;
  legacy_id: string | null;
  user_id: string;
  period_type: string;
  period_start: string;
  period_end: string;
  achievements: string[];
  commitments: string[];
  mood_overall: string | null;
  mood_reason: string | null;
  flashback: string | null;
  stats: Record<string, JsonValue> | null;
  edited: boolean;
  gen_version: string | null;
  last_generated_at: string | null;
  updated_at: string | null;
}

const isPathExists = (err: unknown) =>
  err instanceof NokvToolError &&
  /path.?exists|already.?exists/i.test(err.message);
const isNotFound = (err: unknown) =>
  err instanceof NokvToolError && /not.?found/i.test(err.message);
const isRetryable = (err: unknown) =>
  err instanceof NokvToolError &&
  /generation|conflict|precondition|no match|mismatch|stale/i.test(err.message);

function tzName(): string {
  return process.env.APP_TIMEZONE ?? 'Australia/Sydney';
}

function entryDateFromId(entryId: string): YmdString | null {
  const m = ENTRY_ID_RE.exec(entryId);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Tolerant extraction across MCP structured-content encodings. */
function firstRecord(res: unknown): unknown {
  if (res == null) return null;
  const r = res as Record<string, unknown>;
  const records = (r.records ?? r.items ?? r.entries) as unknown[] | undefined;
  if (Array.isArray(records)) return records[0] ?? null;
  return res;
}

function recordToDoc<T>(record: unknown): T | null {
  if (record == null) return null;
  if (typeof record === 'string') return parseDoc<T>(record);
  const r = record as Record<string, unknown>;
  if (typeof r.text === 'string') return parseDoc<T>(r.text);
  if (r.json && typeof r.json === 'object') return r.json as T;
  if (r.schema) return record as T;
  return record as T;
}

function textLines(res: unknown): string[] {
  if (res == null) return [];
  const r = res as Record<string, unknown>;
  const records = (r.records ?? r.text_lines ?? r.lines) as
    | unknown[]
    | undefined;
  if (!Array.isArray(records)) {
    return typeof r.text === 'string' ? r.text.split('\n') : [];
  }
  return records.map((rec) => {
    if (typeof rec === 'string') return rec;
    const rr = rec as Record<string, unknown>;
    return typeof rr.text === 'string' ? rr.text : JSON.stringify(rec);
  });
}

function listNames(res: unknown): string[] {
  if (res == null) return [];
  const r = res as Record<string, unknown>;
  const items = (r.entries ?? r.records ?? r.items ?? r.paths) as
    | unknown[]
    | undefined;
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => {
      if (typeof it === 'string') return it;
      const rr = it as Record<string, unknown>;
      return (rr.path ?? rr.name ?? '') as string;
    })
    .filter(Boolean);
}

interface FoldCache {
  at: number;
  state: FoldedState;
}

export class NokvJournalRepository implements JournalDataRepository {
  private ensuredWorkbenches = new Set<string>();
  private foldCache = new Map<string, FoldCache>();
  private deletedCache = new Map<string, { at: number; deleted: boolean }>();

  // ── plumbing ──────────────────────────────────────────────────────

  private wbId(userId: string): string {
    const id = `jr-${userId}`;
    if (!isNokvEnabled() || !WB_ID_RE.test(id) || id.length > 128) {
      throw new NokvUnavailableError(
        'NoKV backend disabled or user id not representable'
      );
    }
    return id;
  }

  private async call(
    name: string,
    args: Record<string, unknown>,
    timeoutMs = DOC_TIMEOUT_MS
  ): Promise<unknown> {
    if (!ALLOWED_TOOLS.has(name)) {
      throw new Error(`tool ${name} is not allowed on journal workbenches`);
    }
    const res = await callWorkbenchTool(name, args, { timeoutMs });
    if (res === null) {
      throw new NokvUnavailableError(`nokv transport unavailable for ${name}`);
    }
    return res;
  }

  private async ensureWorkbench(userId: string): Promise<string> {
    const id = this.wbId(userId);
    if (this.ensuredWorkbenches.has(id)) return id;
    try {
      await this.call('workbench_create', { id });
    } catch (err) {
      if (!isPathExists(err)) throw err;
    }
    this.ensuredWorkbenches.add(id);
    return id;
  }

  private async readDocAt<T>(
    wb: string,
    section: string,
    path: string
  ): Promise<T | null> {
    try {
      const res = await this.call('workbench_read', {
        id: wb,
        section,
        path,
        format: 'structured'
      });
      return recordToDoc<T>(firstRecord(res));
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  private async putDoc(
    wb: string,
    section: string,
    path: string,
    doc: Record<string, JsonValue>,
    opts?: { replace?: boolean; contentType?: string }
  ): Promise<void> {
    const text = serializeDoc(doc);
    if (Buffer.byteLength(text) > MAX_DOC_BYTES) {
      throw new Error(`document too large for ${section}/${path}`);
    }
    await this.call('workbench_put_file', {
      id: wb,
      section,
      path,
      text,
      content_type: opts?.contentType ?? 'application/json',
      replace: opts?.replace ?? false
    });
  }

  /** Block-level optimistic edit on a day/entry document. NEVER falls back to
   *  whole-document replace (that would be a silent-lost-update hole). */
  private async editBlock<T extends Record<string, JsonValue>>(
    wb: string,
    section: string,
    path: string,
    key: string,
    nextValue: JsonValue
  ): Promise<T> {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const doc = await this.readDocAt<T>(wb, section, path);
      if (!doc) throw new NokvToolError(`NotFound: ${section}/${path}`);
      const raw = serializeDoc(doc);
      const oldBlock = extractBlock(raw, key);
      if (!oldBlock) throw new Error(`block ${key} missing in ${path}`);
      const newBlock = buildBlock(key, nextValue);
      if (oldBlock === newBlock) return doc;
      try {
        await this.call('workbench_edit', {
          id: wb,
          section,
          path,
          old_string: oldBlock,
          new_string: newBlock
        });
        const updated = { ...doc, [key]: nextValue } as T;
        return updated;
      } catch (err) {
        lastErr = err;
        if (isRetryable(err)) continue;
        throw err;
      }
    }
    throw lastErr ?? new Error(`editBlock exhausted retries for ${key}`);
  }

  private async appendLedger(wb: string, event: LedgerEvent): Promise<void> {
    const args = {
      id: wb,
      section: 'logs',
      path: ledgerShardPath(event.date),
      text: serializeEvent(event),
      content_type: 'text/plain'
    };
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.call('workbench_append', args, SCAN_TIMEOUT_MS);
        return;
      } catch (err) {
        if (isRetryable(err) && attempt < 2) continue;
        // Derived read model: log and move on, reconcile can rebuild.
        // eslint-disable-next-line no-console
        console.error('[nokv] ledger append failed', err);
        return;
      }
    }
  }

  private async latch(wb: string, path: string): Promise<void> {
    try {
      await this.call('workbench_put_file', {
        id: wb,
        section: 'metadata',
        path,
        text: '',
        replace: false
      });
    } catch (err) {
      if (!isPathExists(err)) throw err;
    }
  }

  private async latchExists(wb: string, path: string): Promise<boolean> {
    try {
      await this.call('workbench_stat', {
        id: wb,
        section: 'metadata',
        path
      });
      return true;
    } catch (err) {
      if (isNotFound(err)) return false;
      throw err;
    }
  }

  private async isUserDeleted(userId: string): Promise<boolean> {
    const cached = this.deletedCache.get(userId);
    if (cached && Date.now() - cached.at < 60_000) return cached.deleted;
    const wb = await this.ensureWorkbench(userId);
    const marker = await this.readDocAt(wb, 'metadata', 'deleted.json');
    const deleted = marker != null;
    this.deletedCache.set(userId, { at: Date.now(), deleted });
    return deleted;
  }

  private daySkeleton(
    userId: string,
    date: YmdString
  ): Record<string, JsonValue> {
    return {
      schema: 'echojournal.day.v1',
      user_id: userId,
      date,
      tz: tzName(),
      mood: null,
      summary: null,
      reflection: null
    };
  }

  private async ensureDayDoc(
    wb: string,
    userId: string,
    date: YmdString,
    withBlocks?: Partial<Record<'mood' | 'summary' | 'reflection', JsonValue>>
  ): Promise<'created' | 'exists'> {
    const skeleton = { ...this.daySkeleton(userId, date), ...withBlocks };
    try {
      await this.putDoc(wb, 'outputs', `days/${date}.json`, skeleton);
      return 'created';
    } catch (err) {
      if (isPathExists(err)) return 'exists';
      throw err;
    }
  }

  private async readDay(wb: string, date: YmdString): Promise<DayDoc | null> {
    return this.readDocAt<DayDoc>(wb, 'outputs', `days/${date}.json`);
  }

  private async foldState(userId: string): Promise<FoldedState> {
    const cached = this.foldCache.get(userId);
    if (cached && Date.now() - cached.at < 5_000) return cached.state;

    const wb = await this.ensureWorkbench(userId);
    let shardNames: string[] = [];
    try {
      const res = await this.call(
        'workbench_list',
        { id: wb, section: 'logs', path: 'ledger/', limit: 100 },
        SCAN_TIMEOUT_MS
      );
      shardNames = listNames(res);
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }

    const state: FoldedState = { byDate: new Map() };
    for (const name of shardNames.sort()) {
      const rel = name.includes('/')
        ? name.slice(name.lastIndexOf('ledger/'))
        : `ledger/${name}`;
      try {
        const res = await this.call(
          'workbench_read',
          { id: wb, section: 'logs', path: rel, format: 'structured' },
          SCAN_TIMEOUT_MS
        );
        foldLedger(textLines(res), state);
        let cursor = (res as Record<string, unknown>)?.cursor as
          | string
          | undefined;
        while (cursor) {
          const page = await this.call(
            'workbench_read',
            {
              id: wb,
              section: 'logs',
              path: rel,
              format: 'structured',
              cursor
            },
            SCAN_TIMEOUT_MS
          );
          foldLedger(textLines(page), state);
          cursor = (page as Record<string, unknown>)?.cursor as
            | string
            | undefined;
        }
      } catch (err) {
        if (!isNotFound(err)) throw err;
      }
    }

    this.foldCache.set(userId, { at: Date.now(), state });
    return state;
  }

  private invalidateFold(userId: string): void {
    this.foldCache.delete(userId);
  }

  // ── projections ───────────────────────────────────────────────────

  private moodFromDay(day: DayDoc | null): MoodEntry | null {
    if (!day?.mood) return null;
    return {
      id: day.mood.legacy_id ?? `mood:${day.date}`,
      date: day.date,
      day_quality: day.mood.day_quality,
      emotions: day.mood.emotions ?? [],
      created_at: day.mood.created_at,
      updated_at: day.mood.updated_at
    };
  }

  private summaryFromDay(
    userId: string,
    day: DayDoc | null
  ): DailySummary | null {
    if (!day?.summary) return null;
    const r = day.reflection;
    return {
      id: r?.legacy_id ?? `daily:${day.date}`,
      user_id: userId,
      date: day.date,
      summary: day.summary.text,
      entry_count: day.summary.entry_count,
      mood_quality: day.summary.mood_quality,
      dominant_emotions: day.summary.dominant_emotions ?? [],
      mood_overall: r?.mood_overall ?? null,
      mood_reason: r?.mood_reason ?? null,
      achievements: r?.achievements ?? null,
      commitments: r?.commitments ?? null,
      flashback: r?.flashback ?? null,
      stats: r?.stats ?? null,
      gen_version: r?.gen_version ?? null,
      edited: r?.edited ?? false,
      created_at: day.summary.generated_at,
      updated_at: day.summary.updated_at,
      last_generated_at: r?.last_generated_at ?? null
    };
  }

  private entryFromDoc(doc: EntryDoc): JournalEntry {
    return {
      id: doc.id,
      legacy_audio_id: doc.legacy_audio_id,
      date: doc.date,
      created_at: doc.created_at,
      audio: {
        mime_type: doc.audio.mime_type,
        size_bytes: doc.audio.size_bytes,
        duration_ms: doc.audio.duration_ms,
        deleted: doc.audio.deleted
      },
      transcript: {
        text: doc.transcript.text,
        rephrased_text: doc.transcript.rephrased_text,
        language: doc.transcript.language,
        updated_at: doc.transcript.updated_at
      }
    };
  }

  private reflectionFromDoc(doc: ReflectionDoc): PeriodReflection {
    return {
      id: doc.legacy_id ?? doc.id,
      user_id: doc.user_id,
      period_type: doc.period_type,
      period_start: doc.period_start,
      period_end: doc.period_end,
      mood_overall: doc.mood_overall,
      mood_reason: doc.mood_reason,
      achievements: doc.achievements,
      commitments: doc.commitments,
      flashback: doc.flashback,
      stats: doc.stats,
      gen_version: doc.gen_version,
      edited: doc.edited,
      created_at: doc.updated_at,
      updated_at: doc.updated_at,
      last_generated_at: doc.last_generated_at
    };
  }

  private async resolveEntryLocator(
    wb: string,
    entryId: string
  ): Promise<{ date: YmdString; id: string } | null> {
    const date = entryDateFromId(entryId);
    if (date) return { date, id: entryId };
    // Legacy Supabase uuid.
    const legacy = await this.readDocAt<{
      audio?: Record<string, { date: string; entry_id: string }>;
    }>(wb, 'metadata', 'legacy_ids.json');
    const hit = legacy?.audio?.[entryId];
    return hit ? { date: hit.date, id: hit.entry_id } : null;
  }

  // ── mood ──────────────────────────────────────────────────────────

  async getMood(userId: string, date: YmdString): Promise<MoodEntry | null> {
    if (await this.isUserDeleted(userId)) return null;
    const wb = await this.ensureWorkbench(userId);
    return this.moodFromDay(await this.readDay(wb, date));
  }

  async upsertMood(
    userId: string,
    date: YmdString,
    input: { dayQuality: string; emotions: string[] }
  ): Promise<MoodEntry> {
    const wb = await this.ensureWorkbench(userId);
    const now = new Date().toISOString();
    const existing = await this.readDay(wb, date);
    const moodBlock = {
      day_quality: input.dayQuality,
      emotions: input.emotions,
      created_at: existing?.mood?.created_at ?? now,
      updated_at: now
    };

    if (!existing) {
      const created = await this.ensureDayDoc(wb, userId, date, {
        mood: moodBlock
      });
      if (created === 'exists') {
        await this.editBlock<Record<string, JsonValue>>(
          wb,
          'outputs',
          `days/${date}.json`,
          'mood',
          moodBlock
        );
      }
    } else {
      await this.editBlock<Record<string, JsonValue>>(
        wb,
        'outputs',
        `days/${date}.json`,
        'mood',
        moodBlock
      );
    }

    await this.appendLedger(wb, {
      v: 1,
      event_id: newEventId(),
      ts: now,
      kind: 'mood_set',
      date,
      day_quality: input.dayQuality,
      emotions: input.emotions
    });
    this.invalidateFold(userId);

    return {
      id: `mood:${date}`,
      date,
      day_quality: input.dayQuality,
      emotions: input.emotions,
      created_at: moodBlock.created_at,
      updated_at: now
    };
  }

  async listMoodsInRange(
    userId: string,
    start: YmdString,
    end: YmdString
  ): Promise<MoodEntry[]> {
    if (await this.isUserDeleted(userId)) return [];
    const state = await this.foldState(userId);
    const wb = await this.ensureWorkbench(userId);
    const dates = [...state.byDate.keys()]
      .filter((d) => d >= start && d <= end && state.byDate.get(d)?.mood)
      .sort();
    const moods: MoodEntry[] = [];
    for (const d of dates) {
      const mood = this.moodFromDay(await this.readDay(wb, d));
      if (mood) moods.push(mood);
    }
    return moods;
  }

  // ── journal entries ───────────────────────────────────────────────

  async createEntry(
    userId: string,
    input: {
      audio: Buffer;
      mimeType: string;
      transcript: string;
      rephrasedText: string | null;
      language: string;
    }
  ): Promise<JournalEntry> {
    const wb = await this.ensureWorkbench(userId);
    const now = new Date();
    const nowIso = now.toISOString();
    const { date } = getLocalDayRange({ date: now });
    const compact = date.replaceAll('-', '');
    const hhmmss = nowIso.slice(11, 19).replaceAll(':', '');
    const entryId = `e${compact}T${hhmmss}-${randomUUID().slice(0, 8)}`;
    const audioPath = `audio/${date}/${entryId}.webm`;

    await collectBlob(wb, 'input', audioPath, input.audio, input.mimeType);

    const doc: EntryDoc = {
      schema: 'echojournal.entry.v1',
      id: entryId,
      legacy_audio_id: null,
      user_id: userId,
      date,
      created_at: nowIso,
      audio: {
        path: audioPath,
        mime_type: input.mimeType,
        size_bytes: input.audio.byteLength,
        deleted: false,
        duration_ms: null
      },
      transcript: {
        text: input.transcript,
        rephrased_text: input.rephrasedText,
        language: input.language,
        updated_at: nowIso
      }
    };
    await this.putDoc(
      wb,
      'outputs',
      `entries/${date}/${entryId}.json`,
      doc as unknown as Record<string, JsonValue>
    );
    await this.ensureDayDoc(wb, userId, date);
    await this.appendLedger(wb, {
      v: 1,
      event_id: newEventId(),
      ts: nowIso,
      kind: 'entry_created',
      date,
      entry_id: entryId
    });
    this.invalidateFold(userId);

    return this.entryFromDoc(doc);
  }

  async getEntry(
    userId: string,
    entryId: string
  ): Promise<JournalEntry | null> {
    if (await this.isUserDeleted(userId)) return null;
    const wb = await this.ensureWorkbench(userId);
    const loc = await this.resolveEntryLocator(wb, entryId);
    if (!loc) return null;
    const doc = await this.readDocAt<EntryDoc>(
      wb,
      'outputs',
      `entries/${loc.date}/${loc.id}.json`
    );
    if (!doc || doc.user_id !== userId || doc.audio.deleted) return null;
    return this.entryFromDoc(doc);
  }

  async getAudioBlob(
    userId: string,
    entryId: string
  ): Promise<{ data: Buffer; mimeType: string } | null> {
    if (await this.isUserDeleted(userId)) return null;
    const wb = await this.ensureWorkbench(userId);
    const loc = await this.resolveEntryLocator(wb, entryId);
    if (!loc) return null;
    const doc = await this.readDocAt<EntryDoc>(
      wb,
      'outputs',
      `entries/${loc.date}/${loc.id}.json`
    );
    if (!doc || doc.audio.deleted) return null;
    const data = await materializeBlob(wb, 'input', doc.audio.path);
    if (!data || data.byteLength === 0) return null;
    return { data, mimeType: doc.audio.mime_type };
  }

  async updateRephrasedText(
    userId: string,
    entryId: string,
    text: string
  ): Promise<JournalEntry> {
    const wb = await this.ensureWorkbench(userId);
    const loc = await this.resolveEntryLocator(wb, entryId);
    if (!loc) throw new Error('Entry not found');
    const path = `entries/${loc.date}/${loc.id}.json`;
    const current = await this.readDocAt<EntryDoc>(wb, 'outputs', path);
    if (!current) throw new Error('Entry not found');
    const updated = await this.editBlock<Record<string, JsonValue>>(
      wb,
      'outputs',
      path,
      'transcript',
      {
        ...current.transcript,
        rephrased_text: text,
        updated_at: new Date().toISOString()
      } as unknown as JsonValue
    );
    return this.entryFromDoc(updated as unknown as EntryDoc);
  }

  async deleteEntry(userId: string, entryId: string): Promise<void> {
    const wb = await this.ensureWorkbench(userId);
    const loc = await this.resolveEntryLocator(wb, entryId);
    if (!loc) return;
    const path = `entries/${loc.date}/${loc.id}.json`;
    const current = await this.readDocAt<EntryDoc>(wb, 'outputs', path);
    if (!current || current.audio.deleted) return;

    await this.editBlock<Record<string, JsonValue>>(
      wb,
      'outputs',
      path,
      'audio',
      {
        ...current.audio,
        deleted: true
      } as unknown as JsonValue
    );
    // Tombstone the blob: zero bytes -> revision GC physically deletes S3 data.
    await this.call('workbench_put_file', {
      id: wb,
      section: 'input',
      path: current.audio.path,
      text: '',
      replace: true
    });
    await this.appendLedger(wb, {
      v: 1,
      event_id: newEventId(),
      ts: new Date().toISOString(),
      kind: 'entry_deleted',
      date: loc.date,
      entry_id: loc.id
    });
    this.invalidateFold(userId);
  }

  async listEntriesForDay(
    userId: string,
    date: YmdString
  ): Promise<JournalEntry[]> {
    if (await this.isUserDeleted(userId)) return [];
    const wb = await this.ensureWorkbench(userId);
    let names: string[] = [];
    try {
      const res = await this.call(
        'workbench_list',
        { id: wb, section: 'outputs', path: `entries/${date}/`, limit: 100 },
        SCAN_TIMEOUT_MS
      );
      names = listNames(res);
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }

    const entries: JournalEntry[] = [];
    for (const name of names.sort()) {
      const base = name.slice(name.lastIndexOf('/') + 1);
      const doc = await this.readDocAt<EntryDoc>(
        wb,
        'outputs',
        `entries/${date}/${base}`
      );
      if (doc && !doc.audio.deleted) entries.push(this.entryFromDoc(doc));
    }
    return entries;
  }

  async getEntryStats(userId: string): Promise<EntryStats> {
    if (await this.isUserDeleted(userId)) {
      return { totalEntries: 0, thisWeekEntries: 0, currentStreak: 0 };
    }
    const state = await this.foldState(userId);

    let totalEntries = 0;
    for (const day of state.byDate.values()) {
      totalEntries += day.liveEntryIds.size;
    }

    // Same week definition as the Supabase implementation: local Sunday start.
    const weekDates = new Set<string>();
    const cursor = new Date();
    for (let i = 0; i <= cursor.getDay(); i++) {
      const d = new Date(cursor);
      d.setDate(d.getDate() - i);
      weekDates.add(getLocalDayRange({ date: d }).date);
    }
    let thisWeekEntries = 0;
    for (const date of weekDates) {
      thisWeekEntries += state.byDate.get(date)?.liveEntryIds.size ?? 0;
    }

    let currentStreak = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = getLocalDayRange({ date: d }).date;
      if ((state.byDate.get(date)?.liveEntryIds.size ?? 0) > 0) {
        currentStreak++;
      } else {
        break;
      }
    }

    return { totalEntries, thisWeekEntries, currentStreak };
  }

  // ── daily summaries ───────────────────────────────────────────────

  async getDailySummary(
    userId: string,
    date: YmdString
  ): Promise<DailySummary | null> {
    if (await this.isUserDeleted(userId)) return null;
    const wb = await this.ensureWorkbench(userId);
    return this.summaryFromDay(userId, await this.readDay(wb, date));
  }

  async upsertDailySummary(
    userId: string,
    date: YmdString,
    fields: {
      summary: string;
      entryCount: number;
      moodQuality: string | null;
      dominantEmotions: string[];
    }
  ): Promise<DailySummary> {
    const wb = await this.ensureWorkbench(userId);
    const now = new Date().toISOString();
    const existing = await this.readDay(wb, date);
    const summaryBlock = {
      text: fields.summary,
      entry_count: fields.entryCount,
      mood_quality: fields.moodQuality,
      dominant_emotions: fields.dominantEmotions,
      generated_at: existing?.summary?.generated_at ?? now,
      updated_at: now
    };

    if (!existing) {
      const created = await this.ensureDayDoc(wb, userId, date, {
        summary: summaryBlock
      });
      if (created === 'exists') {
        await this.editBlock(
          wb,
          'outputs',
          `days/${date}.json`,
          'summary',
          summaryBlock
        );
      }
    } else {
      await this.editBlock(
        wb,
        'outputs',
        `days/${date}.json`,
        'summary',
        summaryBlock
      );
    }

    // Keyword sidecar (derived, replace-on-write is safe).
    await this.call('workbench_put_file', {
      id: wb,
      section: 'outputs',
      path: `text/${date}/summary.txt`,
      text: fields.summary,
      content_type: 'text/plain',
      replace: true
    });
    await this.appendLedger(wb, {
      v: 1,
      event_id: newEventId(),
      ts: now,
      kind: 'summary_written',
      date,
      mood_quality: fields.moodQuality,
      entry_count: fields.entryCount
    });
    this.invalidateFold(userId);

    const day = await this.readDay(wb, date);
    const projected = this.summaryFromDay(userId, day);
    if (!projected) throw new Error('summary projection failed after upsert');
    return projected;
  }

  async updateDailySummaryReflection(
    userId: string,
    date: YmdString,
    patch: Partial<
      Pick<
        DailySummary,
        | 'achievements'
        | 'commitments'
        | 'mood_overall'
        | 'mood_reason'
        | 'flashback'
        | 'stats'
        | 'gen_version'
        | 'last_generated_at'
      >
    >,
    opts: { markEdited?: boolean; preserveIfEdited?: boolean }
  ): Promise<DailySummary> {
    const wb = await this.ensureWorkbench(userId);
    const latchPath = `latches/day-${date}.edited`;
    const day = await this.readDay(wb, date);
    if (!day) throw new Error(`No daily summary for ${date}`);

    if (opts.markEdited) {
      // Create-only latch makes edit protection a hard guarantee.
      await this.latch(wb, latchPath);
    }

    const edited = opts.markEdited
      ? true
      : await this.latchExists(wb, latchPath);
    const preserveUserFields = Boolean(opts.preserveIfEdited && edited);

    const current = day.reflection ?? {
      achievements: [],
      commitments: [],
      mood_overall: null,
      mood_reason: null,
      flashback: null,
      stats: null,
      gen_version: null,
      edited: false,
      last_generated_at: null
    };

    const next = { ...current, edited } as Record<string, JsonValue>;
    const userFields = new Set([
      'achievements',
      'commitments',
      'mood_overall',
      'mood_reason',
      'flashback'
    ]);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      if (preserveUserFields && userFields.has(k)) continue;
      next[k] = v as JsonValue;
    }

    await this.editBlock(
      wb,
      'outputs',
      `days/${date}.json`,
      'reflection',
      next
    );
    const updated = await this.readDay(wb, date);
    const projected = this.summaryFromDay(userId, updated);
    if (!projected) throw new Error('summary projection failed after update');
    return projected;
  }

  async listDailySummaries(
    userId: string,
    opts: { before?: YmdString; limit: number }
  ): Promise<DailySummary[]> {
    if (await this.isUserDeleted(userId)) return [];
    const state = await this.foldState(userId);
    const wb = await this.ensureWorkbench(userId);
    const dates = [...state.byDate.entries()]
      .filter(([d, day]) => day.summary && (!opts.before || d <= opts.before))
      .map(([d]) => d)
      .sort()
      .reverse()
      .slice(0, opts.limit);
    const out: DailySummary[] = [];
    for (const d of dates) {
      const s = this.summaryFromDay(userId, await this.readDay(wb, d));
      if (s) out.push(s);
    }
    return out;
  }

  async listDailySummariesInRange(
    userId: string,
    start: YmdString,
    end: YmdString
  ): Promise<DailySummary[]> {
    if (await this.isUserDeleted(userId)) return [];
    const state = await this.foldState(userId);
    const wb = await this.ensureWorkbench(userId);
    const dates = [...state.byDate.entries()]
      .filter(([d, day]) => day.summary && d >= start && d <= end)
      .map(([d]) => d)
      .sort();
    const out: DailySummary[] = [];
    for (const d of dates) {
      const s = this.summaryFromDay(userId, await this.readDay(wb, d));
      if (s) out.push(s);
    }
    return out;
  }

  async queryJournalDays(
    userId: string,
    filters: {
      startDate?: YmdString;
      endDate?: YmdString;
      moods?: string[];
      keyword?: string;
      page: number;
      limit: number;
    }
  ): Promise<{ days: DayBundle[]; totalCount: number }> {
    if (await this.isUserDeleted(userId)) return { days: [], totalCount: 0 };
    const state = await this.foldState(userId);
    const wb = await this.ensureWorkbench(userId);

    // Base set: dates with a summary (exactly the Supabase daily_summaries rows).
    let dates = [...state.byDate.entries()]
      .filter(([, day]) => day.summary)
      .map(([d]) => d);
    if (filters.startDate) dates = dates.filter((d) => d >= filters.startDate!);
    if (filters.endDate) dates = dates.filter((d) => d <= filters.endDate!);
    if (filters.moods && filters.moods.length > 0) {
      const moods = new Set(filters.moods);
      dates = dates.filter((d) => {
        const mq = state.byDate.get(d)?.summary?.mood_quality;
        return mq != null && moods.has(mq);
      });
    }
    if (filters.keyword) {
      const hits = await this.grepSummaryDates(wb, filters.keyword);
      dates = dates.filter((d) => hits.has(d));
    }

    dates.sort().reverse();
    const totalCount = dates.length;
    const offset = (filters.page - 1) * filters.limit;
    const pageDates = dates.slice(offset, offset + filters.limit);

    const days: DayBundle[] = [];
    for (const d of pageDates) {
      const day = await this.readDay(wb, d);
      days.push({
        date: d,
        summary: this.summaryFromDay(userId, day),
        mood: this.moodFromDay(day),
        entries: await this.listEntriesForDay(userId, d)
      });
    }
    return { days, totalCount };
  }

  private async grepSummaryDates(
    wb: string,
    keyword: string
  ): Promise<Set<string>> {
    const hits = new Set<string>();
    let cursor: string | undefined;
    do {
      const res = (await this.call(
        'workbench_grep',
        {
          id: wb,
          pattern: keyword,
          recursive: true,
          section: 'outputs',
          path: 'text/',
          glob: 'summary.txt',
          limit: 300,
          ...(cursor ? { cursor } : {})
        },
        SCAN_TIMEOUT_MS
      )) as Record<string, unknown>;
      const matches = (res.matches ??
        res.records ??
        res.items ??
        []) as unknown[];
      for (const m of matches) {
        const path =
          typeof m === 'string'
            ? m
            : (((m as Record<string, unknown>).path as string) ?? '');
        // Full path carries the section prefix: outputs/text/{date}/summary.txt
        const match = /text\/(\d{4}-\d{2}-\d{2})\/summary\.txt/.exec(path);
        if (match) hits.add(match[1]);
      }
      cursor = res.cursor as string | undefined;
    } while (cursor);
    return hits;
  }

  // ── period reflections ────────────────────────────────────────────

  private reflectionPath(type: PeriodType, periodStart: YmdString): string {
    return `reflections/${type}/${periodStart}.json`;
  }

  async getPeriodReflection(
    userId: string,
    type: PeriodType,
    periodStart: YmdString
  ): Promise<PeriodReflection | null> {
    if (await this.isUserDeleted(userId)) return null;
    const wb = await this.ensureWorkbench(userId);
    const doc = await this.readDocAt<ReflectionDoc>(
      wb,
      'outputs',
      this.reflectionPath(type, periodStart)
    );
    return doc ? this.reflectionFromDoc(doc) : null;
  }

  async getPeriodReflectionById(
    userId: string,
    id: string
  ): Promise<PeriodReflection | null> {
    const derived = /^(weekly|monthly):(\d{4}-\d{2}-\d{2})$/.exec(id);
    if (derived) {
      return this.getPeriodReflection(
        userId,
        derived[1] as PeriodType,
        derived[2]
      );
    }
    // Legacy uuid.
    const wb = await this.ensureWorkbench(userId);
    const legacy = await this.readDocAt<{
      period?: Record<string, { type: PeriodType; period_start: string }>;
    }>(wb, 'metadata', 'legacy_ids.json');
    const hit = legacy?.period?.[id];
    return hit
      ? this.getPeriodReflection(userId, hit.type, hit.period_start)
      : null;
  }

  async upsertPeriodReflection(
    userId: string,
    type: PeriodType,
    periodStart: YmdString,
    periodEnd: YmdString,
    fields: Partial<PeriodReflection>
  ): Promise<PeriodReflection> {
    const wb = await this.ensureWorkbench(userId);
    const path = this.reflectionPath(type, periodStart);
    const now = new Date().toISOString();
    const latchPath = `latches/period-${type}-${periodStart}.edited`;

    const base: ReflectionDoc = {
      schema: 'echojournal.period_reflection.v1',
      id: `${type}:${periodStart}`,
      legacy_id: null,
      user_id: userId,
      period_type: type,
      period_start: periodStart,
      period_end: periodEnd,
      achievements: (fields.achievements as string[]) ?? [],
      commitments: (fields.commitments as string[]) ?? [],
      mood_overall: fields.mood_overall ?? null,
      mood_reason: fields.mood_reason ?? null,
      flashback: fields.flashback ?? null,
      stats: (fields.stats as Record<string, JsonValue>) ?? null,
      edited: false,
      gen_version: fields.gen_version ?? null,
      last_generated_at: fields.last_generated_at ?? now,
      updated_at: now
    };

    try {
      await this.putDoc(
        wb,
        'outputs',
        path,
        base as unknown as Record<string, JsonValue>
      );
      return this.reflectionFromDoc(base);
    } catch (err) {
      if (!isPathExists(err)) throw err;
    }

    // Exists: read-merge-write with full-document optimistic edit.
    const edited = await this.latchExists(wb, latchPath);
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await this.readDocAt<ReflectionDoc>(wb, 'outputs', path);
      if (!current) throw new Error(`reflection vanished: ${path}`);
      const next: ReflectionDoc = {
        ...current,
        period_end: periodEnd,
        stats: (fields.stats as Record<string, JsonValue>) ?? current.stats,
        gen_version: fields.gen_version ?? current.gen_version,
        last_generated_at: fields.last_generated_at ?? now,
        updated_at: now,
        edited: current.edited || edited,
        ...(edited || current.edited
          ? {}
          : {
              achievements:
                (fields.achievements as string[]) ?? current.achievements,
              commitments:
                (fields.commitments as string[]) ?? current.commitments,
              mood_overall: fields.mood_overall ?? current.mood_overall,
              mood_reason: fields.mood_reason ?? current.mood_reason,
              flashback: fields.flashback ?? current.flashback
            })
      };
      try {
        await this.call('workbench_edit', {
          id: wb,
          section: 'outputs',
          path,
          old_string: serializeDoc(
            current as unknown as Record<string, JsonValue>
          ),
          new_string: serializeDoc(next as unknown as Record<string, JsonValue>)
        });
        return this.reflectionFromDoc(next);
      } catch (err) {
        if (isRetryable(err) && attempt < 2) continue;
        throw err;
      }
    }
    throw new Error('upsertPeriodReflection exhausted retries');
  }

  async updatePeriodReflectionFields(
    userId: string,
    id: string,
    patch: Partial<PeriodReflection>
  ): Promise<PeriodReflection> {
    const existing = await this.getPeriodReflectionById(userId, id);
    if (!existing) throw new Error('Period reflection not found');
    const type = existing.period_type as PeriodType;
    const periodStart = existing.period_start;
    const wb = await this.ensureWorkbench(userId);
    const path = this.reflectionPath(type, periodStart);
    await this.latch(wb, `latches/period-${type}-${periodStart}.edited`);
    const now = new Date().toISOString();

    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await this.readDocAt<ReflectionDoc>(wb, 'outputs', path);
      if (!current) throw new Error('Period reflection not found');
      const next = {
        ...current,
        ...Object.fromEntries(
          Object.entries(patch).filter(([, v]) => v !== undefined)
        ),
        edited: true,
        updated_at: now
      } as ReflectionDoc;
      try {
        await this.call('workbench_edit', {
          id: wb,
          section: 'outputs',
          path,
          old_string: serializeDoc(
            current as unknown as Record<string, JsonValue>
          ),
          new_string: serializeDoc(next as unknown as Record<string, JsonValue>)
        });
        return this.reflectionFromDoc(next);
      } catch (err) {
        if (isRetryable(err) && attempt < 2) continue;
        throw err;
      }
    }
    throw new Error('updatePeriodReflectionFields exhausted retries');
  }

  async listPeriodReflections(
    userId: string,
    type: PeriodType,
    limit: number
  ): Promise<PeriodReflection[]> {
    if (await this.isUserDeleted(userId)) return [];
    const wb = await this.ensureWorkbench(userId);
    let names: string[] = [];
    try {
      const res = await this.call(
        'workbench_list',
        {
          id: wb,
          section: 'outputs',
          path: `reflections/${type}/`,
          limit: 100
        },
        SCAN_TIMEOUT_MS
      );
      names = listNames(res);
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }

    const picked = names
      .map((n) => n.slice(n.lastIndexOf('/') + 1))
      .filter((n) => n.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, limit);

    const out: PeriodReflection[] = [];
    for (const name of picked) {
      const doc = await this.readDocAt<ReflectionDoc>(
        wb,
        'outputs',
        `reflections/${type}/${name}`
      );
      if (doc) out.push(this.reflectionFromDoc(doc));
    }
    return out;
  }

  // ── privacy ───────────────────────────────────────────────────────

  async deleteAllUserData(userId: string): Promise<void> {
    const wb = await this.ensureWorkbench(userId);

    // Marker first: every read path short-circuits immediately.
    try {
      await this.putDoc(wb, 'metadata', 'deleted.json', {
        schema: 'echojournal.deleted.v1',
        deleted_at: new Date().toISOString()
      });
    } catch (err) {
      if (!isPathExists(err)) throw err;
    }
    this.deletedCache.set(userId, { at: Date.now(), deleted: true });

    // Best-effort tombstoning: content bytes get GC'd; path names remain
    // (honest privacy note lives in docs/nokv-demo.md and the design doc).
    const state = await this.foldState(userId).catch(() => null);
    const dates = state ? [...state.byDate.keys()] : [];
    for (const date of dates) {
      const day = state!.byDate.get(date)!;
      for (const entryId of day.liveEntryIds) {
        await this.call('workbench_put_file', {
          id: wb,
          section: 'input',
          path: `audio/${date}/${entryId}.webm`,
          text: '',
          replace: true
        }).catch(() => {});
        await this.call('workbench_put_file', {
          id: wb,
          section: 'outputs',
          path: `entries/${date}/${entryId}.json`,
          text: '',
          replace: true
        }).catch(() => {});
      }
      await this.call('workbench_put_file', {
        id: wb,
        section: 'outputs',
        path: `days/${date}.json`,
        text: '',
        replace: true
      }).catch(() => {});
      await this.call('workbench_put_file', {
        id: wb,
        section: 'outputs',
        path: `text/${date}/summary.txt`,
        text: '',
        replace: true
      }).catch(() => {});
    }
    this.invalidateFold(userId);
  }
}
