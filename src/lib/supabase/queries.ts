import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cache } from 'react';

// Type for the Supabase client with your database schema
type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Get today's mood entry for the specified user
 * @param supabase - Supabase client instance
 * @param userId - User ID
 * @returns Today's mood entry or null if not exists
 */
export const getTodayMoodEntry = cache(
  async (supabase: TypedSupabaseClient, userId: string) => {
    if (!userId) return null;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('daily_question')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .single();

    if (error && error.code === 'PGRST116') {
      // No entry found for today
      return null;
    }

    if (error) {
      console.error('Error fetching today mood entry:', error);
      return null;
    }

    return data;
  }
);

/**
 * Get recent audio journal entries for the specified user
 * @param supabase - Supabase client instance
 * @param userId - User ID
 * @param limit - Number of entries to fetch (default: 10)
 * @returns Recent audio journal entries with transcripts
 */
export const getRecentAudioJournals = cache(
  async (supabase: TypedSupabaseClient, userId: string, limit: number = 10) => {
    if (!userId) return [];

    const { data, error } = await supabase
      .from('audio_files')
      .select(
        `
        *,
        transcripts (
          id,
          text,
          language,
          created_at
        )
      `
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching audio journals:', error);
      return [];
    }

    return data;
  }
);

/**
 * Get today's audio journal entries for the specified user
 * @param supabase - Supabase client instance
 * @param userId - User ID
 * @returns Today's audio journal entries
 */
export const getTodayAudioJournals = cache(
  async (supabase: TypedSupabaseClient, userId: string) => {
    if (!userId) return [];

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('audio_files')
      .select(
        `
        *,
        transcripts (
          id,
          text,
          language,
          created_at
        )
      `
      )
      .eq('user_id', userId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching today audio journals:', error);
      return [];
    }

    return data;
  }
);

/**
 * Get audio journal stats for the specified user
 * @param supabase - Supabase client instance
 * @param userId - User ID
 * @returns Audio journal statistics
 */
export const getAudioJournalStats = cache(
  async (supabase: TypedSupabaseClient, userId: string) => {
    if (!userId)
      return { totalEntries: 0, thisWeekEntries: 0, currentStreak: 0 };

    // Get total entries
    const { count: totalEntries, error: totalError } = await supabase
      .from('audio_files')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (totalError) {
      console.error('Error fetching total audio entries:', totalError);
    }

    // Get this week's entries
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const { count: thisWeekEntries, error: weekError } = await supabase
      .from('audio_files')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', weekStart.toISOString());

    if (weekError) {
      console.error('Error fetching week audio entries:', weekError);
    }

    // Calculate current streak (simplified - consecutive days with entries)
    const { data: recentEntries, error: recentError } = await supabase
      .from('audio_files')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);

    let currentStreak = 0;
    if (!recentError && recentEntries) {
      const today = new Date();
      const dates = new Set(
        recentEntries.map(
          (entry) => new Date(entry.created_at!).toISOString().split('T')[0]
        )
      );

      for (let i = 0; i < 30; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        const dateString = checkDate.toISOString().split('T')[0];

        if (dates.has(dateString)) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    return {
      totalEntries: totalEntries || 0,
      thisWeekEntries: thisWeekEntries || 0,
      currentStreak
    };
  }
);

/**
 * Get journals with daily summaries for the specified user
 * @param supabase - Supabase client instance
 * @param userId - User ID
 * @param options - Query options for filtering and pagination
 * @returns Array of daily records with journals and summaries
 */
export const getJournalsWithSummaries = cache(
  async (
    supabase: TypedSupabaseClient,
    userId: string,
    options?: {
      startDate?: string;
      endDate?: string;
      moods?: string[];
      keyword?: string;
      page?: number;
      limit?: number;
    }
  ) => {
    if (!userId) return { data: [], totalCount: 0 };

    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const offset = (page - 1) * limit;

    // Build the query for daily summaries
    let summariesQuery = supabase
      .from('daily_summaries')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    // Apply date filters
    if (options?.startDate) {
      summariesQuery = summariesQuery.gte('date', options.startDate);
    }
    if (options?.endDate) {
      summariesQuery = summariesQuery.lte('date', options.endDate);
    }

    // Apply mood filters
    if (options?.moods && options.moods.length > 0) {
      summariesQuery = summariesQuery.in('mood_quality', options.moods);
    }

    // Apply keyword search in summary
    if (options?.keyword) {
      summariesQuery = summariesQuery.ilike('summary', `%${options.keyword}%`);
    }

    // Execute query with pagination
    const {
      data: summaries,
      error: summariesError,
      count
    } = await summariesQuery
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (summariesError) {
      console.error('Error fetching journal summaries:', summariesError);
      return { data: [], totalCount: 0 };
    }

    // For each summary, fetch the corresponding journal entries
    const journalsWithSummaries = await Promise.all(
      (summaries || []).map(async (summary) => {
        const startOfDay = new Date(summary.date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(summary.date);
        endOfDay.setHours(23, 59, 59, 999);

        const { data: journals, error: journalsError } = await supabase
          .from('audio_files')
          .select(
            `
            *,
            transcripts (
              id,
              text,
              rephrased_text,
              language,
              created_at
            )
          `
          )
          .eq('user_id', userId)
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString())
          .order('created_at', { ascending: true });

        if (journalsError) {
          console.error(
            'Error fetching journals for date:',
            summary.date,
            journalsError
          );
        }

        // Also fetch the daily mood for this date
        const { data: moodData } = await supabase
          .from('daily_question')
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString())
          .single();

        return {
          ...summary,
          journals: journals || [],
          dailyMood: moodData || null
        };
      })
    );

    return {
      data: journalsWithSummaries,
      totalCount: count || 0
    };
  }
);

/**
 * Get a specific daily summary
 * @param supabase - Supabase client instance
 * @param userId - User ID
 * @param date - Date string (YYYY-MM-DD)
 * @returns Daily summary or null
 */
export const getDailySummary = cache(
  async (supabase: TypedSupabaseClient, userId: string, date: string) => {
    if (!userId || !date) return null;

    const { data, error } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    if (error && error.code === 'PGRST116') {
      // No summary found for this date
      return null;
    }

    if (error) {
      console.error('Error fetching daily summary:', error);
      return null;
    }

    return data;
  }
);

/**
 * Search journals by keyword in transcripts
 * @param supabase - Supabase client instance
 * @param userId - User ID
 * @param keyword - Search keyword
 * @param limit - Number of results to return
 * @returns Array of matching journal entries
 */
export const searchJournals = cache(
  async (
    supabase: TypedSupabaseClient,
    userId: string,
    keyword: string,
    limit: number = 20
  ) => {
    if (!userId || !keyword) return [];

    const { data, error } = await supabase
      .from('transcripts')
      .select(
        `
        *,
        audio_files!inner(
          id,
          storage_path,
          mime_type,
          created_at
        )
      `
      )
      .eq('user_id', userId)
      .or(`text.ilike.%${keyword}%,rephrased_text.ilike.%${keyword}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error searching journals:', error);
      return [];
    }

    return data;
  }
);
