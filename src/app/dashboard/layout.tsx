import KBar from '@/components/kbar';
import Header from '@/components/layout/header';
import BottomBar from '@/components/layout/bottom-bar';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Next Shadcn Dashboard Starter',
  description: 'Basic dashboard with Next.js and Shadcn'
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
        <main className='flex-1 pb-28'>{children}</main>
        <BottomBar />
      </div>
    </KBar>
  );
}
