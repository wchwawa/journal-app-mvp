import KBar from '@/components/kbar';
import Header from '@/components/layout/header';
import BottomBar from '@/components/layout/bottom-bar';
import AgentLauncher from '@/components/agent/agent-launcher';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'EchoJournal',
  description:
    'Voice-first journaling: speak your day, get structured reflections.'
};

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <KBar>
      <div className='bg-background flex min-h-screen flex-col'>
        <Header />
        <main className='flex-1 pb-28 lg:pb-12'>{children}</main>
        <BottomBar />
        {/* Desktop assistant entry; mobile uses the bottom bar. */}
        <div className='hidden lg:block'>
          <AgentLauncher />
        </div>
      </div>
    </KBar>
  );
}
