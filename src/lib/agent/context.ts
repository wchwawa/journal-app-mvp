import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@/types/supabase';
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

type AdminClient = SupabaseClient<Database>;

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

const mapSummaries = (rows: Tables<'daily_summaries'>[]) =>
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
    stats: row.stats
  }));

const mapReflections = (rows: Tables<'period_reflections'>[]) =>
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
    stats: row.stats
  }));

export async function fetchUserContext(
  client: AdminClient,
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
    const { data } = await client
      .from('daily_summaries')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit);

    result.summaries = mapSummaries(data ?? []);
    return result;
  }

  if (payload.scope === 'custom' && payload.range) {
    const { data } = await client
      .from('daily_summaries')
      .select('*')
      .eq('user_id', userId)
      .gte('date', payload.range.start)
      .lte('date', payload.range.end)
      .order('date', { ascending: true })
      .limit(limit);

    result.summaries = mapSummaries(data ?? []);
    return result;
  }

  const { anchor, start, end } = pickRange(payload.scope, payload.anchorDate);
  result.anchorDate = anchor;

  if (start && end) {
    const { data: summaries } = await client
      .from('daily_summaries')
      .select('*')
      .eq('user_id', userId)
      .gte('date', start.slice(0, 10))
      .lte('date', end.slice(0, 10))
      .order('date', { ascending: true })
      .limit(limit);

    result.summaries = mapSummaries(summaries ?? []);

    const { data: mood } = await client
      .from('daily_question')
      .select('day_quality, emotions, created_at')
      .eq('user_id', userId)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: false })
      .maybeSingle();

    result.mood = mood ?? null;

    if (payload.scope === 'week' || payload.scope === 'month') {
      const periodType = payload.scope === 'week' ? 'weekly' : 'monthly';
      const { data: reflections } = await client
        .from('period_reflections')
        .select('*')
        .eq('user_id', userId)
        .eq('period_type', periodType)
        .eq('period_start', start.slice(0, 10))
        .eq('period_end', end.slice(0, 10));

      result.reflections = mapReflections(reflections ?? []);
    }

    return result;
  }

  const { data } = await client
    .from('daily_summaries')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);

  result.summaries = mapSummaries(data ?? []);
  return result;
}
