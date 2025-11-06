export type ReflectionMode = 'daily' | 'weekly' | 'monthly';

export interface ReflectionStats {
  entryCount?: number;
  topEmotions?: string[];
  keywords?: string[];
}

export interface ReflectionPeriod {
  type: ReflectionMode;
  start: string; // ISO date (YYYY-MM-DD)
  end: string; // ISO date (YYYY-MM-DD)
  date?: string; // Only set for daily
}

export interface ReflectionCard {
  recordId?: string;
  period: ReflectionPeriod;
  achievements: string[];
  commitments: string[];
  moodOverall: string | null;
  moodReason: string | null;
  flashback: string | null;
  stats?: ReflectionStats | null;
  edited: boolean;
  lastGeneratedAt: string | null;
  genVersion?: string | null;
}

export interface SyncReflectionPayload {
  mode: ReflectionMode;
  anchorDate?: string; // ISO date
}

export interface PatchDailyReflectionPayload {
  achievements?: string[];
  commitments?: string[];
  moodOverall?: string | null;
  moodReason?: string | null;
  flashback?: string | null;
}

export interface PatchPeriodReflectionPayload
  extends PatchDailyReflectionPayload {}

export const MAX_LISTED_REFLECTIONS = {
  daily: 30,
  weekly: 12,
  monthly: 12
} as const;

export type MaxListedReflections = typeof MAX_LISTED_REFLECTIONS;
