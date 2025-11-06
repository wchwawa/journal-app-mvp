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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { createClient } from '@/lib/supabase/client';
import { getLocalDayRange } from '@/lib/timezone';
import { TablesInsert, Tables } from '@/types/supabase';

const DAY_QUALITY_OPTIONS = [
  { value: 'good', label: 'Good day' },
  { value: 'bad', label: 'Bad day' },
  { value: 'so-so', label: 'Just so so' }
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
    const [existingEntry, setExistingEntry] =
      useState<Tables<'daily_question'> | null>(null);
    const [isUpdateMode, setIsUpdateMode] = useState(false);

    const supabase = createClient();

    const checkDailyEntry = useCallback(async () => {
      if (!user?.id) return null;

      const { start, end } = getLocalDayRange();

      const { data, error } = await supabase
        .from('daily_question')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', start)
        .lte('created_at', end)
        .single();

      if (error && error.code === 'PGRST116') {
        // No entry found for today
        return null;
      }

      return data;
    }, [user?.id, supabase]);

    const openModal = async () => {
      const entry = await checkDailyEntry();

      if (entry) {
        // Update mode - populate with existing data
        setExistingEntry(entry);
        setDayQuality(entry.day_quality);
        setSelectedEmotions(entry.emotions || []);
        setIsUpdateMode(true);
      } else {
        // Create mode - clear form
        setExistingEntry(null);
        setDayQuality('');
        setSelectedEmotions([]);
        setIsUpdateMode(false);
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

      let error;

      if (isUpdateMode && existingEntry) {
        // Update existing entry
        const updateData = {
          day_quality: dayQuality,
          emotions: selectedEmotions,
          updated_at: new Date().toISOString()
        };

        const result = await supabase
          .from('daily_question')
          .update(updateData)
          .eq('id', existingEntry.id);

        error = result.error;
      } else {
        // Create new entry
        const entry: TablesInsert<'daily_question'> = {
          user_id: user.id,
          day_quality: dayQuality,
          emotions: selectedEmotions
        };

        const result = await supabase.from('daily_question').insert(entry);
        error = result.error;
      }

      if (!error) {
        setIsOpen(false);
        // Reset form state
        setDayQuality('');
        setSelectedEmotions([]);
        setExistingEntry(null);
        setIsUpdateMode(false);

        // Dispatch event to notify other components about the mood update
        const event = new CustomEvent('moodEntryUpdated');
        window.dispatchEvent(event);
      }

      setIsLoading(false);
    };

    const isValid = dayQuality.length > 0;

    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Daily Check-in</DialogTitle>
            <DialogDescription>
              How was your day today? Please share your thoughts with us.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-6'>
            {/* Question 1: Day Quality */}
            <div className='space-y-3'>
              <Label className='text-sm font-medium'>How was your day?</Label>
              <RadioGroup value={dayQuality} onValueChange={setDayQuality}>
                {DAY_QUALITY_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className='flex items-center space-x-2'
                  >
                    <RadioGroupItem value={option.value} id={option.value} />
                    <Label htmlFor={option.value} className='cursor-pointer'>
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Question 2: Emotions */}
            <div className='space-y-3'>
              <Label className='text-sm font-medium'>
                How do you feel today?
              </Label>
              <div className='space-y-2'>
                {EMOTION_OPTIONS.map((emotion) => (
                  <div key={emotion} className='flex items-center space-x-2'>
                    <Checkbox
                      id={emotion}
                      checked={selectedEmotions.includes(emotion)}
                      onCheckedChange={(checked) =>
                        handleEmotionChange(emotion, checked as boolean)
                      }
                    />
                    <Label htmlFor={emotion} className='cursor-pointer'>
                      {emotion}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className='flex justify-end space-x-2'>
              <Button
                variant='outline'
                onClick={() => setIsOpen(false)}
                disabled={isLoading}
              >
                Skip
              </Button>
              <Button onClick={handleSubmit} disabled={!isValid || isLoading}>
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
