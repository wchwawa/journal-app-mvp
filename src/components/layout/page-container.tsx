import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export default function PageContainer({
  children,
  scrollable = true,
  className
}: {
  children: React.ReactNode;
  scrollable?: boolean;
  className?: string;
}) {
  return scrollable ? (
    <ScrollArea className='h-[calc(100dvh-52px)]'>
      <div
        className={cn(
          'mx-auto flex w-full max-w-5xl flex-1 p-4 pb-24 md:px-6 lg:pt-8',
          className
        )}
      >
        {children}
      </div>
    </ScrollArea>
  ) : (
    <div
      className={cn(
        'mx-auto flex w-full max-w-5xl flex-1 p-4 pb-24 md:px-6 lg:pt-8',
        className
      )}
    >
      {children}
    </div>
  );
}
