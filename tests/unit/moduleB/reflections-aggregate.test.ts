import { describe, expect, it } from 'vitest';
import {
  getPeriodBounds,
  resolveAnchorDate,
  countEmotions,
  sumEntries
} from '@/lib/reflections/aggregate';
import type { DailyAggregate } from '@/lib/reflections/aggregate';

const makeAggregate = (
  date: string,
  summaryExtras: Partial<DailyAggregate['summary']> = {},
  moodEmotions: string[] = []
): DailyAggregate => ({
  summary: {
    id: `summary-${date}`,
    date,
    summary: `Summary for ${date}`,
    achievements: null,
    commitments: null,
    created_at: null,
    dominant_emotions: summaryExtras.dominant_emotions ?? [],
    edited: false,
    entry_count: summaryExtras.entry_count ?? 1,
    flashback: null,
    gen_version: null,
    last_generated_at: null,
    mood_overall: null,
    mood_quality: null,
    mood_reason: null,
    stats: null,
    updated_at: null,
    user_id: 'user-1',
    ...summaryExtras
  },
  mood: {
    id: `mood-${date}`,
    user_id: 'user-1',
    day_quality: 'good',
    emotions: moodEmotions,
    created_at: `${date}T08:00:00Z`,
    updated_at: null
  }
});

describe('reflections aggregate helpers', () => {
  it('resolves anchor date defaults to today', () => {
    const explicit = resolveAnchorDate('2025-11-11');
    expect(explicit).toBe('2025-11-11');
  });

  it('computes daily/weekly/monthly period bounds', () => {
    expect(getPeriodBounds('daily', '2025-11-11')).toEqual({
      start: '2025-11-11',
      end: '2025-11-11'
    });

    expect(getPeriodBounds('weekly', '2025-11-13')).toEqual({
      start: '2025-11-10',
      end: '2025-11-16'
    });

    expect(getPeriodBounds('monthly', '2025-11-13')).toEqual({
      start: '2025-11-01',
      end: '2025-11-30'
    });
  });

  it('counts emotions across summaries and moods', () => {
    const aggregates: DailyAggregate[] = [
      makeAggregate('2025-11-11', { dominant_emotions: ['Happy', 'Calm'] }),
      makeAggregate('2025-11-12', {}, ['Calm', 'Focused'])
    ];
    expect(countEmotions(aggregates)).toEqual(['Calm', 'Happy', 'Focused']);
  });

  it('sums entries across aggregates', () => {
    const aggregates: DailyAggregate[] = [
      makeAggregate('2025-11-11', { entry_count: 2 }),
      makeAggregate('2025-11-12', { entry_count: 3 })
    ];
    expect(sumEntries(aggregates)).toBe(5);
  });
});
