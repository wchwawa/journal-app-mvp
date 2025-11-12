'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, HashIcon, SearchIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import DailyRecordList from './daily-record-list';
import type { Tables } from '@/types/supabase';

type DailySummaryWithJournals = Tables<'daily_summaries'> & {
  journals: Array<
    Tables<'audio_files'> & {
      transcripts: Array<
        Pick<
          Tables<'transcripts'>,
          'id' | 'text' | 'rephrased_text' | 'language' | 'created_at'
        >
      >;
    }
  >;
  dailyMood: Tables<'daily_question'> | null;
};

type JournalsResponse = {
  data: DailySummaryWithJournals[];
  totalCount: number;
};

export default function JournalListPage() {
  const { user } = useUser();
  const [journals, setJournals] = useState<DailySummaryWithJournals[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    mood: 'all',
    keyword: ''
  });

  const limit = 10;

  const fetchJournals = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const moodFilter =
        filters.mood && filters.mood !== 'all' ? filters.mood : undefined;

      const response = await fetch('/api/journals/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startDate: filters.startDate || null,
          endDate: filters.endDate || null,
          moods: moodFilter ? [moodFilter] : undefined,
          keyword: filters.keyword || null,
          page,
          limit
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = (await response.json()) as JournalsResponse;
      setJournals(result.data ?? []);
      setTotalCount(result.totalCount ?? 0);
    } catch (error) {
      console.error('Error fetching journals:', error);
      setJournals([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [user?.id, filters, page, limit]);

  useEffect(() => {
    if (user?.id) {
      fetchJournals();
    }
  }, [user?.id, fetchJournals]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filters change
  };

  const handleSearch = () => {
    setPage(1);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const totalPages = Math.ceil(totalCount / limit);

  if (loading && journals.length === 0) {
    return (
      <div className='space-y-4'>
        <Card className='p-4'>
          <div className='flex flex-wrap gap-4'>
            <Skeleton className='h-10 w-48' />
            <Skeleton className='h-10 w-32' />
            <Skeleton className='h-10 w-64' />
          </div>
        </Card>
        <div className='space-y-3'>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className='h-24 w-full' />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Filters */}
      <Card className='p-4'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
          {/* Date Range */}
          <div className='space-y-2'>
            <Label className='flex items-center gap-2 text-sm font-medium'>
              <CalendarIcon className='h-4 w-4' />
              Start Date
            </Label>
            <Input
              type='date'
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className='w-full'
            />
          </div>

          <div className='space-y-2'>
            <Label className='flex items-center gap-2 text-sm font-medium'>
              <CalendarIcon className='h-4 w-4' />
              End Date
            </Label>
            <Input
              type='date'
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className='w-full'
            />
          </div>

          {/* Mood Filter */}
          <div className='space-y-2'>
            <Label className='flex items-center gap-2 text-sm font-medium'>
              <HashIcon className='h-4 w-4' />
              Mood
            </Label>
            <Select
              value={filters.mood}
              onValueChange={(value) =>
                handleFilterChange('mood', value === 'all' ? '' : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder='All moods' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All moods</SelectItem>
                <SelectItem value='Good day'>Good day</SelectItem>
                <SelectItem value='Bad day'>Bad day</SelectItem>
                <SelectItem value='Just so so'>Just so so</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Keyword Search */}
          <div className='space-y-2'>
            <Label className='flex items-center gap-2 text-sm font-medium'>
              <SearchIcon className='h-4 w-4' />
              Search
            </Label>
            <div className='flex gap-2'>
              <Input
                type='text'
                placeholder='Search journals...'
                value={filters.keyword}
                onChange={(e) => handleFilterChange('keyword', e.target.value)}
                onKeyPress={handleKeyPress}
                className='flex-1'
              />
              <Button onClick={handleSearch} size='icon'>
                <SearchIcon className='h-4 w-4' />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Journal List */}
      {journals.length === 0 ? (
        <Card className='p-8 text-center'>
          <p className='text-muted-foreground'>No journal entries found.</p>
          <p className='text-muted-foreground mt-2 text-sm'>
            Start recording your thoughts to see them here!
          </p>
        </Card>
      ) : (
        <>
          <DailyRecordList records={journals} onUpdate={fetchJournals} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='mt-6 flex justify-center gap-2'>
              <Button
                variant='outline'
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className='flex items-center px-4'>
                Page {page} of {totalPages}
              </span>
              <Button
                variant='outline'
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
