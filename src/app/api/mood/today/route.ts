import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { getJournalRepo, NokvUnavailableError } from '@/lib/data';
import { getLocalDayRange } from '@/lib/timezone';
import { isTrustedOrigin } from '@/lib/security';

const putBodySchema = z.object({
  dayQuality: z.string().min(1),
  emotions: z.array(z.string()).default([])
});

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date } = getLocalDayRange();
    const mood = await getJournalRepo().getMood(userId, date);

    return NextResponse.json({ mood });
  } catch (error) {
    if (error instanceof NokvUnavailableError) {
      return NextResponse.json(
        { error: 'Data backend unavailable' },
        { status: 503 }
      );
    }
    // eslint-disable-next-line no-console
    console.error('Failed to fetch today mood', error);
    return NextResponse.json(
      { error: 'Failed to fetch mood' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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

    const payload = putBodySchema.parse(await request.json());

    const { date } = getLocalDayRange();
    const mood = await getJournalRepo().upsertMood(userId, date, {
      dayQuality: payload.dayQuality,
      emotions: payload.emotions
    });

    return NextResponse.json({ mood });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.flatten() },
        { status: 422 }
      );
    }
    if (error instanceof NokvUnavailableError) {
      return NextResponse.json(
        { error: 'Data backend unavailable' },
        { status: 503 }
      );
    }
    // eslint-disable-next-line no-console
    console.error('Failed to save today mood', error);
    return NextResponse.json({ error: 'Failed to save mood' }, { status: 500 });
  }
}
