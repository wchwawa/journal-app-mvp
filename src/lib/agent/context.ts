import type { Tables } from '@/types/supabase';
import type {
  DailySummary,
  JournalDataRepository,
  MoodEntry,
  PeriodReflection
} from '@/lib/data';
import { getLocalDayRange } from '@/lib/timezone';
import { getPeriodBounds } from '@/lib/reflections/aggregate';

export type ContextScope = 'today' | 'week' | 'month' | 'recent' | 'custom';

export interface ContextRequest {
  scope: ContextScope;
  anchorDate?: string;
  limit?: number;
  range?: { start: string; end: string };
}

export interface ContextResponse {
  scope: ContextScope;
  anchorDate: string;
  summaries: Array<
    Pick<
      Tables<'daily_summaries'>,
      | 'id'
      | 'date'
      | 'summary'
      | 'entry_count'
      | 'mood_quality'
      | 'mood_overall'
      | 'mood_reason'
      | 'achievements'
      | 'commitments'
      | 'flashback'
      | 'stats'
    >
  >;
  reflections: Array<
    Pick<
      Tables<'period_reflections'>,
      | 'id'
      | 'period_type'
      | 'period_start'
      | 'period_end'
      | 'achievements'
      | 'commitments'
      | 'mood_overall'
      | 'mood_reason'
      | 'flashback'
      | 'stats'
    >
  >;
  mood: Pick<
    Tables<'daily_question'>,
    'day_quality' | 'emotions' | 'created_at'
  > | null;
}

const pickRange = (scope: ContextScope, anchorDate?: string) => {
  if (scope === 'today') {
    const { date, start, end } = getLocalDayRange({
      date: anchorDate ? new Date(anchorDate) : undefined
    });
    return { anchor: date, start, end };
  }

  if (scope === 'week' || scope === 'month') {
    const resolved = anchorDate ?? getLocalDayRange().date;
    const bounds = getPeriodBounds(
      scope === 'week' ? 'weekly' : 'monthly',
      resolved
    );
    return {
      anchor: resolved,
      start: `${bounds.start}T00:00:00Z`,
      end: `${bounds.end}T23:59:59.999Z`
    };
  }

  return {
    anchor: anchorDate ?? getLocalDayRange().date,
    start: undefined,
    end: undefined
  };
};

const mapSummaries = (rows: DailySummary[]): ContextResponse['summaries'] =>
  rows.map((row) => ({
    id: row.id,
    date: row.date,
    summary: row.summary,
    entry_count: row.entry_count,
    mood_quality: row.mood_quality,
    mood_overall: row.mood_overall,
    mood_reason: row.mood_reason,
    achievements: row.achievements,
    commitments: row.commitments,
    flashback: row.flashback,
    stats: row.stats as Tables<'daily_summaries'>['stats']
  }));

const mapReflections = (
  rows: PeriodReflection[]
): ContextResponse['reflections'] =>
  rows.map((row) => ({
    id: row.id,
    period_type: row.period_type,
    period_start: row.period_start,
    period_end: row.period_end,
    achievements: row.achievements,
    commitments: row.commitments,
    mood_overall: row.mood_overall,
    mood_reason: row.mood_reason,
    flashback: row.flashback,
    stats: row.stats as Tables<'period_reflections'>['stats']
  }));

const mapMood = (mood: MoodEntry): ContextResponse['mood'] => ({
  day_quality: mood.day_quality,
  emotions: mood.emotions,
  created_at: mood.created_at
});

export async function fetchUserContext(
  repo: JournalDataRepository,
  userId: string,
  payload: ContextRequest
): Promise<ContextResponse> {
  const limit = Math.min(Math.max(payload.limit ?? 5, 1), 20);
  const result: ContextResponse = {
    scope: payload.scope,
    anchorDate: payload.anchorDate ?? getLocalDayRange().date,
    summaries: [],
    reflections: [],
    mood: null
  };

  if (payload.scope === 'recent') {
    const summaries = await repo.listDailySummaries(userId, { limit });
    result.summaries = mapSummaries(summaries);
    return result;
  }

  if (payload.scope === 'custom' && payload.range) {
    const summaries = await repo.listDailySummariesInRange(
      userId,
      payload.range.start,
      payload.range.end
    );
    result.summaries = mapSummaries(summaries.slice(0, limit));
    return result;
  }

  const { anchor, start, end } = pickRange(payload.scope, payload.anchorDate);
  result.anchorDate = anchor;

  if (payload.scope === 'today') {
    const summary = await repo.getDailySummary(userId, anchor);
    result.summaries = mapSummaries(summary ? [summary] : []);

    const mood = await repo.getMood(userId, anchor);
    result.mood = mood ? mapMood(mood) : null;
    return result;
  }

  if (start && end) {
    const rangeStart = start.slice(0, 10);
    const rangeEnd = end.slice(0, 10);

    const summaries = await repo.listDailySummariesInRange(
      userId,
      rangeStart,
      rangeEnd
    );
    result.summaries = mapSummaries(summaries.slice(0, limit));

    const moods = await repo.listMoodsInRange(userId, rangeStart, rangeEnd);
    const latestMood = moods.length > 0 ? moods[moods.length - 1] : null;
    result.mood = latestMood ? mapMood(latestMood) : null;

    if (payload.scope === 'week' || payload.scope === 'month') {
      const periodType = payload.scope === 'week' ? 'weekly' : 'monthly';
      const reflection = await repo.getPeriodReflection(
        userId,
        periodType,
        rangeStart
      );
      result.reflections =
        reflection && reflection.period_end === rangeEnd
          ? mapReflections([reflection])
          : [];
    }

    return result;
  }

  const summaries = await repo.listDailySummaries(userId, { limit });
  result.summaries = mapSummaries(summaries);
  return result;
}
