import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { serializeDailyReflection } from '@/lib/reflections/serialize';
import { MAX_LISTED_REFLECTIONS } from '@/lib/reflections/types';

export async function GET(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const searchParams = request.nextUrl.searchParams;
  const limitParam = Number.parseInt(
    searchParams.get('limit') ?? `${MAX_LISTED_REFLECTIONS.daily}`,
    10
  );
  const limit = Number.isNaN(limitParam)
    ? MAX_LISTED_REFLECTIONS.daily
    : Math.min(limitParam, MAX_LISTED_REFLECTIONS.daily);
  const start = searchParams.get('start');

  let query = supabase
    .from('daily_summaries')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);

  if (start) {
    query = query.lte('date', start);
  }

  const { data, error } = await query;

  if (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch daily reflections', error);
    return NextResponse.json(
      { error: 'Failed to fetch reflections' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    cards: (data ?? []).map(serializeDailyReflection)
  });
}
