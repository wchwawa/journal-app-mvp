'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Mic, NotebookText, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import VoiceAgentPanel from '@/components/agent/voice-agent-panel';
import { useVoiceAgent } from '@/hooks/use-voice-agent';

const NAV_ITEMS = [
  {
    href: '/dashboard/overview',
    label: 'Record',
    icon: Mic
  },
  {
    href: '/dashboard/journals',
    label: 'Journals',
    icon: NotebookText
  }
];

const buttonBaseClass =
  'bg-card/95 backdrop-blur flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg shadow-black/10 ring-1 ring-border/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 hover:translate-y-[-1px]';

export default function BottomBar() {
  const pathname = usePathname();

  return (
    <div
      className='pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center'
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)'
      }}
    >
      <div className='pointer-events-auto mx-auto flex w-full max-w-md gap-3 px-4 pb-2 sm:max-w-lg'>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                buttonBaseClass,
                isActive &&
                  'border-primary/40 bg-primary text-primary-foreground shadow-lg'
              )}
            >
              <Icon className='h-4 w-4' />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <AgentButton />
      </div>
    </div>
  );
}

function AgentButton() {
  const agent = useVoiceAgent();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type='button'
        onClick={() => setOpen(true)}
        className={cn(buttonBaseClass, 'text-primary hover:text-primary')}
      >
        <Sparkles className='h-4 w-4' />
        <span>Assistant</span>
      </button>
      <VoiceAgentPanel open={open} onOpenChange={setOpen} agent={agent} />
    </>
  );
}
