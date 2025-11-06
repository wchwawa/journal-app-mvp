'use client';

import { Button } from '@/components/ui/button';
import { Heart, Loader2, ArrowRight } from 'lucide-react';
import { useTodayMood } from '@/hooks/use-today-mood';
import { getMoodDisplayData } from '@/lib/mood-utils';
import { getDayQualityIcon, getEmotionIcon } from '@/components/icons';
import AudioJournalPanel from '@/features/daily-record/components/audio-journal-panel';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function OverviewPage() {
  const { moodEntry, isLoading, error } = useTodayMood();
  const moodDisplayData = getMoodDisplayData(moodEntry);

  return (
    <div className='from-background to-muted/20 min-h-screen bg-gradient-to-br'>
      {/* Header Section */}
      <div className='mx-auto max-w-7xl px-6 py-8'>
        <div className='mb-12 flex items-center justify-between'>
          <div className='space-y-2'>
            <h1 className='from-foreground to-foreground/80 bg-gradient-to-r bg-clip-text text-5xl font-bold tracking-tight text-transparent'>
              EchoJournal
            </h1>
            <p className='text-muted-foreground text-lg'>
              Your daily companion for thoughts and reflections
            </p>
          </div>
          <Button
            onClick={() => {
              const event = new CustomEvent('openDailyMoodModal');
              window.dispatchEvent(event);
            }}
            variant='ghost'
            className='hover:bg-muted/50 flex items-center gap-2 rounded-full px-6 py-3 transition-colors'
          >
            <Heart className='h-5 w-5' />
            Daily Check-in
          </Button>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className='grid items-start gap-12 lg:grid-cols-2'>
          {/* Left Column - Mood Snapshot */}
          <div className='space-y-8'>
            {/* Mood Today Card */}
            <div className='group relative'>
              <div
                className={cn(
                  'rounded-3xl p-8 transition-all duration-300',
                  'from-card/60 to-card/30 bg-gradient-to-br backdrop-blur-sm',
                  'border-border/50 border hover:scale-[1.02] hover:shadow-xl',
                  'space-y-6 text-center'
                )}
              >
                <h3 className='text-foreground mb-4 text-lg font-semibold'>
                  Today&apos;s Mood
                </h3>

                {isLoading ? (
                  <div className='flex h-32 items-center justify-center'>
                    <Loader2 className='text-muted-foreground h-10 w-10 animate-spin' />
                  </div>
                ) : error ? (
                  <div className='flex h-32 items-center justify-center'>
                    <span className='text-destructive'>Failed to load</span>
                  </div>
                ) : moodDisplayData.hasData ? (
                  <>
                    <div className='mb-6 flex justify-center'>
                      {getDayQualityIcon(
                        moodDisplayData.dayQuality || '',
                        true
                      )}
                    </div>
                    <div className='space-y-4'>
                      <p className='text-foreground text-2xl font-semibold'>
                        {moodDisplayData.primaryText}
                      </p>
                      <div className='flex flex-wrap justify-center gap-3'>
                        {moodDisplayData.emotions.slice(0, 3).map((emotion) => (
                          <div
                            key={emotion}
                            className='bg-muted/40 flex items-center gap-2 rounded-full px-3 py-1'
                          >
                            {getEmotionIcon(emotion, true)}
                            <span className='text-foreground text-sm'>
                              {emotion}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className='flex h-32 flex-col items-center justify-center gap-3'>
                    <div className='text-muted-foreground/30 text-5xl'>✨</div>
                    <p className='text-muted-foreground'>
                      Complete your daily check-in
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Audio Journal Panel (Core Feature) */}
          <div className='lg:sticky lg:top-8'>
            <div className='relative'>
              {/* Background glow effect */}
              <div className='from-primary/10 via-primary/5 absolute inset-0 scale-105 rounded-3xl bg-gradient-to-br to-transparent blur-xl' />

              {/* Main panel */}
              <div className='bg-card/80 border-border/50 relative rounded-3xl border p-8 shadow-2xl backdrop-blur-sm'>
                <AudioJournalPanel />
              </div>
            </div>
            <div className='mt-6 flex justify-center lg:justify-start'>
              <Button asChild variant='outline' className='group'>
                <Link href='/dashboard/echos'>
                  View Echos
                  <ArrowRight className='ml-2 h-4 w-4 transition-transform group-hover:translate-x-1' />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
