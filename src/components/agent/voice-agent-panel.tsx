'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ReturnTypeUseVoiceAgent } from '@/components/agent/types';
import { useEffect } from 'react';
import { Mic, PhoneOff, Sparkles } from 'lucide-react';

interface VoiceAgentPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: ReturnTypeUseVoiceAgent;
}

const statusCopy: Record<string, string> = {
  idle: 'Tap start to begin',
  connecting: 'Connecting...',
  ready: 'Say anything when you press and hold',
  error: 'Please restart session'
};

export default function VoiceAgentPanel({
  open,
  onOpenChange,
  agent
}: VoiceAgentPanelProps) {
  const {
    state,
    connect,
    disconnect,
    toggleListening,
    setVoiceId,
    voiceProfiles
  } = agent;

  useEffect(() => {
    if (!open) {
      toggleListening(false);
    }
  }, [open, toggleListening]);

  const handleDialogChange = (nextOpen: boolean) => {
    if (!nextOpen && state.status !== 'idle') {
      disconnect();
    }
    onOpenChange(nextOpen);
  };

  const handlePressStart = () => {
    if (state.status === 'ready') toggleListening(true);
  };

  const handlePressEnd = () => {
    if (state.isListening) toggleListening(false);
  };

  const timePercent = (state.timeRemaining / 600) * 100;

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Sparkles className='text-primary h-4 w-4' /> Echo Voice Companion
          </DialogTitle>
          <DialogDescription>
            Hold, speak, release. 10 min max.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='rounded-xl border p-3'>
            <div className='flex items-center justify-between text-sm font-semibold'>
              <span>Timer</span>
              <span>{Math.ceil(state.timeRemaining)}s</span>
            </div>
            <Progress value={timePercent} className='mt-2 h-1.5' />
            <p className='text-muted-foreground mt-1 text-[11px]'>
              Session cap: 10 min
            </p>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <Button
              variant={state.status === 'ready' ? 'destructive' : 'default'}
              onClick={() =>
                state.status === 'ready' ? disconnect() : connect()
              }
              disabled={state.status === 'connecting'}
            >
              {state.status === 'ready' ? 'End session' : 'Start session'}
            </Button>
            <Badge variant='outline'>
              {state.status === 'ready'
                ? 'Live'
                : state.status.charAt(0).toUpperCase() + state.status.slice(1)}
            </Badge>
            <span className='text-muted-foreground text-xs'>
              {statusCopy[state.status]}
            </span>
            <Button
              variant='ghost'
              size='sm'
              disabled
              className='text-muted-foreground'
            >
              {state.searchRemaining} web searches left today
            </Button>
          </div>

          <div className='rounded-2xl border p-4 text-center'>
            <div className='mb-2 flex items-center justify-between'>
              <p className='text-sm font-semibold'>Push to talk</p>
              <Select
                value={state.voiceId}
                disabled={state.status !== 'idle'}
                onValueChange={(value) => setVoiceId(value)}
              >
                <SelectTrigger className='h-8 w-32 text-xs'>
                  <SelectValue placeholder='Voice' />
                </SelectTrigger>
                <SelectContent align='end'>
                  {voiceProfiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size='lg'
              className={cn(
                'mx-auto mt-2 h-16 w-16 rounded-full text-white shadow-lg transition-colors',
                state.isListening || state.status !== 'ready'
                  ? 'bg-primary'
                  : 'bg-primary/80'
              )}
              disabled={state.status !== 'ready'}
              onMouseDown={handlePressStart}
              onMouseUp={handlePressEnd}
              onMouseLeave={handlePressEnd}
              onTouchStart={(event) => {
                event.preventDefault();
                handlePressStart();
              }}
              onTouchEnd={(event) => {
                event.preventDefault();
                handlePressEnd();
              }}
            >
              {state.isListening ? (
                <Mic className='h-6 w-6 animate-pulse' />
              ) : state.status === 'ready' ? (
                <Mic className='h-6 w-6' />
              ) : (
                <PhoneOff className='h-6 w-6' />
              )}
            </Button>
            <p className='text-muted-foreground mt-2 text-[11px]'>
              Hold to talk, release for reply.
            </p>
          </div>

          {state.lastMessage ? (
            <div className='space-y-1.5 rounded-xl border p-3 text-left'>
              <p className='text-muted-foreground text-[11px] font-semibold tracking-wide uppercase'>
                Last reply
              </p>
              <p className='text-sm leading-relaxed'>{state.lastMessage}</p>
            </div>
          ) : null}

          {state.error ? (
            <div className='border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-3 text-xs'>
              {state.error}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
