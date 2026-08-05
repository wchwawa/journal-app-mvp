import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getJournalRepo } from '@/lib/data';
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
    const repo = getJournalRepo();
    const { days, totalCount } = await repo.queryJournalDays(userId, options);

    // Map domain DayBundles back to the legacy wire shape the journal list UI
    // expects: { ...summaryColumns, journals: [audioRow + transcripts], dailyMood }.
    const data = days.map((day) => ({
      ...(day.summary ?? { date: day.date }),
      journals: day.entries.map((entry) => ({
        id: entry.id,
        user_id: userId,
        // Domain entries no longer expose storage paths; key kept for wire
        // compatibility only (no consumer reads it).
        storage_path: '',
        mime_type: entry.audio.mime_type,
        duration_ms: entry.audio.duration_ms,
        created_at: entry.created_at,
        transcripts: [
          {
            id: entry.id,
            text: entry.transcript.text,
            rephrased_text: entry.transcript.rephrased_text,
            language: entry.transcript.language,
            created_at: entry.transcript.updated_at
          }
        ]
      })),
      dailyMood: day.mood
        ? {
            id: day.mood.id,
            user_id: userId,
            day_quality: day.mood.day_quality,
            emotions: day.mood.emotions,
            created_at: day.mood.created_at,
            updated_at: day.mood.updated_at
          }
        : null
    }));

    return NextResponse.json({ data, totalCount });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch journals via API route', error);
    return NextResponse.json(
      { error: 'Failed to fetch journals' },
      { status: 500 }
    );
  }
}
