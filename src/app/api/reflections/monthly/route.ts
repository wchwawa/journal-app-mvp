import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { serializePeriodReflection } from '@/lib/reflections/serialize';
import { MAX_LISTED_REFLECTIONS } from '@/lib/reflections/types';

export async function GET(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const searchParams = request.nextUrl.searchParams;
  const limitParam = Number.parseInt(
    searchParams.get('limit') ?? `${MAX_LISTED_REFLECTIONS.monthly}`,
    10
  );
  const limit = Number.isNaN(limitParam)
    ? MAX_LISTED_REFLECTIONS.monthly
    : Math.min(limitParam, MAX_LISTED_REFLECTIONS.monthly);

  const { data, error } = await supabase
    .from('period_reflections')
    .select('*')
    .eq('user_id', userId)
    .eq('period_type', 'monthly')
    .order('period_start', { ascending: false })
    .limit(limit);

  if (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch monthly reflections', error);
    return NextResponse.json(
      { error: 'Failed to fetch reflections' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    cards: (data ?? []).map(serializePeriodReflection)
  });
}
