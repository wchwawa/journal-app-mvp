import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getJournalRepo, NokvUnavailableError } from '@/lib/data';
import type { JournalEntry } from '@/lib/data';
import { isTrustedOrigin } from '@/lib/security';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json(
        { error: 'Invalid request origin' },
        { status: 403 }
      );
    }

    // Verify user authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: 'Journal ID is required' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { rephrased_text } = body;

    if (!rephrased_text) {
      return NextResponse.json(
        { error: 'Rephrased text is required' },
        { status: 400 }
      );
    }

    const repo = getJournalRepo();

    // First, verify that the journal entry belongs to the authenticated user
    const entry = await repo.getEntry(userId, id);
    if (!entry) {
      return NextResponse.json(
        { error: 'Journal entry not found or access denied' },
        { status: 404 }
      );
    }

    // Update the transcript's rephrased text
    let updated: JournalEntry;
    try {
      updated = await repo.updateRephrasedText(userId, id, rephrased_text);
    } catch (updateError) {
      if (updateError instanceof NokvUnavailableError) {
        return NextResponse.json(
          { error: 'Data backend temporarily unavailable' },
          { status: 503 }
        );
      }
      // eslint-disable-next-line no-console
      console.error('Error updating transcript:', updateError);
      return NextResponse.json(
        { error: 'Failed to update journal entry' },
        { status: 500 }
      );
    }

    // Trigger daily summary regeneration
    const entryDate = entry.date;

    fetch(`${request.nextUrl.origin}/api/generate-daily-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: request.headers.get('authorization') || ''
      },
      body: JSON.stringify({ date: entryDate })
    }).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Failed to trigger daily summary regeneration:', error);
    });

    return NextResponse.json({
      success: true,
      transcript: {
        id: updated.id,
        user_id: userId,
        audio_id: updated.id,
        text: updated.transcript.text,
        rephrased_text: updated.transcript.rephrased_text,
        language: updated.transcript.language,
        created_at: updated.transcript.updated_at
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error updating journal entry:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json(
        { error: 'Invalid request origin' },
        { status: 403 }
      );
    }

    // Verify user authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: 'Journal ID is required' },
        { status: 400 }
      );
    }

    const repo = getJournalRepo();

    // First, verify that the journal entry belongs to the authenticated user
    const entry = await repo.getEntry(userId, id);
    if (!entry) {
      return NextResponse.json(
        { error: 'Journal entry not found or access denied' },
        { status: 404 }
      );
    }

    // Delete transcript, audio blob and entry row
    try {
      await repo.deleteEntry(userId, id);
    } catch (deleteError) {
      if (deleteError instanceof NokvUnavailableError) {
        return NextResponse.json(
          { error: 'Data backend temporarily unavailable' },
          { status: 503 }
        );
      }
      // eslint-disable-next-line no-console
      console.error('Error deleting journal entry:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete journal entry' },
        { status: 500 }
      );
    }

    // Trigger daily summary regeneration
    const entryDate = entry.date;

    fetch(`${request.nextUrl.origin}/api/generate-daily-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: request.headers.get('authorization') || ''
      },
      body: JSON.stringify({ date: entryDate })
    }).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Failed to trigger daily summary regeneration:', error);
    });

    return NextResponse.json({
      success: true,
      message: 'Journal entry deleted successfully'
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error deleting journal entry:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
