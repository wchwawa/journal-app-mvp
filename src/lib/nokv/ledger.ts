import { randomUUID } from 'node:crypto';

// Per-user monthly ledger shards (design §2.4): logs/ledger/{YYYY-MM}.jsonl.
// The ledger is a DERIVED read model — every event is reproducible from the
// authoritative documents — so lost events degrade filters/stats, never reads.

export type LedgerEventKind =
  | 'entry_created'
  | 'entry_deleted'
  | 'mood_set'
  | 'summary_written';

export interface LedgerEvent {
  v: 1;
  event_id: string;
  ts: string;
  kind: LedgerEventKind;
  date: string; // YYYY-MM-DD (APP_TIMEZONE day)
  entry_id?: string;
  day_quality?: string;
  emotions?: string[];
  mood_quality?: string | null;
  entry_count?: number;
}

export interface FoldedDay {
  date: string;
  liveEntryIds: Set<string>;
  mood: { day_quality: string; emotions: string[]; ts: string } | null;
  summary: {
    mood_quality: string | null;
    entry_count: number;
    ts: string;
  } | null;
}

export interface FoldedState {
  byDate: Map<string, FoldedDay>;
}

/** One ULID-ish id per repo operation; retries within the operation MUST
 *  reuse it so replays deduplicate at fold time (design: F12 timeout trap). */
export function newEventId(): string {
  return `evt_${Date.now().toString(36)}${randomUUID().replaceAll('-', '').slice(0, 10)}`;
}

export function ledgerShardPath(date: string): string {
  return `ledger/${date.slice(0, 7)}.jsonl`;
}

export function serializeEvent(event: LedgerEvent): string {
  return JSON.stringify(event) + '\n';
}

function day(state: FoldedState, date: string): FoldedDay {
  let d = state.byDate.get(date);
  if (!d) {
    d = { date, liveEntryIds: new Set(), mood: null, summary: null };
    state.byDate.set(date, d);
  }
  return d;
}

/** Folds ledger lines (any shard order; lines within a shard are ordered by
 *  append). Deduplicates by event_id. Tolerates malformed lines. */
export function foldLedger(lines: string[], into?: FoldedState): FoldedState {
  const state: FoldedState = into ?? { byDate: new Map() };
  const seen = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let ev: LedgerEvent;
    try {
      ev = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!ev.event_id || !ev.date || !ev.kind) continue;
    if (seen.has(ev.event_id)) continue;
    seen.add(ev.event_id);

    const d = day(state, ev.date);
    switch (ev.kind) {
      case 'entry_created':
        if (ev.entry_id) d.liveEntryIds.add(ev.entry_id);
        break;
      case 'entry_deleted':
        if (ev.entry_id) d.liveEntryIds.delete(ev.entry_id);
        break;
      case 'mood_set':
        d.mood = {
          day_quality: ev.day_quality ?? '',
          emotions: ev.emotions ?? [],
          ts: ev.ts
        };
        break;
      case 'summary_written':
        d.summary = {
          mood_quality: ev.mood_quality ?? null,
          entry_count: ev.entry_count ?? 0,
          ts: ev.ts
        };
        break;
    }
  }
  return state;
}
