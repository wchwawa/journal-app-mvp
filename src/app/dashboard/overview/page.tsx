'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import AudioJournalPanel from '@/features/daily-record/components/audio-journal-panel';
import DailyMoodWidget from '@/features/daily-record/components/daily-mood-widget';
import Link from 'next/link';

export default function OverviewPage() {
  return (
    <div className='from-background to-muted/20 min-h-screen bg-gradient-to-br'>
      <div className='mx-auto max-w-6xl px-6 py-10'>
        <div className='grid items-start gap-8 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]'>
          <div className='flex flex-col gap-4'>
            <DailyMoodWidget />
            <Button
              asChild
              variant='outline'
              className='justify-center text-sm'
            >
              <Link href='/dashboard/echos'>
                View Echos
                <ArrowRight className='ml-2 h-4 w-4' />
              </Link>
            </Button>
          </div>

          <div className='lg:sticky lg:top-8'>
            <div className='relative'>
              <div className='from-primary/10 via-primary/5 absolute inset-0 scale-105 rounded-3xl bg-gradient-to-br to-transparent blur-xl' />
              <div className='bg-card/80 border-border/50 relative rounded-3xl border p-8 shadow-2xl backdrop-blur-sm'>
                <AudioJournalPanel />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
