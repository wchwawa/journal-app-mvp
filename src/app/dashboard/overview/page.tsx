'use client';

import { useEffect, useState } from 'react';
import AudioJournalPanel from '@/features/daily-record/components/audio-journal-panel';
import DailyMoodWidget from '@/features/daily-record/components/daily-mood-widget';
import EchosWidget from '@/features/overview/components/echos-widget';
import { motion } from 'motion/react';

function greetingForHour(hour: number) {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function OverviewPage() {
  // Rendered after mount to avoid a server/client clock mismatch.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  return (
    <div className='flex w-full flex-1'>
      <div className='mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 pt-2 pb-0 sm:max-w-lg sm:px-6 lg:max-w-6xl lg:px-8 lg:pt-10'>
        {/* Desktop greeting; mobile keeps its compact stack. */}
        <motion.header
          className='hidden min-h-[76px] lg:block'
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {now && (
            <>
              <h1 className='font-serif text-4xl font-medium tracking-tight'>
                {greetingForHour(now.getHours())}.
              </h1>
              <p className='text-muted-foreground mt-2'>
                {now.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                })}
                . Press record and talk it through.
              </p>
            </>
          )}
        </motion.header>

        <div className='flex flex-1 flex-col gap-4 lg:mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-stretch lg:gap-6'>
          {/* Widgets: 2-up row on mobile, right column stack on desktop */}
          <motion.div
            className='grid grid-cols-2 gap-2 sm:gap-3 lg:order-2 lg:grid-cols-1 lg:content-start lg:gap-4'
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <DailyMoodWidget />
            <EchosWidget />
          </motion.div>

          {/* Main audio recording panel */}
          <motion.div
            className='relative mt-2 flex-1 lg:order-1 lg:mt-0 lg:min-h-[540px]'
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          >
            {/* Ambient brand glow */}
            <div className='from-primary/10 via-primary/5 absolute -inset-4 rounded-[2rem] bg-gradient-to-br to-transparent opacity-60 blur-3xl' />

            <div className='border-border/60 bg-card relative h-full rounded-xl border p-6 transition-shadow duration-300 hover:shadow-lg lg:p-8'>
              <AudioJournalPanel />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
