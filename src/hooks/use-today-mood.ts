'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import type { MoodEntry } from '@/lib/data/repository';

interface UseTodayMoodReturn {
  moodEntry: MoodEntry | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTodayMood(): UseTodayMoodReturn {
  const { user } = useUser();
  const [moodEntry, setMoodEntry] = useState<MoodEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMoodEntry = useCallback(async () => {
    if (!user?.id) {
      setMoodEntry(null);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await fetch('/api/mood/today');
      if (!response.ok) {
        throw new Error('Failed to fetch mood entry');
      }
      const payload = (await response.json()) as { mood: MoodEntry | null };
      setMoodEntry(payload.mood);
    } catch (err) {
      console.error('Error fetching mood entry:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to fetch mood entry'
      );
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchMoodEntry();
  }, [fetchMoodEntry]);

  useEffect(() => {
    fetchMoodEntry();
  }, [fetchMoodEntry]);

  // Listen for mood entry updates
  useEffect(() => {
    const handleMoodUpdate = () => {
      refetch();
    };

    window.addEventListener('moodEntryUpdated', handleMoodUpdate);
    return () => {
      window.removeEventListener('moodEntryUpdated', handleMoodUpdate);
    };
  }, [refetch]);

  return {
    moodEntry,
    isLoading,
    error,
    refetch
  };
}
