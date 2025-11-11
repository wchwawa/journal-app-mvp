import { describe, expect, it } from 'vitest';
import { getLocalDayRange, getUtcRangeForDate } from '@/lib/timezone';

describe('timezone helpers', () => {
  it('returns stable local YMD + UTC range across DST rollback', () => {
    const mockDate = new Date('2025-04-06T00:30:00+11:00'); // Sydney DST end
    const { date, start, end } = getLocalDayRange({
      date: mockDate,
      timeZone: 'Australia/Sydney'
    });

    expect(date).toBe('2025-04-06');
    expect(start).toBe('2025-04-05T14:00:00.000Z');
    expect(end).toBe('2025-04-06T14:00:00.998Z');
  });

  it('computes UTC bounds for an arbitrary calendar date', () => {
    const { start, end } = getUtcRangeForDate('2025-11-15', 'Australia/Sydney');

    expect(start).toBe('2025-11-14T13:00:00.000Z');
    expect(end).toBe('2025-11-15T13:00:00.998Z');
  });
});
