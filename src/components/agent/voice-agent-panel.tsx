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
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Sparkles className='text-primary h-4 w-4' /> Echo Voice Companion
          </DialogTitle>
          <DialogDescription>
            Push-to-talk reflection buddy. Sessions last up to 10 minutes.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-5'>
          <div className='flex items-center justify-between rounded-lg border p-3'>
            <div>
              <p className='text-foreground text-sm font-medium'>Status</p>
              <p className='text-muted-foreground text-xs'>
                {statusCopy[state.status]}
              </p>
            </div>
            <Badge variant='outline'>
              {state.status === 'ready'
                ? 'Live'
                : state.status.charAt(0).toUpperCase() + state.status.slice(1)}
            </Badge>
          </div>

          <div className='space-y-2'>
            <p className='text-foreground text-sm font-medium'>Voice Profile</p>
            <Select
              value={state.voiceId}
              disabled={state.status !== 'idle'}
              onValueChange={(value) => setVoiceId(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder='Select a voice' />
              </SelectTrigger>
              <SelectContent>
                {voiceProfiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className='text-muted-foreground text-xs'>
              Voice changes apply to the next session.
            </p>
          </div>

          <div className='space-y-3 rounded-lg border p-4'>
            <div className='flex items-center justify-between text-sm font-medium'>
              <span>Session timer</span>
              <span>{Math.ceil(state.timeRemaining)}s left</span>
            </div>
            <Progress value={timePercent} className='h-2' />
          </div>

          <div className='flex flex-wrap gap-2'>
            <Button
              variant={state.status === 'ready' ? 'outline' : 'default'}
              onClick={() =>
                state.status === 'ready' ? disconnect() : connect()
              }
              disabled={state.status === 'connecting'}
            >
              {state.status === 'ready' ? 'End session' : 'Start session'}
            </Button>
            <Button
              variant='ghost'
              size='sm'
              disabled
              className='text-muted-foreground'
            >
              {state.searchRemaining} web searches left today
            </Button>
          </div>

          <div className='flex flex-col gap-3 rounded-2xl border p-4 text-center'>
            <p className='text-sm font-semibold'>Push to talk</p>
            <Button
              size='lg'
              className={cn(
                'mx-auto h-20 w-20 rounded-full text-white shadow-lg transition-colors',
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
            <p className='text-muted-foreground text-xs'>
              Hold while you speak. Release to let Echo reply.
            </p>
          </div>

          {state.lastMessage ? (
            <div className='space-y-2 rounded-xl border p-4 text-left'>
              <p className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
                Last reply
              </p>
              <p className='text-sm leading-relaxed'>{state.lastMessage}</p>
            </div>
          ) : null}

          {state.error ? (
            <div className='border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm'>
              {state.error}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
