import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getJournalsWithSummaries } from '@/lib/supabase/queries';
import { isTrustedOrigin } from '@/lib/security';

type FiltersPayload = {
  startDate?: string | null;
  endDate?: string | null;
  moods?: string[] | null;
  keyword?: string | null;
  page?: number;
  limit?: number;
};

export async function POST(request: NextRequest) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json(
      { error: 'Invalid request origin' },
      { status: 403 }
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: FiltersPayload = {};
  try {
    payload = (await request.json()) ?? {};
  } catch {
    payload = {};
  }

  const page = Math.max(1, Math.trunc(payload.page ?? 1));
  const limit = Math.min(50, Math.max(1, Math.trunc(payload.limit ?? 10)));

  const options = {
    startDate: payload.startDate || undefined,
    endDate: payload.endDate || undefined,
    moods:
      payload.moods && payload.moods.length > 0 ? payload.moods : undefined,
    keyword: payload.keyword || undefined,
    page,
    limit
  };

  try {
    const supabase = createAdminClient();
    const result = await getJournalsWithSummaries(supabase, userId, options);
    return NextResponse.json(result);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch journals via API route', error);
    return NextResponse.json(
      { error: 'Failed to fetch journals' },
      { status: 500 }
    );
  }
}
