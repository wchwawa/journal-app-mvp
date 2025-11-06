import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import JournalListPage from '@/features/journals/components/journal-list-page';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';

export const metadata = {
  title: 'Dashboard: Journals'
};

function JournalListSkeleton() {
  return (
    <div className='space-y-4'>
      {/* Filter skeleton */}
      <div className='flex flex-wrap gap-4'>
        <Skeleton className='h-10 w-48' />
        <Skeleton className='h-10 w-32' />
        <Skeleton className='h-10 w-64' />
      </div>

      {/* Daily record cards skeleton */}
      <div className='space-y-3'>
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className='h-24 w-full' />
        ))}
      </div>
    </div>
  );
}

export default async function JournalsPage() {
  return (
    <PageContainer scrollable={true}>
      <div className='flex flex-1 flex-col space-y-4'>
        <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
          <Heading
            title='My Journals'
            description='View and manage your voice journal entries'
          />
          <Button asChild variant='outline' className='self-start'>
            <Link href='/dashboard/journals/stats'>
              <BarChart3 className='mr-2 h-4 w-4' />
              View stats
            </Link>
          </Button>
        </div>
        <Separator />
        <Suspense fallback={<JournalListSkeleton />}>
          <JournalListPage />
        </Suspense>
      </div>
    </PageContainer>
  );
}
