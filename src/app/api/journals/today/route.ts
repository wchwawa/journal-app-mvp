import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getJournalRepo, NokvUnavailableError } from '@/lib/data';
import type { JournalEntry } from '@/lib/data';
import { getLocalDayRange } from '@/lib/timezone';

// Wire shape kept identical to the audio_files + transcripts rows the
// browser previously read from Supabase directly (use-audio-journal.ts).
function toWireEntry(userId: string, entry: JournalEntry) {
  return {
    id: entry.legacy_audio_id ?? entry.id,
    user_id: userId,
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
  };
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date } = getLocalDayRange();
    const entries = await getJournalRepo().listEntriesForDay(userId, date);

    // Repo returns ascending; the browser expects newest first.
    const wireEntries = entries
      .slice()
      .reverse()
      .map((entry) => toWireEntry(userId, entry));

    return NextResponse.json({ entries: wireEntries });
  } catch (error) {
    if (error instanceof NokvUnavailableError) {
      return NextResponse.json(
        { error: 'Data backend unavailable' },
        { status: 503 }
      );
    }
    // eslint-disable-next-line no-console
    console.error('Failed to fetch today journals', error);
    return NextResponse.json(
      { error: 'Failed to fetch journals' },
      { status: 500 }
    );
  }
}
