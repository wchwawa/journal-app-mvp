import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getJournalRepo } from '@/lib/data';
import { serializeDailyReflection } from '@/lib/reflections/serialize';
import { MAX_LISTED_REFLECTIONS } from '@/lib/reflections/types';
import type { Tables } from '@/types/supabase';

export async function GET(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limitParam = Number.parseInt(
    searchParams.get('limit') ?? `${MAX_LISTED_REFLECTIONS.daily}`,
    10
  );
  const limit = Number.isNaN(limitParam)
    ? MAX_LISTED_REFLECTIONS.daily
    : Math.min(limitParam, MAX_LISTED_REFLECTIONS.daily);
  const start = searchParams.get('start');

  try {
    const data = await getJournalRepo().listDailySummaries(userId, {
      before: start ?? undefined,
      limit
    });

    return NextResponse.json({
      cards: data.map((row) =>
        serializeDailyReflection(row as Tables<'daily_summaries'>)
      )
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch daily reflections', error);
    return NextResponse.json(
      { error: 'Failed to fetch reflections' },
      { status: 500 }
    );
  }
}
