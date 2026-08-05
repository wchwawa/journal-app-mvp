import { addDays, endOfMonth, startOfMonth } from 'date-fns';
import type {
  DailySummary,
  JournalDataRepository,
  MoodEntry
} from '@/lib/data';
import type { ReflectionMode } from './types';

export interface DailyAggregate {
  summary: DailySummary;
  mood?: MoodEntry | null;
}

// Format a Date as YYYY-MM-DD in LOCAL time (do not convert to UTC)
export const localYmd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const resolveAnchorDate = (anchorDate?: string) => {
  if (anchorDate) return anchorDate;
  return localYmd(new Date());
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
    // Use LOCAL week boundaries: Monday .. Sunday
    const dow = date.getDay(); // 0 (Sun) .. 6 (Sat)
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    const monday = addDays(new Date(date), diffToMonday);
    const sunday = addDays(new Date(monday), 6);
    return {
      start: localYmd(monday),
      end: localYmd(sunday)
    };
  }

  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return { start: localYmd(start), end: localYmd(end) };
};

export async function fetchDailyAggregate(
  repo: JournalDataRepository,
  userId: string,
  date: string
): Promise<DailyAggregate | null> {
  let summary: DailySummary | null;
  try {
    summary = await repo.getDailySummary(userId, date);
  } catch (error) {
    console.error('Failed to fetch daily summary', error);
    throw error;
  }

  if (!summary) return null;

  let mood: MoodEntry | null;
  try {
    // Day boundaries resolved through timezone.ts inside the repository
    // (replaces the previous bare `${date}T00:00:00` bounds).
    mood = await repo.getMood(userId, date);
  } catch (error) {
    console.error('Failed to fetch daily mood', error);
    throw error;
  }

  return {
    summary,
    mood: mood ?? null
  };
}

export async function fetchAggregatesInRange(
  repo: JournalDataRepository,
  userId: string,
  start: string,
  end: string
): Promise<DailyAggregate[]> {
  let summaries: DailySummary[];
  try {
    summaries = await repo.listDailySummariesInRange(userId, start, end);
  } catch (error) {
    console.error('Failed to fetch summaries range', error);
    throw error;
  }

  if (summaries.length === 0) {
    return [];
  }

  let moods: MoodEntry[];
  try {
    moods = await repo.listMoodsInRange(userId, start, end);
  } catch (error) {
    console.error('Failed to fetch moods range', error);
    throw error;
  }

  const moodMap = new Map<string, MoodEntry>();
  moods.forEach((mood) => {
    moodMap.set(mood.date, mood);
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
