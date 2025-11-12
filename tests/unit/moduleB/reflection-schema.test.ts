import { describe, expect, it } from 'vitest';
import {
  reflectionAISchema,
  patchDailySchema,
  syncPayloadSchema
} from '@/lib/reflections/schema';

describe('reflection schemas', () => {
  it('validates AI JSON payloads and enforces limits', () => {
    const valid = reflectionAISchema.parse({
      achievements: ['Win 1', 'Win 2'],
      commitments: ['Action'],
      mood: { overall: 'reflective', reason: 'Journaling session' },
      flashback: 'Sunset walk',
      stats: { entryCount: 3, topEmotions: ['Calm'], keywords: ['sunset'] }
    });
    expect(valid.achievements).toHaveLength(2);

    expect(() =>
      reflectionAISchema.parse({
        achievements: ['A', 'B', 'C', 'D'],
        commitments: [],
        mood: { overall: null, reason: null },
        flashback: null
      })
    ).toThrowError();
  });

  it('enforces patch schema to have at least one field', () => {
    expect(() => patchDailySchema.parse({})).toThrowError();

    const payload = patchDailySchema.parse({
      achievements: ['Ship MVP']
    });
    expect(payload.achievements).toEqual(['Ship MVP']);
  });

  it('validates sync payloads and anchor dates', () => {
    const parsed = syncPayloadSchema.parse({
      mode: 'weekly',
      anchorDate: '2025-11-13'
    });
    expect(parsed).toEqual({
      mode: 'weekly',
      anchorDate: '2025-11-13'
    });

    expect(() =>
      syncPayloadSchema.parse({ mode: 'weekly', anchorDate: '13-11-2025' })
    ).toThrowError();
  });
});
