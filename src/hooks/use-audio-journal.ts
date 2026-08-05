'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';

// Wire shape returned by GET /api/journals/today (mirrors the audio_files +
// transcripts rows the browser previously read from Supabase directly).
interface AudioJournalTranscript {
  id: string;
  text: string | null;
  rephrased_text: string | null;
  language: string | null;
  created_at: string | null;
}

interface AudioJournalWithTranscript {
  id: string;
  user_id: string;
  storage_path: string;
  mime_type: string | null;
  duration_ms: number | null;
  created_at: string | null;
  transcripts: AudioJournalTranscript[];
}

interface AudioJournalStats {
  totalEntries: number;
  thisWeekEntries: number;
  currentStreak: number;
}

interface UseAudioJournalReturn {
  // Today's entries
  todayEntries: AudioJournalWithTranscript[];
  todayLoading: boolean;
  todayError: string | null;

  // Stats
  stats: AudioJournalStats;
  statsLoading: boolean;
  statsError: string | null;

  // Actions
  refetchAll: () => Promise<void>;
  refetchToday: () => Promise<void>;
  refetchStats: () => Promise<void>;
}

export function useAudioJournal(): UseAudioJournalReturn {
  const { user } = useUser();

  // Today's entries state
  const [todayEntries, setTodayEntries] = useState<
    AudioJournalWithTranscript[]
  >([]);
  const [todayLoading, setTodayLoading] = useState(true);
  const [todayError, setTodayError] = useState<string | null>(null);

  // Stats state
  const [stats, setStats] = useState<AudioJournalStats>({
    totalEntries: 0,
    thisWeekEntries: 0,
    currentStreak: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Fetch today's entries
  const fetchTodayEntries = useCallback(async () => {
    if (!user?.id) {
      setTodayEntries([]);
      setTodayLoading(false);
      return;
    }

    try {
      setTodayError(null);
      const response = await fetch('/api/journals/today');
      if (!response.ok) {
        throw new Error('Failed to fetch today audio entries');
      }
      const payload = (await response.json()) as {
        entries: AudioJournalWithTranscript[];
      };
      setTodayEntries(payload.entries);
    } catch (err) {
      console.error('Error fetching today audio entries:', err);
      setTodayError(
        err instanceof Error
          ? err.message
          : 'Failed to fetch today audio entries'
      );
    } finally {
      setTodayLoading(false);
    }
  }, [user?.id]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!user?.id) {
      setStats({ totalEntries: 0, thisWeekEntries: 0, currentStreak: 0 });
      setStatsLoading(false);
      return;
    }

    try {
      setStatsError(null);
      const response = await fetch('/api/journals/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch audio journal stats');
      }
      const payload = (await response.json()) as { stats: AudioJournalStats };
      setStats(payload.stats);
    } catch (err) {
      console.error('Error fetching audio journal stats:', err);
      setStatsError(
        err instanceof Error
          ? err.message
          : 'Failed to fetch audio journal stats'
      );
    } finally {
      setStatsLoading(false);
    }
  }, [user?.id]);

  // Refetch functions
  const refetchToday = useCallback(async () => {
    setTodayLoading(true);
    await fetchTodayEntries();
  }, [fetchTodayEntries]);

  const refetchStats = useCallback(async () => {
    setStatsLoading(true);
    await fetchStats();
  }, [fetchStats]);

  const refetchAll = useCallback(async () => {
    setTodayLoading(true);
    setStatsLoading(true);

    await Promise.all([fetchTodayEntries(), fetchStats()]);
  }, [fetchTodayEntries, fetchStats]);

  // Initial fetch
  useEffect(() => {
    fetchTodayEntries();
    fetchStats();
  }, [fetchTodayEntries, fetchStats]);

  // Listen for audio journal updates
  useEffect(() => {
    const handleAudioJournalUpdate = () => {
      refetchAll();
    };

    window.addEventListener('audioJournalUpdated', handleAudioJournalUpdate);
    return () => {
      window.removeEventListener(
        'audioJournalUpdated',
        handleAudioJournalUpdate
      );
    };
  }, [refetchAll]);

  return {
    todayEntries,
    todayLoading,
    todayError,
    stats,
    statsLoading,
    statsError,
    refetchAll,
    refetchToday,
    refetchStats
  };
}
