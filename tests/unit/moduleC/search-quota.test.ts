import { describe, expect, beforeEach, it, vi } from 'vitest';

let currentDate = '2025-11-11';
vi.mock('@/lib/timezone', () => ({
  getLocalDayRange: () => ({
    date: currentDate,
    start: `${currentDate}T00:00:00.000Z`,
    end: `${currentDate}T23:59:59.999Z`
  })
}));

describe('search quota helper', () => {
  beforeEach(() => {
    currentDate = '2025-11-11';
  });

  const quotaPromise = import('@/lib/agent/search-quota');

  it('allows up to five searches per day', async () => {
    const quota = await quotaPromise;
    const first = quota.canUseSearch('user-alpha');
    expect(first).toEqual({ allowed: true, remaining: 5 });

    for (let i = 0; i < 5; i += 1) {
      const { remaining } = quota.recordSearchUsage('user-alpha');
      expect(remaining).toBe(Math.max(4 - i, 0));
    }

    const afterLimit = quota.canUseSearch('user-alpha');
    expect(afterLimit).toEqual({ allowed: false, remaining: 0 });
  });

  it('resets remaining quota when local date changes', async () => {
    const quota = await quotaPromise;
    quota.recordSearchUsage('user-beta');
    expect(quota.canUseSearch('user-beta').remaining).toBe(4);

    currentDate = '2025-11-12';
    const refreshed = quota.canUseSearch('user-beta');
    expect(refreshed).toEqual({ allowed: true, remaining: 5 });
  });
});
