'use client';

import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { useAudioJournal } from '@/hooks/use-audio-journal';
import { Loader2 } from 'lucide-react';

// export const metadata = {
//   title: 'Dashboard: Journal Stats'
// };

function StatsGrid() {
  const { stats, statsLoading, todayEntries } = useAudioJournal();

  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      <div className='group bg-muted/20 hover:bg-muted/30 border-border/30 rounded-2xl border p-6 transition-all duration-300'>
        <div className='space-y-2'>
          <p className='text-muted-foreground text-sm font-medium'>
            Total entries
          </p>
          <p className='text-foreground text-3xl font-bold'>
            {statsLoading ? (
              <Loader2 className='h-8 w-8 animate-spin' />
            ) : (
              stats.totalEntries
            )}
          </p>
          <p className='text-muted-foreground text-xs'>
            Voice & mood entries recorded so far
          </p>
        </div>
      </div>

      <div className='group bg-muted/20 hover:bg-muted/30 border-border/30 rounded-2xl border p-6 transition-all duration-300'>
        <div className='space-y-2'>
          <p className='text-muted-foreground text-sm font-medium'>This week</p>
          <p className='text-foreground text-3xl font-bold'>
            {statsLoading ? (
              <Loader2 className='h-8 w-8 animate-spin' />
            ) : (
              stats.thisWeekEntries
            )}
          </p>
          <p className='text-muted-foreground text-xs'>
            Entries captured since Monday
          </p>
        </div>
      </div>

      <div className='group bg-muted/20 hover:bg-muted/30 border-border/30 rounded-2xl border p-6 transition-all duration-300'>
        <div className='space-y-2'>
          <p className='text-muted-foreground text-sm font-medium'>Streak</p>
          <p className='text-foreground text-3xl font-bold'>
            {statsLoading ? (
              <Loader2 className='h-8 w-8 animate-spin' />
            ) : (
              stats.currentStreak
            )}
          </p>
          <p className='text-muted-foreground text-xs'>
            Consecutive days with at least one entry
          </p>
        </div>
      </div>

      <div className='group bg-muted/20 hover:bg-muted/30 border-border/30 rounded-2xl border p-6 transition-all duration-300'>
        <div className='space-y-2'>
          <p className='text-muted-foreground text-sm font-medium'>Today</p>
          <p className='text-foreground text-3xl font-bold'>
            {statsLoading ? (
              <Loader2 className='h-8 w-8 animate-spin' />
            ) : (
              todayEntries.length
            )}
          </p>
          <p className='text-muted-foreground text-xs'>
            Voice entries recorded today
          </p>
        </div>
      </div>
    </div>
  );
}

export default function JournalStatsPage() {
  return (
    <PageContainer scrollable={true}>
      <div className='flex flex-1 flex-col space-y-4'>
        <Heading
          title='Journal Stats'
          description='Track how consistently you capture moods and voice entries.'
        />
        <Separator />
        <StatsGrid />
      </div>
    </PageContainer>
  );
}
