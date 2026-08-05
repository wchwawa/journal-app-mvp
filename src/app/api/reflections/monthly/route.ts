import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getJournalRepo } from '@/lib/data';
import { serializePeriodReflection } from '@/lib/reflections/serialize';
import { MAX_LISTED_REFLECTIONS } from '@/lib/reflections/types';
import type { Tables } from '@/types/supabase';

export async function GET(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limitParam = Number.parseInt(
    searchParams.get('limit') ?? `${MAX_LISTED_REFLECTIONS.monthly}`,
    10
  );
  const limit = Number.isNaN(limitParam)
    ? MAX_LISTED_REFLECTIONS.monthly
    : Math.min(limitParam, MAX_LISTED_REFLECTIONS.monthly);

  try {
    const data = await getJournalRepo().listPeriodReflections(
      userId,
      'monthly',
      limit
    );

    return NextResponse.json({
      cards: data.map((row) =>
        serializePeriodReflection(row as Tables<'period_reflections'>)
      )
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch monthly reflections', error);
    return NextResponse.json(
      { error: 'Failed to fetch reflections' },
      { status: 500 }
    );
  }
}
