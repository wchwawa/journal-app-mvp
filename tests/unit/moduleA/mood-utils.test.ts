import { describe, expect, it } from 'vitest';
import {
  formatDayQuality,
  formatEmotions,
  getMoodDisplayData
} from '@/lib/mood-utils';
import type { Tables } from '@/types/supabase';

const buildMoodEntry = (overrides: Partial<Tables<'daily_question'>> = {}) => ({
  id: 'row-1',
  user_id: 'user-1',
  day_quality: 'good',
  emotions: ['Happy'],
  created_at: '2025-01-01T00:00:00Z',
  updated_at: null,
  ...overrides
});

describe('mood utils', () => {
  it('normalizes canonical day quality labels', () => {
    expect(formatDayQuality('good')).toBe('Good day');
    expect(formatDayQuality('bad')).toBe('Bad day');
    expect(formatDayQuality('so-so')).toBe('Just so so');
    expect(formatDayQuality('custom')).toBe('custom');
  });

  it('summarizes emotion arrays with friendly copy', () => {
    expect(formatEmotions([])).toBe('');
    expect(formatEmotions(['Happy'])).toBe('Happy');
    expect(formatEmotions(['Happy', 'Calm'])).toBe('Happy & Calm');
    expect(formatEmotions(['Happy', 'Calm', 'Grateful'])).toBe(
      'Happy, Calm +1'
    );
  });

  it('reports placeholder data when no entry exists', () => {
    const display = getMoodDisplayData(null);
    expect(display).toEqual({
      primaryText: '-',
      secondaryText: 'Complete daily check-in',
      hasData: false,
      dayQuality: null,
      emotions: []
    });
  });

  it('exposes underlying mood + emotion data for consumers', () => {
    const entry = buildMoodEntry({
      day_quality: 'bad',
      emotions: ['Anxious', 'Tired', 'Overstimulated']
    });
    const display = getMoodDisplayData(entry);

    expect(display.primaryText).toBe('Bad day');
    expect(display.secondaryText).toBe('Anxious, Tired +1');
    expect(display.hasData).toBe(true);
    expect(display.dayQuality).toBe('bad');
    expect(display.emotions).toEqual(['Anxious', 'Tired', 'Overstimulated']);
  });
});
