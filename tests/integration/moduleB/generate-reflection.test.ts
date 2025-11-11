import { beforeEach, describe, expect, it, vi } from 'vitest';
import type OpenAI from 'openai';
import type { Tables, TablesUpdate } from '@/types/supabase';
import { generateReflection } from '@/lib/reflections/generator';
import {
  fetchDailyAggregate,
  fetchAggregatesInRange,
  countEmotions
} from '@/lib/reflections/aggregate';

vi.mock('@/lib/reflections/aggregate', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/reflections/aggregate')
  >('@/lib/reflections/aggregate');
  return {
    ...actual,
    fetchDailyAggregate: vi.fn(),
    fetchAggregatesInRange: vi.fn(),
    countEmotions: vi.fn()
  };
});

type DailySummaryRow = Tables<'daily_summaries'>;
type DailyMoodRow = Tables<'daily_question'>;

const baseSummary = (): DailySummaryRow => ({
  id: 'summary-1',
  user_id: 'user-1',
  date: '2025-11-11',
  summary: 'Reflected on momentum',
  achievements: ['Manual win'],
  commitments: ['Manual focus'],
  mood_overall: 'hopeful',
  mood_quality: 'good',
  mood_reason: 'Great coaching session',
  flashback: 'First journaling streak',
  stats: null,
  entry_count: 2,
  dominant_emotions: ['Happy'],
  edited: true,
  last_generated_at: '2025-11-10T23:00:00Z',
  gen_version: 'module-b-v0',
  created_at: null,
  updated_at: null
});

const baseMood = (): DailyMoodRow => ({
  id: 'mood-1',
  user_id: 'user-1',
  day_quality: 'good',
  emotions: ['Happy', 'Calm'],
  created_at: '2025-11-11T08:00:00Z',
  updated_at: null
});

// Minimal Supabase client stub that captures the latest update payload.
const makeSupabaseStub = () => {
  let lastUpdate: TablesUpdate<'daily_summaries'> | null = null;
  const stub = {
    from: (table: string) => {
      if (table !== 'daily_summaries') {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        update: (payload: TablesUpdate<'daily_summaries'>) => {
          lastUpdate = payload;
          return {
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    ...baseSummary(),
                    ...payload,
                    achievements:
                      payload.achievements ?? baseSummary().achievements,
                    commitments:
                      payload.commitments ?? baseSummary().commitments,
                    mood_overall:
                      payload.mood_overall ?? baseSummary().mood_overall,
                    mood_reason:
                      payload.mood_reason ?? baseSummary().mood_reason,
                    flashback: payload.flashback ?? baseSummary().flashback,
                    stats: payload.stats ?? null,
                    edited: payload.edited ?? baseSummary().edited,
                    last_generated_at:
                      payload.last_generated_at ??
                      baseSummary().last_generated_at
                  }
                })
              })
            })
          };
        }
      };
    }
  };
  return { stub: stub as any, getLastUpdate: () => lastUpdate };
};

const openaiStub = {
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                achievements: [
                  'Shipped daily recap',
                  'Finished prompts',
                  'Win 3',
                  'Win 4'
                ],
                commitments: [
                  'Keep journaling',
                  'Stretch habit',
                  'Call friend',
                  'Commit 4'
                ],
                mood: {
                  overall: 'reflective',
                  reason: 'Spent the evening writing'
                },
                flashback: 'Notebook felt lighter tonight',
                stats: {
                  keywords: [
                    'reflection',
                    'gratitude',
                    'voice',
                    'streak',
                    'focus',
                    'sleep',
                    'walk',
                    'sunset',
                    'wave'
                  ]
                }
              })
            }
          }
        ]
      })
    }
  }
} as unknown as OpenAI;

const fetchDailyAggregateMock = vi.mocked(fetchDailyAggregate);
const fetchAggregatesInRangeMock = vi.mocked(fetchAggregatesInRange);
const countEmotionsMock = vi.mocked(countEmotions);

beforeEach(() => {
  vi.clearAllMocks();
  fetchDailyAggregateMock.mockResolvedValue({
    summary: baseSummary(),
    mood: baseMood()
  });
  fetchAggregatesInRangeMock.mockResolvedValue([
    { summary: baseSummary(), mood: baseMood() }
  ]);
  countEmotionsMock.mockReturnValue(['Happy', 'Calm']);
});

describe('generateReflection – daily mode', () => {
  it('keeps edited content while updating stats + metadata', async () => {
    const { stub: supabase, getLastUpdate } = makeSupabaseStub();

    const card = await generateReflection({
      supabase,
      openai: openaiStub,
      userId: 'user-1',
      mode: 'daily',
      anchorDate: '2025-11-11'
    });

    const payload = getLastUpdate();
    expect(payload).toBeTruthy();
    expect(payload?.achievements).toEqual(['Manual win']);
    expect(payload?.commitments).toEqual(['Manual focus']);
    expect(payload?.mood_overall).toBe('hopeful');
    expect(payload?.gen_version).toBe('module-b-v1');
    expect(payload?.stats).toBeTruthy();

    expect(card.period.date).toBe('2025-11-11');
    expect(card.achievements).toEqual(['Manual win']);
    expect(card.commitments).toEqual(['Manual focus']);
    expect(card.moodOverall).toBe('hopeful');
    expect(card.stats?.keywords).toHaveLength(8); // trimmed to max 8
  });
});
