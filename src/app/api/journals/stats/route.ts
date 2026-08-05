import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getJournalRepo, NokvUnavailableError } from '@/lib/data';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await getJournalRepo().getEntryStats(userId);

    return NextResponse.json({ stats });
  } catch (error) {
    if (error instanceof NokvUnavailableError) {
      return NextResponse.json(
        { error: 'Data backend unavailable' },
        { status: 503 }
      );
    }
    // eslint-disable-next-line no-console
    console.error('Failed to fetch journal stats', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
