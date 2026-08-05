import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { getJournalRepo, NokvUnavailableError } from '@/lib/data';
import type { DailySummary } from '@/lib/data';
import { patchDailySchema } from '@/lib/reflections/schema';
import { serializeDailyReflection } from '@/lib/reflections/serialize';
import type { Tables } from '@/types/supabase';
import { isTrustedOrigin } from '@/lib/security';

const paramsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
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

    const finalParams = paramsSchema.parse(await params);
    const payload = patchDailySchema.parse(await request.json());

    const repo = getJournalRepo();

    let existing: DailySummary | null;
    try {
      existing = await repo.getDailySummary(userId, finalParams.date);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch daily reflection', error);
      return NextResponse.json(
        { error: 'Failed to fetch reflection' },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const patch: Partial<
      Pick<
        DailySummary,
        | 'achievements'
        | 'commitments'
        | 'mood_overall'
        | 'mood_reason'
        | 'flashback'
        | 'gen_version'
        | 'last_generated_at'
      >
    > = {
      last_generated_at: existing.last_generated_at,
      gen_version: existing.gen_version
    };

    if (payload.achievements !== undefined) {
      patch.achievements = payload.achievements;
    }

    if (payload.commitments !== undefined) {
      patch.commitments = payload.commitments;
    }

    if (payload.moodOverall !== undefined) {
      patch.mood_overall = payload.moodOverall;
    }

    if (payload.moodReason !== undefined) {
      patch.mood_reason = payload.moodReason;
    }

    if (payload.flashback !== undefined) {
      patch.flashback = payload.flashback;
    }

    let data: DailySummary;
    try {
      data = await repo.updateDailySummaryReflection(
        userId,
        finalParams.date,
        patch,
        { markEdited: true }
      );
    } catch (error) {
      if (error instanceof NokvUnavailableError) {
        return NextResponse.json(
          { error: 'Data backend unavailable' },
          { status: 503 }
        );
      }
      // eslint-disable-next-line no-console
      console.error('Failed to update daily reflection', error);
      return NextResponse.json(
        { error: 'Failed to update reflection' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      card: serializeDailyReflection(data as Tables<'daily_summaries'>)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.flatten() },
        { status: 422 }
      );
    }
    // eslint-disable-next-line no-console
    console.error('Daily reflection patch error', error);
    return NextResponse.json(
      { error: 'Failed to update reflection' },
      { status: 500 }
    );
  }
}
