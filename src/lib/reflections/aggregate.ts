import { addDays, endOfMonth, startOfMonth } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@/types/supabase';
import type { ReflectionMode } from './types';

type AdminClient = SupabaseClient<Database>;

export interface DailyAggregate {
  summary: Tables<'daily_summaries'>;
  mood?: Tables<'daily_question'> | null;
}

export const isoDate = (date: Date) => date.toISOString().split('T')[0];

export const resolveAnchorDate = (anchorDate?: string) => {
  if (anchorDate) return anchorDate;
  return isoDate(new Date());
};

export const getPeriodBounds = (
  mode: ReflectionMode,
  anchorDate: string
): { start: string; end: string } => {
  const date = new Date(anchorDate);

  if (mode === 'daily') {
    return { start: anchorDate, end: anchorDate };
  }

  if (mode === 'weekly') {
    const dayOfWeek = date.getUTCDay() || 7; // 1 (Mon) ... 7 (Sun)
    const monday = addDays(date, 1 - dayOfWeek);
    const sunday = addDays(monday, 6);
    return {
      start: isoDate(monday),
      end: isoDate(sunday)
    };
  }

  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return { start: isoDate(start), end: isoDate(end) };
};

export async function fetchDailyAggregate(
  client: AdminClient,
  userId: string,
  date: string
): Promise<DailyAggregate | null> {
  const { data: summary, error: summaryError } = await client
    .from('daily_summaries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  if (summaryError) {
    console.error('Failed to fetch daily summary', summaryError);
    throw summaryError;
  }

  if (!summary) return null;

  const { data: mood, error: moodError } = await client
    .from('daily_question')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', `${date}T00:00:00`)
    .lte('created_at', `${date}T23:59:59.999`)
    .maybeSingle();

  if (moodError && moodError.code !== 'PGRST116') {
    console.error('Failed to fetch daily mood', moodError);
    throw moodError;
  }

  return {
    summary,
    mood: mood ?? null
  };
}

export async function fetchAggregatesInRange(
  client: AdminClient,
  userId: string,
  start: string,
  end: string
): Promise<DailyAggregate[]> {
  const { data: summaries, error: summariesError } = await client
    .from('daily_summaries')
    .select('*')
    .eq('user_id', userId)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });

  if (summariesError) {
    console.error('Failed to fetch summaries range', summariesError);
    throw summariesError;
  }

  if (!summaries || summaries.length === 0) {
    return [];
  }

  const { data: moods, error: moodsError } = await client
    .from('daily_question')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', `${start}T00:00:00`)
    .lte('created_at', `${end}T23:59:59.999`);

  if (moodsError && moodsError.code !== 'PGRST116') {
    console.error('Failed to fetch moods range', moodsError);
    throw moodsError;
  }

  const moodMap = new Map<string, Tables<'daily_question'>>();
  moods?.forEach((mood) => {
    const key = isoDate(new Date(mood.created_at ?? `${start}T00:00:00Z`));
    moodMap.set(key, mood);
  });

  return summaries.map((summary) => ({
    summary,
    mood: moodMap.get(summary.date) ?? null
  }));
}

export const countEmotions = (aggregates: DailyAggregate[]) => {
  const tally = new Map<string, number>();

  aggregates.forEach(({ summary, mood }) => {
    summary.dominant_emotions?.forEach((emotion) => {
      tally.set(emotion, (tally.get(emotion) ?? 0) + 1);
    });
    mood?.emotions?.forEach((emotion) => {
      tally.set(emotion, (tally.get(emotion) ?? 0) + 1);
    });
  });

  return Array.from(tally.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([emotion]) => emotion);
};

export const sumEntries = (aggregates: DailyAggregate[]) =>
  aggregates.reduce(
    (total, { summary }) => total + (summary.entry_count ?? 0),
    0
  );
