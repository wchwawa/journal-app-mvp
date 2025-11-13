'use client';

import PageContainer from '@/components/layout/page-container';
import DailyMoodModal, {
  DailyMoodModalRef
} from '@/features/daily-record/components/daily-mood-modal';
import React, { useRef, useEffect } from 'react';

export default function OverViewLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const moodModalRef = useRef<DailyMoodModalRef>(null);

  useEffect(() => {
    const handleOpenMoodModal = () => {
      moodModalRef.current?.openModal();
    };

    window.addEventListener('openDailyMoodModal', handleOpenMoodModal);
    return () => {
      window.removeEventListener('openDailyMoodModal', handleOpenMoodModal);
    };
  }, []);

  return (
    <PageContainer scrollable={false} className='p-0 pb-0 md:px-0'>
      <DailyMoodModal ref={moodModalRef} />
      <div key='overview-content'>{children}</div>
    </PageContainer>
  );
}
