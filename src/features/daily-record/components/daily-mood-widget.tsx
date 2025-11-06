'use client';

import { memo, useCallback } from 'react';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useTodayMood } from '@/hooks/use-today-mood';
import { formatDayQuality, formatEmotions } from '@/lib/mood-utils';
import { getDayQualityIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

const moodHeadline = (dayQuality?: string | null) => {
  if (!dayQuality) return 'No check-in yet';
  return formatDayQuality(dayQuality);
};

const moodSubtitle = (emotions?: string[]) => {
  if (!emotions || emotions.length === 0) {
    return "Tap the icon to log today's mood";
  }
  return formatEmotions(emotions);
};

const DailyMoodWidgetComponent = () => {
  const { moodEntry, isLoading, error, refetch } = useTodayMood();

  const openMoodModal = useCallback(() => {
    const event = new CustomEvent('openDailyMoodModal');
    window.dispatchEvent(event);
  }, []);

  if (error) {
    return (
      <div className='border-border/60 bg-card/70 flex flex-col gap-3 rounded-2xl border p-4 shadow-sm'>
        <div className='text-foreground text-sm font-medium'>
          Unable to load mood
        </div>
        <div className='text-muted-foreground text-xs'>
          Try refreshing or check back shortly.
        </div>
        <button
          type='button'
          onClick={() => refetch()}
          className='text-primary inline-flex w-max items-center gap-1 text-xs font-medium'
        >
          <RefreshCw className='h-3.5 w-3.5' />
          Reload
        </button>
      </div>
    );
  }

  const moodIcon = moodEntry?.day_quality
    ? getDayQualityIcon(moodEntry.day_quality, true)
    : null;

  return (
    <button
      type='button'
      onClick={openMoodModal}
      className={cn(
        'group border-border/60 bg-card/70 relative flex w-full items-center gap-4 rounded-2xl border p-4 text-left shadow-sm transition duration-200',
        'hover:border-border focus-visible:ring-primary/40 focus-visible:ring-2 focus-visible:outline-none'
      )}
    >
      <div className='bg-primary/10 text-primary group-hover:bg-primary/15 flex h-14 w-14 items-center justify-center rounded-full transition'>
        {moodIcon ? moodIcon : <Sparkles className='text-primary h-6 w-6' />}
      </div>
      <div className='flex flex-1 flex-col'>
        <span className='text-muted-foreground text-xs tracking-wide uppercase'>
          Mood today
        </span>
        <span className='text-foreground text-base font-semibold'>
          {moodHeadline(moodEntry?.day_quality)}
        </span>
        <span className='text-muted-foreground text-xs'>
          {moodSubtitle(moodEntry?.emotions)}
        </span>
      </div>
      {isLoading ? (
        <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
      ) : null}
    </button>
  );
};

const DailyMoodWidget = memo(DailyMoodWidgetComponent);
DailyMoodWidget.displayName = 'DailyMoodWidget';

export default DailyMoodWidget;
