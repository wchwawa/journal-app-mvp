import type { Tables } from '@/types/supabase';
import type { ReflectionCard } from './types';

const toPlainStats = (stats: unknown): Record<string, unknown> | null => {
  if (!stats || typeof stats !== 'object') return null;
  return stats as Record<string, unknown>;
};

const ensureArray = (value: string[] | null | undefined) =>
  value?.filter((item) => item && item.trim().length > 0) ?? [];

export const serializeDailyReflection = (
  row: Tables<'daily_summaries'>
): ReflectionCard => ({
  recordId: row.id,
  period: {
    type: 'daily',
    start: row.date,
    end: row.date,
    date: row.date
  },
  achievements: ensureArray(row.achievements),
  commitments: ensureArray(row.commitments),
  moodOverall: row.mood_overall,
  moodReason: row.mood_reason,
  flashback: row.flashback,
  stats: toPlainStats(row.stats),
  edited: row.edited ?? false,
  lastGeneratedAt: row.last_generated_at,
  genVersion: row.gen_version ?? undefined
});

export const serializePeriodReflection = (
  row: Tables<'period_reflections'>
): ReflectionCard => ({
  recordId: row.id,
  period: {
    type: row.period_type as 'weekly' | 'monthly',
    start: row.period_start,
    end: row.period_end
  },
  achievements: ensureArray(row.achievements),
  commitments: ensureArray(row.commitments),
  moodOverall: row.mood_overall,
  moodReason: row.mood_reason,
  flashback: row.flashback,
  stats: toPlainStats(row.stats),
  edited: row.edited ?? false,
  lastGeneratedAt: row.last_generated_at,
  genVersion: row.gen_version ?? undefined
});
