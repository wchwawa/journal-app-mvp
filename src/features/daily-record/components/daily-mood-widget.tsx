'use client';

import { memo, useCallback, useMemo } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useTodayMood } from '@/hooks/use-today-mood';
import { formatDayQuality } from '@/lib/mood-utils';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'motion/react';

const moodHeadline = (dayQuality?: string | null) => {
  if (!dayQuality) return 'Log mood';
  return formatDayQuality(dayQuality);
};

const emojiForMood = (dayQuality?: string | null) => {
  if (!dayQuality) return '✨';
  switch (dayQuality) {
    case 'good':
      return '🌞';
    case 'bad':
      return '🌧️';
    case 'so-so':
      return '🌤️';
    default:
      return '🌈';
  }
};

const DailyMoodWidgetComponent = () => {
  const { moodEntry, isLoading, error, refetch } = useTodayMood();

  const openMoodModal = useCallback(() => {
    const event = new CustomEvent('openDailyMoodModal');
    window.dispatchEvent(event);
  }, []);

  const emoji = useMemo(
    () => emojiForMood(moodEntry?.day_quality),
    [moodEntry?.day_quality]
  );

  if (error) {
    return (
      <div className='border-border/40 bg-card/60 flex flex-col gap-2 rounded-2xl border p-3 shadow-sm'>
        <div className='text-foreground text-xs font-medium'>
          Unable to load mood
        </div>
        <button
          type='button'
          onClick={() => refetch()}
          className='text-primary inline-flex w-max items-center gap-1 text-[11px] font-medium'
        >
          <RefreshCw className='h-3.5 w-3.5' />
          Reload
        </button>
      </div>
    );
  }

  return (
    <motion.button
      type='button'
      onClick={openMoodModal}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'group border-border/20 bg-card/80 relative flex h-full w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left shadow-sm backdrop-blur-sm transition-all duration-300',
        'hover:border-border/40 hover:shadow-md',
        'focus-visible:ring-primary/40 focus-visible:ring-2 focus-visible:outline-none'
      )}
    >
      <div className='relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 to-yellow-50 shadow-inner ring-1 ring-orange-200/50 dark:from-orange-900/30 dark:to-yellow-900/20 dark:ring-orange-700/30'>
        <AnimatePresence mode='wait'>
          <motion.span
            key={emoji}
            initial={{ scale: 0.7, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.6, rotate: 8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className='text-2xl'
            aria-hidden
          >
            {emoji}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className='relative flex flex-1 flex-col'>
        <span className='text-foreground text-base font-semibold transition-colors group-hover:text-orange-600 dark:group-hover:text-orange-400'>
          {moodHeadline(moodEntry?.day_quality)}
        </span>
        <span className='text-muted-foreground/70 hidden text-[10px] font-medium sm:inline'>
          Daily Check-in
        </span>
      </div>
      {isLoading ? (
        <Loader2 className='text-muted-foreground h-3.5 w-3.5 shrink-0 animate-spin' />
      ) : null}
    </motion.button>
  );
};

const DailyMoodWidget = memo(DailyMoodWidgetComponent);
DailyMoodWidget.displayName = 'DailyMoodWidget';

export default DailyMoodWidget;
