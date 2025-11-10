'use client';

import type React from 'react';
import { useState } from 'react';
import { Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoiceAgent } from '@/hooks/use-voice-agent';
import VoiceAgentPanel from '@/components/agent/voice-agent-panel';

export default function AgentLauncher() {
  const agent = useVoiceAgent();
  const [open, setOpen] = useState(false);
  const { state } = agent;

  return (
    <>
      <button
        type='button'
        aria-label='Open Echo voice companion'
        onClick={() => setOpen(true)}
        className={cn(
          'focus-visible:ring-primary fixed z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all focus-visible:ring-2 focus-visible:outline-none sm:h-16 sm:w-16',
          state.status === 'ready'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        )}
        style={
          {
            bottom: 'var(--agent-launcher-bottom, 1.5rem)',
            right: 'var(--agent-launcher-right, 1.5rem)'
          } as React.CSSProperties
        }
      >
        <Mic className={cn('h-6 w-6', state.isListening && 'animate-pulse')} />
        <span className='sr-only'>Open Echo companion</span>
      </button>

      <VoiceAgentPanel open={open} onOpenChange={setOpen} agent={agent} />
    </>
  );
}
