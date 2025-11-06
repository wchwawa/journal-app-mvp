'use client';

import AudioJournalPanel from '@/features/daily-record/components/audio-journal-panel';
import DailyMoodWidget from '@/features/daily-record/components/daily-mood-widget';
import EchosWidget from '@/features/overview/components/echos-widget';
import { motion } from 'motion/react';

export default function OverviewPage() {
  return (
    <div className='from-background via-background to-muted/10 min-h-screen bg-gradient-to-br'>
      <div className='mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-10 sm:max-w-lg'>
        {/* Top widgets section */}
        <motion.div
          className='grid grid-cols-2 gap-3 sm:gap-4'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <DailyMoodWidget />
          <EchosWidget />
        </motion.div>

        {/* Main audio recording panel */}
        <motion.div
          className='relative mt-4'
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
        >
          {/* Enhanced ambient glow */}
          <div className='from-primary/10 via-primary/5 absolute -inset-4 rounded-[2rem] bg-gradient-to-br to-transparent opacity-60 blur-3xl' />

          {/* Subtle ring effect */}
          <div className='from-primary/20 to-primary/10 absolute -inset-[2px] rounded-[1.75rem] bg-gradient-to-br via-transparent opacity-0 transition-opacity duration-500 hover:opacity-100' />

          <div className='border-border/30 bg-card/90 hover:border-border/40 relative rounded-[1.75rem] border p-6 shadow-xl backdrop-blur-md transition-all duration-300 hover:shadow-2xl'>
            <AudioJournalPanel />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
