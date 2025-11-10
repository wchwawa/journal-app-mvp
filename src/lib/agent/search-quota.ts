import { getLocalDayRange } from '@/lib/timezone';

const MAX_SEARCHES_PER_DAY = 5;

interface UsageRecord {
  date: string;
  count: number;
}

const usage = new Map<string, UsageRecord>();

export const canUseSearch = (userId: string) => {
  const today = getLocalDayRange().date;
  const record = usage.get(userId);

  if (!record || record.date !== today) {
    usage.set(userId, { date: today, count: 0 });
    return { allowed: true, remaining: MAX_SEARCHES_PER_DAY };
  }

  const remaining = Math.max(MAX_SEARCHES_PER_DAY - record.count, 0);
  return { allowed: record.count < MAX_SEARCHES_PER_DAY, remaining };
};

export const recordSearchUsage = (userId: string) => {
  const today = getLocalDayRange().date;
  const record = usage.get(userId);

  if (!record || record.date !== today) {
    usage.set(userId, { date: today, count: 1 });
    return { remaining: MAX_SEARCHES_PER_DAY - 1 };
  }

  record.count += 1;
  usage.set(userId, record);
  return { remaining: Math.max(MAX_SEARCHES_PER_DAY - record.count, 0) };
};
