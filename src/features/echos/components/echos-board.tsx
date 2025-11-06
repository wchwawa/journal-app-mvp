'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Loader2, RefreshCw, Wand2 } from 'lucide-react';
import type { ReflectionCard, ReflectionMode } from '@/lib/reflections/types';
import { getLocalDayRange } from '@/lib/timezone';

interface EditState {
  achievements: string;
  commitments: string;
  moodOverall: string;
  moodReason: string;
  flashback: string;
}

const MODES: Array<{ value: ReflectionMode; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' }
];

const EMPTY_STATE_COPY: Record<ReflectionMode, string> = {
  daily: 'No daily echos yet. Generate one to get started.',
  weekly: 'Weekly echos will appear here once generated.',
  monthly: 'Monthly echos will appear here once generated.'
};

const toMultiline = (items: string[]) => items.join('\n');

const fromMultiline = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const getInitialEditState = (card: ReflectionCard): EditState => ({
  achievements: toMultiline(card.achievements),
  commitments: toMultiline(card.commitments),
  moodOverall: card.moodOverall ?? '',
  moodReason: card.moodReason ?? '',
  flashback: card.flashback ?? ''
});

const formatPeriod = (card: ReflectionCard) => {
  if (card.period.type === 'daily' && card.period.date) {
    return format(parseISO(card.period.date), 'PPP');
  }

  if (card.period.type === 'weekly') {
    return `${format(parseISO(card.period.start), 'MMM d')} - ${format(
      parseISO(card.period.end),
      'MMM d'
    )}`;
  }

  return format(parseISO(card.period.start), 'MMMM yyyy');
};

const isCurrentPeriod = (card: ReflectionCard) => {
  const { date: todayDate } = getLocalDayRange();

  if (card.period.type === 'daily' && card.period.date) {
    return card.period.date === todayDate;
  }

  return isWithinInterval(todayDate, {
    start: parseISO(card.period.start),
    end: parseISO(card.period.end)
  });
};

async function fetchCards(mode: ReflectionMode) {
  const response = await fetch(`/api/reflections/${mode}`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error('Failed to load echos.');
  }

  const data = await response.json();
  return (data.cards ?? []) as ReflectionCard[];
}

interface EditDialogProps {
  mode: ReflectionMode;
  card: ReflectionCard | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (card: ReflectionCard) => void;
}

function EditEchoDialog({
  mode,
  card,
  open,
  onClose,
  onSuccess
}: EditDialogProps) {
  const [state, setState] = useState<EditState | null>(
    card ? getInitialEditState(card) : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (card) {
      setState(getInitialEditState(card));
    }
  }, [card]);

  if (!card || !state) return null;

  const handleChange = (key: keyof EditState, value: string) => {
    setState((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const body = {
        achievements: fromMultiline(state.achievements),
        commitments: fromMultiline(state.commitments),
        moodOverall: state.moodOverall.trim() || null,
        moodReason: state.moodReason.trim() || null,
        flashback: state.flashback.trim() || null
      };

      const url =
        mode === 'daily'
          ? `/api/reflections/daily/${card.period.date}`
          : `/api/reflections/period/${card.recordId}`;

      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error('Unable to save changes. Please try again.');
      }

      const data = await response.json();
      onSuccess(data.card as ReflectionCard);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to save changes. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>
            Edit {mode === 'daily' ? 'daily' : mode} echo
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <label className='text-sm font-medium'>Achievements</label>
            <Textarea
              value={state.achievements}
              onChange={(event) =>
                handleChange('achievements', event.target.value)
              }
              placeholder='One accomplishment per line'
              rows={4}
            />
          </div>
          <div className='space-y-2'>
            <label className='text-sm font-medium'>Commitments</label>
            <Textarea
              value={state.commitments}
              onChange={(event) =>
                handleChange('commitments', event.target.value)
              }
              placeholder='One commitment or next step per line'
              rows={4}
            />
          </div>
          <div className='grid gap-2 md:grid-cols-2'>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Mood Overall</label>
              <Input
                value={state.moodOverall}
                onChange={(event) =>
                  handleChange('moodOverall', event.target.value)
                }
                placeholder='e.g. reflective'
              />
            </div>
            <div className='space-y-2 md:col-span-2'>
              <label className='text-sm font-medium'>Mood Reason</label>
              <Textarea
                value={state.moodReason}
                onChange={(event) =>
                  handleChange('moodReason', event.target.value)
                }
                placeholder='Short explanation of the mood'
                rows={3}
              />
            </div>
          </div>
          <div className='space-y-2'>
            <label className='text-sm font-medium'>Flashback</label>
            <Input
              value={state.flashback}
              onChange={(event) =>
                handleChange('flashback', event.target.value)
              }
              placeholder='One-line hook to revisit later'
            />
          </div>

          {error ? <p className='text-destructive text-sm'>{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            ) : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EchosBoard() {
  const [mode, setMode] = useState<ReflectionMode>('daily');
  const [cards, setCards] = useState<ReflectionCard[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setGenerating] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const activeCard = cards[activeIndex] ?? null;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchCards(mode);
        setCards(result);
        setActiveIndex(0);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load echos.';
        setError(message);
        setCards([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [mode]);

  const handleRefetch = async () => {
    try {
      const result = await fetchCards(mode);
      setCards(result);
      setActiveIndex(0);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to refresh echos.';
      setError(message);
    }
  };

  const handleGenerate = async (anchorDate?: string) => {
    try {
      setGenerating(true);
      setError(null);
      // For weekly/monthly, if current view不是进行中的卡片，则以今天为锚点生成当期卡片
      const { date: todayISO } = getLocalDayRange();
      const effectiveAnchor =
        mode === 'daily'
          ? (anchorDate ?? todayISO)
          : activeCard && isCurrentPeriod(activeCard)
            ? activeCard.period.start
            : todayISO;

      const response = await fetch('/api/reflections/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, anchorDate: effectiveAnchor })
      });

      if (!response.ok) {
        throw new Error('Generation failed. Please try again.');
      }

      await handleRefetch();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Generation failed. Please try again.';
      setError(message);
    } finally {
      setGenerating(false);
    }
  };

  const currentLabel = useMemo(() => {
    if (!activeCard) return '';
    const label = formatPeriod(activeCard);
    return label;
  }, [activeCard]);

  const handleEditSuccess = (updatedCard: ReflectionCard) => {
    setCards((prev) =>
      prev.map((card) =>
        card.recordId === updatedCard.recordId &&
        card.period.start === updatedCard.period.start
          ? updatedCard
          : card
      )
    );
  };

  const handlePrev = () => {
    setActiveIndex((prev) => Math.min(prev + 1, cards.length - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => Math.max(prev - 1, 0));
  };

  return (
    <div className='flex flex-1 flex-col space-y-6'>
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <div className='flex flex-wrap gap-2'>
          {MODES.map((item) => (
            <Button
              key={item.value}
              variant={mode === item.value ? 'default' : 'outline'}
              onClick={() => setMode(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleRefetch()}
            disabled={loading || isGenerating}
          >
            <RefreshCw className='mr-2 h-4 w-4' />
            Refresh list
          </Button>
          <Button
            size='sm'
            onClick={() =>
              handleGenerate(
                mode === 'daily'
                  ? activeCard?.period.date
                  : activeCard?.period.start
              )
            }
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            ) : (
              <Wand2 className='mr-2 h-4 w-4' />
            )}
            {mode === 'daily'
              ? 'Generate today’s echo'
              : 'Refresh current period'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className='flex min-h-[320px] items-center justify-center'>
          <Loader2 className='h-6 w-6 animate-spin' />
        </div>
      ) : error ? (
        <div className='text-destructive text-sm'>{error}</div>
      ) : cards.length === 0 ? (
        <div className='text-muted-foreground rounded-lg border border-dashed p-12 text-center'>
          {EMPTY_STATE_COPY[mode]}
        </div>
      ) : (
        <Card>
          <CardHeader className='flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
            <div>
              <CardTitle className='text-xl font-semibold'>
                {currentLabel}
              </CardTitle>
              <div className='text-muted-foreground flex flex-wrap gap-2 pt-2 text-sm'>
                {activeCard?.edited ? (
                  <Badge variant='secondary'>Edited</Badge>
                ) : null}
                {activeCard && isCurrentPeriod(activeCard) ? (
                  <Badge variant='outline'>In progress</Badge>
                ) : null}
                {activeCard?.lastGeneratedAt ? (
                  <span>
                    Generated:
                    {format(
                      parseISO(activeCard.lastGeneratedAt),
                      'MMM d HH:mm'
                    )}
                  </span>
                ) : null}
              </div>
            </div>

            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='icon'
                onClick={handlePrev}
                disabled={activeIndex >= cards.length - 1}
              >
                ‹
              </Button>
              <span className='text-muted-foreground text-sm'>
                {cards.length - activeIndex}/{cards.length}
              </span>
              <Button
                variant='outline'
                size='icon'
                onClick={handleNext}
                disabled={activeIndex === 0}
              >
                ›
              </Button>

              {activeCard ? (
                <Button variant='outline' onClick={() => setEditOpen(true)}>
                  Edit
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className='space-y-6'>
            <section>
              <h3 className='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
                Achievements
              </h3>
              <Separator className='my-2' />
              {activeCard?.achievements.length ? (
                <ul className='list-disc space-y-2 pl-5'>
                  {activeCard.achievements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className='text-muted-foreground text-sm'>No data yet.</p>
              )}
            </section>

            <section>
              <h3 className='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
                Commitments
              </h3>
              <Separator className='my-2' />
              {activeCard?.commitments.length ? (
                <ul className='list-disc space-y-2 pl-5'>
                  {activeCard.commitments.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className='text-muted-foreground text-sm'>No data yet.</p>
              )}
            </section>

            <section className='grid gap-2 md:grid-cols-2'>
              <div>
                <h3 className='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
                  Mood
                </h3>
                <Separator className='my-2' />
                <p className='text-sm'>
                  <span className='font-medium'>Overall: </span>
                  {activeCard?.moodOverall ?? '—'}
                </p>
                <p className='text-muted-foreground text-sm'>
                  {activeCard?.moodReason ?? ''}
                </p>
              </div>
              <div>
                <h3 className='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
                  Flashback
                </h3>
                <Separator className='my-2' />
                <p className='text-muted-foreground text-sm'>
                  {activeCard?.flashback ?? '—'}
                </p>
              </div>
            </section>
          </CardContent>
        </Card>
      )}

      <EditEchoDialog
        mode={mode}
        card={activeCard}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
