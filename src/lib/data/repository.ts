// Backend-agnostic data layer for EchoJournal (design: docs/nokv-data-migration-design.md §4).
// Domain types intentionally mirror the Tables<'daily_summaries'> /
// Tables<'period_reflections'> column shapes so serialize.ts, mood-utils.ts
// and every UI component keep working unchanged.

export type YmdString = string; // "YYYY-MM-DD" in APP_TIMEZONE

export interface MoodEntry {
  id: string;
  date: YmdString;
  day_quality: string;
  emotions: string[];
  created_at: string;
  updated_at: string | null;
}

export interface JournalEntry {
  id: string;
  legacy_audio_id: string | null;
  date: YmdString;
  created_at: string;
  audio: {
    mime_type: string;
    size_bytes: number | null;
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

export interface DailySummary {
  id: string;
  user_id: string;
  date: YmdString;
  summary: string;
  entry_count: number | null;
  mood_quality: string | null;
  mood_overall: string | null;
  mood_reason: string | null;
  dominant_emotions: string[] | null;
  achievements: string[] | null;
  commitments: string[] | null;
  flashback: string | null;
  stats: unknown;
  gen_version: string | null;
  edited: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  last_generated_at: string | null;
}

export interface PeriodReflection {
  id: string;
  user_id: string;
  period_type: string;
  period_start: YmdString;
  period_end: YmdString;
  mood_overall: string | null;
  mood_reason: string | null;
  achievements: string[] | null;
  commitments: string[] | null;
  flashback: string | null;
  stats: unknown;
  gen_version: string | null;
  edited: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  last_generated_at: string | null;
}

export interface DayBundle {
  date: YmdString;
  summary: DailySummary | null;
  entries: JournalEntry[];
  mood: MoodEntry | null;
}

export type PeriodType = 'weekly' | 'monthly';

/** Thrown by the NoKV backend when the transport is unavailable; the factory
 *  falls back (reads) or surfaces 503 (writes). Never thrown by Supabase. */
export class NokvUnavailableError extends Error {}

export interface EntryStats {
  totalEntries: number;
  thisWeekEntries: number;
  currentStreak: number;
}

export interface JournalDataRepository {
  // ── mood
  getMood(userId: string, date: YmdString): Promise<MoodEntry | null>;
  upsertMood(
    userId: string,
    date: YmdString,
    input: { dayQuality: string; emotions: string[] }
  ): Promise<MoodEntry>;
  listMoodsInRange(
    userId: string,
    start: YmdString,
    end: YmdString
  ): Promise<MoodEntry[]>;

  // ── journal entries (audio + transcript folded 1:1)
  createEntry(
    userId: string,
    input: {
      audio: Buffer;
      mimeType: string;
      transcript: string;
      rephrasedText: string | null;
      language: string;
    }
  ): Promise<JournalEntry>;
  getEntry(userId: string, entryId: string): Promise<JournalEntry | null>;
  getAudioBlob(
    userId: string,
    entryId: string
  ): Promise<{ data: Buffer; mimeType: string } | null>;
  updateRephrasedText(
    userId: string,
    entryId: string,
    text: string
  ): Promise<JournalEntry>;
  deleteEntry(userId: string, entryId: string): Promise<void>;
  listEntriesForDay(userId: string, date: YmdString): Promise<JournalEntry[]>;
  getEntryStats(userId: string): Promise<EntryStats>;

  // ── daily summaries
  getDailySummary(
    userId: string,
    date: YmdString
  ): Promise<DailySummary | null>;
  upsertDailySummary(
    userId: string,
    date: YmdString,
    fields: {
      summary: string;
      entryCount: number;
      moodQuality: string | null;
      dominantEmotions: string[];
    }
  ): Promise<DailySummary>;
  updateDailySummaryReflection(
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
  ): Promise<DailySummary>;
  listDailySummaries(
    userId: string,
    opts: { before?: YmdString; limit: number }
  ): Promise<DailySummary[]>;
  listDailySummariesInRange(
    userId: string,
    start: YmdString,
    end: YmdString
  ): Promise<DailySummary[]>;
  queryJournalDays(
    userId: string,
    filters: {
      startDate?: YmdString;
      endDate?: YmdString;
      moods?: string[];
      keyword?: string;
      page: number;
      limit: number;
    }
  ): Promise<{ days: DayBundle[]; totalCount: number }>;

  // ── period reflections
  getPeriodReflection(
    userId: string,
    type: PeriodType,
    periodStart: YmdString
  ): Promise<PeriodReflection | null>;
  getPeriodReflectionById(
    userId: string,
    id: string
  ): Promise<PeriodReflection | null>;
  upsertPeriodReflection(
    userId: string,
    type: PeriodType,
    periodStart: YmdString,
    periodEnd: YmdString,
    fields: Partial<PeriodReflection>
  ): Promise<PeriodReflection>;
  updatePeriodReflectionFields(
    userId: string,
    id: string,
    patch: Partial<PeriodReflection>
  ): Promise<PeriodReflection>;
  listPeriodReflections(
    userId: string,
    type: PeriodType,
    limit: number
  ): Promise<PeriodReflection[]>;

  // ── privacy
  deleteAllUserData(userId: string): Promise<void>;
}
