'use client';

import {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback
} from 'react';
import { useUser } from '@clerk/nextjs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CloudRain, CloudSun, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MoodEntry } from '@/lib/data/repository';

const DAY_QUALITY_OPTIONS = [
  { value: 'good', label: 'Good day', icon: Sun },
  { value: 'so-so', label: 'Just so so', icon: CloudSun },
  { value: 'bad', label: 'Bad day', icon: CloudRain }
];

const EMOTION_OPTIONS = ['Happy', 'Anxious', 'Anger', 'Sadness', 'Despair'];

export interface DailyMoodModalRef {
  openModal: () => void;
}

interface DailyMoodModalProps {}

const DailyMoodModal = forwardRef<DailyMoodModalRef, DailyMoodModalProps>(
  (_, ref) => {
    const { user } = useUser();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [dayQuality, setDayQuality] = useState('');
    const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
    const [existingEntry, setExistingEntry] = useState<MoodEntry | null>(null);
    const isUpdateMode = existingEntry !== null;

    const checkDailyEntry = useCallback(async (): Promise<MoodEntry | null> => {
      if (!user?.id) return null;

      try {
        const response = await fetch('/api/mood/today');
        if (!response.ok) {
          // No readable entry for today
          return null;
        }
        const payload = (await response.json()) as { mood: MoodEntry | null };
        return payload.mood;
      } catch {
        return null;
      }
    }, [user?.id]);

    const openModal = async () => {
      const entry = await checkDailyEntry();

      if (entry) {
        // Update mode - populate with existing data
        setExistingEntry(entry);
        setDayQuality(entry.day_quality);
        setSelectedEmotions(entry.emotions || []);
      } else {
        // Create mode - clear form
        setExistingEntry(null);
        setDayQuality('');
        setSelectedEmotions([]);
      }

      setIsOpen(true);
    };

    useEffect(() => {
      const autoCheckAndOpen = async () => {
        if (!user?.id) return;

        const entry = await checkDailyEntry();
        if (!entry) {
          // Auto-open only if no entry exists
          setIsOpen(true);
        }
      };

      autoCheckAndOpen();
    }, [user?.id, checkDailyEntry]);

    useImperativeHandle(ref, () => ({
      openModal
    }));

    const handleEmotionChange = (emotion: string, checked: boolean) => {
      setSelectedEmotions((prev) =>
        checked ? [...prev, emotion] : prev.filter((e) => e !== emotion)
      );
    };

    const handleSubmit = async () => {
      if (!user?.id || !dayQuality) return;

      setIsLoading(true);

      try {
        // PUT upserts: creates today's entry or updates the existing one
        const response = await fetch('/api/mood/today', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dayQuality,
            emotions: selectedEmotions
          })
        });

        if (response.ok) {
          setIsOpen(false);
          // Reset form state
          setDayQuality('');
          setSelectedEmotions([]);
          setExistingEntry(null);

          // Dispatch event to notify other components about the mood update
          const event = new CustomEvent('moodEntryUpdated');
          window.dispatchEvent(event);
        }
      } catch (err) {
        console.error('Error saving mood entry:', err);
      } finally {
        setIsLoading(false);
      }
    };

    const isValid = dayQuality.length > 0;

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });

    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className='rounded-xl sm:max-w-md'>
          <DialogHeader className='space-y-1.5'>
            <DialogTitle className='font-serif text-2xl font-medium tracking-tight'>
              Daily Check-in
            </DialogTitle>
            <DialogDescription>{today}. Take five seconds.</DialogDescription>
          </DialogHeader>

          <div className='space-y-6'>
            {/* Question 1: Day Quality */}
            <div
              className='space-y-3'
              role='radiogroup'
              aria-label='How was your day?'
            >
              <p className='text-sm font-medium'>How was your day?</p>
              <div className='grid grid-cols-3 gap-2'>
                {DAY_QUALITY_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = dayQuality === option.value;
                  return (
                    <button
                      key={option.value}
                      type='button'
                      role='radio'
                      aria-checked={selected}
                      onClick={() => setDayQuality(option.value)}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-xl border px-2 py-4 text-sm transition-all active:scale-[0.98]',
                        selected
                          ? 'border-primary/50 bg-accent text-accent-foreground ring-primary/30 font-medium ring-2'
                          : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
                      )}
                    >
                      <Icon className='h-5 w-5' />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Question 2: Emotions */}
            <div
              className='space-y-3'
              role='group'
              aria-label='How do you feel today?'
            >
              <p className='text-sm font-medium'>
                How do you feel today?{' '}
                <span className='text-muted-foreground font-normal'>
                  Pick any.
                </span>
              </p>
              <div className='flex flex-wrap gap-2'>
                {EMOTION_OPTIONS.map((emotion) => {
                  const selected = selectedEmotions.includes(emotion);
                  return (
                    <button
                      key={emotion}
                      type='button'
                      aria-pressed={selected}
                      onClick={() => handleEmotionChange(emotion, !selected)}
                      className={cn(
                        'rounded-full border px-4 py-1.5 text-sm transition-all active:scale-[0.97]',
                        selected
                          ? 'border-primary/50 bg-primary text-primary-foreground'
                          : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
                      )}
                    >
                      {emotion}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className='flex items-center justify-end gap-2 pt-1'>
              <Button
                variant='ghost'
                className='rounded-full'
                onClick={() => setIsOpen(false)}
                disabled={isLoading}
              >
                Skip
              </Button>
              <Button
                className='rounded-full px-6'
                onClick={handleSubmit}
                disabled={!isValid || isLoading}
              >
                {isLoading
                  ? isUpdateMode
                    ? 'Updating...'
                    : 'Submitting...'
                  : isUpdateMode
                    ? 'Update'
                    : 'Submit'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

DailyMoodModal.displayName = 'DailyMoodModal';

export default DailyMoodModal;
