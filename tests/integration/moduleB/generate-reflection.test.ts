import { beforeEach, describe, expect, it, vi } from 'vitest';
import type OpenAI from 'openai';
import type {
  DailySummary,
  JournalDataRepository,
  MoodEntry
} from '@/lib/data/repository';
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

const baseSummary = (): DailySummary => ({
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

const baseMood = (): MoodEntry => ({
  id: 'mood-1',
  date: '2025-11-11',
  day_quality: 'good',
  emotions: ['Happy', 'Calm'],
  created_at: '2025-11-11T08:00:00Z',
  updated_at: null
});

// Repo stub that applies the preserveIfEdited contract exactly like the real
// repositories: user-owned fields survive, generation metadata advances.
const makeRepoStub = () => {
  const updateDailySummaryReflection = vi.fn(
    async (
      _userId: string,
      _date: string,
      patch: Record<string, unknown>,
      opts: { preserveIfEdited?: boolean; markEdited?: boolean }
    ): Promise<DailySummary> => {
      const existing = baseSummary();
      const preserved = Boolean(opts.preserveIfEdited && existing.edited);
      return {
        ...existing,
        ...(preserved
          ? {
              stats: (patch.stats as DailySummary['stats']) ?? existing.stats,
              gen_version:
                (patch.gen_version as string) ?? existing.gen_version,
              last_generated_at:
                (patch.last_generated_at as string) ??
                existing.last_generated_at
            }
          : patch)
      };
    }
  );
  const stub = {
    updateDailySummaryReflection
  } as unknown as JournalDataRepository;
  return { stub, updateDailySummaryReflection };
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
  it('requests preserveIfEdited and keeps edited content in the card', async () => {
    const { stub, updateDailySummaryReflection } = makeRepoStub();

    const card = await generateReflection({
      repo: stub,
      openai: openaiStub,
      userId: 'user-1',
      mode: 'daily',
      anchorDate: '2025-11-11'
    });

    expect(updateDailySummaryReflection).toHaveBeenCalledTimes(1);
    const [, date, patch, opts] = updateDailySummaryReflection.mock.calls[0];
    expect(date).toBe('2025-11-11');
    expect(opts).toEqual({ preserveIfEdited: true });
    // Machine output flows into the patch (repo decides what survives)...
    expect(patch.gen_version).toBe('module-b-v1');
    expect(patch.stats).toBeTruthy();
    expect((patch.stats as { keywords: string[] }).keywords).toHaveLength(8); // trimmed to max 8

    // ...while the edited row keeps user content in the projected card.
    expect(card.period.date).toBe('2025-11-11');
    expect(card.achievements).toEqual(['Manual win']);
    expect(card.commitments).toEqual(['Manual focus']);
    expect(card.moodOverall).toBe('hopeful');
  });
});
