import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@/types/supabase';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLocalDayRange, getUtcRangeForDate } from '@/lib/timezone';
import type {
  DailySummary,
  DayBundle,
  EntryStats,
  JournalDataRepository,
  JournalEntry,
  MoodEntry,
  PeriodReflection,
  PeriodType,
  YmdString
} from './repository';

// Mechanical consolidation of the previous inline Supabase queries
// (src/lib/supabase/queries.ts + 12 API routes). Behavior-preserving, with
// one sanctioned unification: every "day" boundary goes through timezone.ts
// (aggregate.ts previously used bare date-string bounds).

type Client = SupabaseClient<Database>;
type AudioRow = Tables<'audio_files'> & {
  transcripts: Array<{
    id: string;
    text: string | null;
    rephrased_text: string | null;
    language: string | null;
    created_at: string | null;
  }>;
};

const AUDIO_WITH_TRANSCRIPTS = `
  *,
  transcripts (
    id,
    text,
    rephrased_text,
    language,
    created_at
  )
`;

function toMood(row: Tables<'daily_question'>): MoodEntry {
  return {
    id: row.id,
    date: getLocalDayRange({ date: new Date(row.created_at!) }).date,
    day_quality: row.day_quality,
    emotions: row.emotions ?? [],
    created_at: row.created_at!,
    updated_at: row.updated_at
  };
}

function toEntry(row: AudioRow): JournalEntry {
  const transcript = row.transcripts?.[0];
  return {
    id: row.id,
    legacy_audio_id: row.id,
    date: getLocalDayRange({ date: new Date(row.created_at!) }).date,
    created_at: row.created_at!,
    audio: {
      mime_type: row.mime_type ?? 'audio/webm',
      size_bytes: null,
      duration_ms: row.duration_ms,
      deleted: false
    },
    transcript: {
      text: transcript?.text ?? '',
      rephrased_text: transcript?.rephrased_text ?? null,
      language: transcript?.language ?? null,
      updated_at: transcript?.created_at ?? row.created_at!
    }
  };
}

function toSummary(row: Tables<'daily_summaries'>): DailySummary {
  return { ...row } as DailySummary;
}

function toReflection(row: Tables<'period_reflections'>): PeriodReflection {
  return { ...row } as PeriodReflection;
}

export class SupabaseJournalRepository implements JournalDataRepository {
  private db: Client;

  constructor(client?: Client) {
    this.db = client ?? createAdminClient();
  }

  // ── mood ──────────────────────────────────────────────────────────

  async getMood(userId: string, date: YmdString): Promise<MoodEntry | null> {
    const { start, end } = getUtcRangeForDate(date);
    const { data, error } = await this.db
      .from('daily_question')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', start)
      .lte('created_at', end)
      .maybeSingle();
    if (error) throw error;
    return data ? toMood(data) : null;
  }

  async upsertMood(
    userId: string,
    date: YmdString,
    input: { dayQuality: string; emotions: string[] }
  ): Promise<MoodEntry> {
    const { start, end } = getUtcRangeForDate(date);
    const { data: existing, error: readError } = await this.db
      .from('daily_question')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', start)
      .lte('created_at', end)
      .maybeSingle();
    if (readError) throw readError;

    if (existing) {
      const { data, error } = await this.db
        .from('daily_question')
        .update({
          day_quality: input.dayQuality,
          emotions: input.emotions,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return toMood(data);
    }

    const { data, error } = await this.db
      .from('daily_question')
      .insert({
        user_id: userId,
        day_quality: input.dayQuality,
        emotions: input.emotions
      })
      .select()
      .single();
    if (error) throw error;
    return toMood(data);
  }

  async listMoodsInRange(
    userId: string,
    start: YmdString,
    end: YmdString
  ): Promise<MoodEntry[]> {
    const { start: startTs } = getUtcRangeForDate(start);
    const { end: endTs } = getUtcRangeForDate(end);
    const { data, error } = await this.db
      .from('daily_question')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startTs)
      .lte('created_at', endTs)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(toMood);
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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `journal-audio/${userId}/${timestamp}-recording.webm`;

    const { data: storageData, error: storageError } = await this.db.storage
      .from('audio-files')
      .upload(fileName, input.audio, {
        contentType: input.mimeType,
        upsert: false
      });
    if (storageError) throw storageError;

    const { data: audioRow, error: audioError } = await this.db
      .from('audio_files')
      .insert({
        user_id: userId,
        storage_path: storageData.path,
        mime_type: input.mimeType,
        duration_ms: null
      })
      .select()
      .single();
    if (audioError) throw audioError;

    const { data: transcriptRow, error: transcriptError } = await this.db
      .from('transcripts')
      .insert({
        user_id: userId,
        audio_id: audioRow.id,
        text: input.transcript,
        rephrased_text: input.rephrasedText,
        language: input.language
      })
      .select()
      .single();
    if (transcriptError) throw transcriptError;

    return toEntry({
      ...audioRow,
      transcripts: [transcriptRow]
    } as AudioRow);
  }

  async getEntry(
    userId: string,
    entryId: string
  ): Promise<JournalEntry | null> {
    const { data, error } = await this.db
      .from('audio_files')
      .select(AUDIO_WITH_TRANSCRIPTS)
      .eq('id', entryId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data ? toEntry(data as AudioRow) : null;
  }

  async getAudioBlob(
    userId: string,
    entryId: string
  ): Promise<{ data: Buffer; mimeType: string } | null> {
    const { data: meta, error } = await this.db
      .from('audio_files')
      .select('storage_path, mime_type')
      .eq('id', entryId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!meta) return null;

    const { data: blob, error: downloadError } = await this.db.storage
      .from('audio-files')
      .download(meta.storage_path);
    if (downloadError || !blob) return null;

    return {
      data: Buffer.from(await blob.arrayBuffer()),
      mimeType: meta.mime_type ?? 'audio/webm'
    };
  }

  async updateRephrasedText(
    userId: string,
    entryId: string,
    text: string
  ): Promise<JournalEntry> {
    const { error } = await this.db
      .from('transcripts')
      .update({ rephrased_text: text })
      .eq('audio_id', entryId)
      .eq('user_id', userId);
    if (error) throw error;

    const entry = await this.getEntry(userId, entryId);
    if (!entry) throw new Error('Entry not found after update');
    return entry;
  }

  async deleteEntry(userId: string, entryId: string): Promise<void> {
    const { data: audioRow, error: readError } = await this.db
      .from('audio_files')
      .select('id, storage_path')
      .eq('id', entryId)
      .eq('user_id', userId)
      .maybeSingle();
    if (readError) throw readError;
    if (!audioRow) return;

    const { error: transcriptError } = await this.db
      .from('transcripts')
      .delete()
      .eq('audio_id', entryId)
      .eq('user_id', userId);
    if (transcriptError) throw transcriptError;

    if (audioRow.storage_path) {
      const { error: storageError } = await this.db.storage
        .from('audio-files')
        .remove([audioRow.storage_path]);
      if (storageError) {
        // eslint-disable-next-line no-console
        console.error('Audio blob removal failed:', storageError);
      }
    }

    const { error: rowError } = await this.db
      .from('audio_files')
      .delete()
      .eq('id', entryId)
      .eq('user_id', userId);
    if (rowError) throw rowError;
  }

  async listEntriesForDay(
    userId: string,
    date: YmdString
  ): Promise<JournalEntry[]> {
    const { start, end } = getUtcRangeForDate(date);
    const { data, error } = await this.db
      .from('audio_files')
      .select(AUDIO_WITH_TRANSCRIPTS)
      .eq('user_id', userId)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => toEntry(row as AudioRow));
  }

  async getEntryStats(userId: string): Promise<EntryStats> {
    const { count: totalEntries } = await this.db
      .from('audio_files')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const { count: thisWeekEntries } = await this.db
      .from('audio_files')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', weekStart.toISOString());

    const { data: recentEntries } = await this.db
      .from('audio_files')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);

    let currentStreak = 0;
    if (recentEntries) {
      const today = new Date();
      const dates = new Set(
        recentEntries.map(
          (entry) =>
            getLocalDayRange({ date: new Date(entry.created_at!) }).date
        )
      );
      for (let i = 0; i < 30; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        if (dates.has(getLocalDayRange({ date: checkDate }).date)) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    return {
      totalEntries: totalEntries || 0,
      thisWeekEntries: thisWeekEntries || 0,
      currentStreak
    };
  }

  // ── daily summaries ───────────────────────────────────────────────

  async getDailySummary(
    userId: string,
    date: YmdString
  ): Promise<DailySummary | null> {
    const { data, error } = await this.db
      .from('daily_summaries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();
    if (error) throw error;
    return data ? toSummary(data) : null;
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
    const { data, error } = await this.db
      .from('daily_summaries')
      .upsert(
        {
          user_id: userId,
          date,
          summary: fields.summary,
          entry_count: fields.entryCount,
          mood_quality: fields.moodQuality,
          dominant_emotions: fields.dominantEmotions,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id,date' }
      )
      .select()
      .single();
    if (error) throw error;
    return toSummary(data);
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
    const existing = await this.getDailySummary(userId, date);
    if (!existing) throw new Error(`No daily summary for ${date}`);

    const preserveUserFields = Boolean(
      opts.preserveIfEdited && existing.edited
    );
    const updatePayload: Record<string, unknown> = { ...patch };
    if (preserveUserFields) {
      delete updatePayload.achievements;
      delete updatePayload.commitments;
      delete updatePayload.mood_overall;
      delete updatePayload.mood_reason;
      delete updatePayload.flashback;
    }
    if (opts.markEdited) updatePayload.edited = true;
    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await this.db
      .from('daily_summaries')
      .update(updatePayload)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return toSummary(data);
  }

  async listDailySummaries(
    userId: string,
    opts: { before?: YmdString; limit: number }
  ): Promise<DailySummary[]> {
    let query = this.db
      .from('daily_summaries')
      .select('*')
      .eq('user_id', userId);
    if (opts.before) query = query.lte('date', opts.before);
    const { data, error } = await query
      .order('date', { ascending: false })
      .limit(opts.limit);
    if (error) throw error;
    return (data ?? []).map(toSummary);
  }

  async listDailySummariesInRange(
    userId: string,
    start: YmdString,
    end: YmdString
  ): Promise<DailySummary[]> {
    const { data, error } = await this.db
      .from('daily_summaries')
      .select('*')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(toSummary);
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
    const offset = (filters.page - 1) * filters.limit;

    let query = this.db
      .from('daily_summaries')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);
    if (filters.startDate) query = query.gte('date', filters.startDate);
    if (filters.endDate) query = query.lte('date', filters.endDate);
    if (filters.moods && filters.moods.length > 0) {
      query = query.in('mood_quality', filters.moods);
    }
    if (filters.keyword) {
      query = query.ilike('summary', `%${filters.keyword}%`);
    }

    const {
      data: summaries,
      error,
      count
    } = await query
      .order('date', { ascending: false })
      .range(offset, offset + filters.limit - 1);
    if (error) throw error;

    const days = await Promise.all(
      (summaries ?? []).map(async (summary): Promise<DayBundle> => {
        const [entries, mood] = await Promise.all([
          this.listEntriesForDay(userId, summary.date),
          this.getMood(userId, summary.date)
        ]);
        return {
          date: summary.date,
          summary: toSummary(summary),
          entries,
          mood
        };
      })
    );

    return { days, totalCount: count || 0 };
  }

  // ── period reflections ────────────────────────────────────────────

  async getPeriodReflection(
    userId: string,
    type: PeriodType,
    periodStart: YmdString
  ): Promise<PeriodReflection | null> {
    const { data, error } = await this.db
      .from('period_reflections')
      .select('*')
      .eq('user_id', userId)
      .eq('period_type', type)
      .eq('period_start', periodStart)
      .maybeSingle();
    if (error) throw error;
    return data ? toReflection(data) : null;
  }

  async getPeriodReflectionById(
    userId: string,
    id: string
  ): Promise<PeriodReflection | null> {
    const { data, error } = await this.db
      .from('period_reflections')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? toReflection(data) : null;
  }

  async upsertPeriodReflection(
    userId: string,
    type: PeriodType,
    periodStart: YmdString,
    periodEnd: YmdString,
    fields: Partial<PeriodReflection>
  ): Promise<PeriodReflection> {
    const { data, error } = await this.db
      .from('period_reflections')
      .upsert(
        {
          user_id: userId,
          period_type: type,
          period_start: periodStart,
          period_end: periodEnd,
          ...(fields as Record<string, unknown>),
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id,period_type,period_start' }
      )
      .select()
      .single();
    if (error) throw error;
    return toReflection(data);
  }

  async updatePeriodReflectionFields(
    userId: string,
    id: string,
    patch: Partial<PeriodReflection>
  ): Promise<PeriodReflection> {
    const { data, error } = await this.db
      .from('period_reflections')
      .update({
        ...(patch as Record<string, unknown>),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return toReflection(data);
  }

  async listPeriodReflections(
    userId: string,
    type: PeriodType,
    limit: number
  ): Promise<PeriodReflection[]> {
    const { data, error } = await this.db
      .from('period_reflections')
      .select('*')
      .eq('user_id', userId)
      .eq('period_type', type)
      .order('period_start', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(toReflection);
  }

  // ── privacy ───────────────────────────────────────────────────────

  async deleteAllUserData(userId: string): Promise<void> {
    // Order respects the audio_files <- transcripts FK.
    await this.db.from('transcripts').delete().eq('user_id', userId);

    const { data: audioRows } = await this.db
      .from('audio_files')
      .select('storage_path')
      .eq('user_id', userId);
    const paths = (audioRows ?? [])
      .map((r) => r.storage_path)
      .filter((p): p is string => Boolean(p));
    if (paths.length > 0) {
      await this.db.storage.from('audio-files').remove(paths);
    }

    await this.db.from('audio_files').delete().eq('user_id', userId);
    await this.db.from('daily_question').delete().eq('user_id', userId);
    await this.db.from('daily_summaries').delete().eq('user_id', userId);
    await this.db.from('period_reflections').delete().eq('user_id', userId);
  }
}
