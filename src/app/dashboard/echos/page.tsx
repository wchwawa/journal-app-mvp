import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { EchosBoard } from '@/features/echos/components/echos-board';

export const metadata = {
  title: 'Dashboard: Echos'
};

function BoardSkeleton() {
  return (
    <div className='space-y-4'>
      <div className='flex gap-2'>
        <Skeleton className='h-10 w-24' />
        <Skeleton className='h-10 w-24' />
        <Skeleton className='h-10 w-24' />
      </div>
      <Skeleton className='h-[360px] w-full' />
    </div>
  );
}

export default function EchosPage() {
  return (
    <PageContainer scrollable={true}>
      <div className='flex flex-1 flex-col space-y-4'>
        <div className='flex items-start justify-between'>
          <Heading
            title='Echos'
            description='Generate and review AI-crafted daily, weekly, and monthly reflections.'
          />
        </div>
        <Separator />
        <Suspense fallback={<BoardSkeleton />}>
          <EchosBoard />
        </Suspense>
      </div>
    </PageContainer>
  );
}
