import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { auth } from '@clerk/nextjs/server';
import { getLocalDayRange } from '@/lib/timezone';
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

    const supabase = createAdminClient();

    // First, verify that the audio file belongs to the authenticated user
    const { data: audioFile, error: audioFileError } = await supabase
      .from('audio_files')
      .select('id, user_id, created_at')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (audioFileError || !audioFile) {
      return NextResponse.json(
        { error: 'Journal entry not found or access denied' },
        { status: 404 }
      );
    }

    // Update the transcript's rephrased text
    const { data: transcript, error: updateError } = await supabase
      .from('transcripts')
      .update({
        rephrased_text: rephrased_text
      })
      .eq('audio_id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      // eslint-disable-next-line no-console
      console.error('Error updating transcript:', updateError);
      return NextResponse.json(
        { error: 'Failed to update journal entry' },
        { status: 500 }
      );
    }

    // Trigger daily summary regeneration
    const audioCreatedAt = new Date(audioFile.created_at || new Date());
    const { date: entryDate } = getLocalDayRange({ date: audioCreatedAt });

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
      transcript
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

    const supabase = createAdminClient();

    // First, verify that the audio file belongs to the authenticated user
    const { data: audioFile, error: audioFileError } = await supabase
      .from('audio_files')
      .select('id, user_id, storage_path, created_at')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (audioFileError || !audioFile) {
      return NextResponse.json(
        { error: 'Journal entry not found or access denied' },
        { status: 404 }
      );
    }

    // Delete the transcript first (due to foreign key constraint)
    const { error: transcriptDeleteError } = await supabase
      .from('transcripts')
      .delete()
      .eq('audio_id', id)
      .eq('user_id', userId);

    if (transcriptDeleteError) {
      // eslint-disable-next-line no-console
      console.error('Error deleting transcript:', transcriptDeleteError);
      return NextResponse.json(
        { error: 'Failed to delete transcript' },
        { status: 500 }
      );
    }

    // Delete the audio file from storage
    const { error: storageDeleteError } = await supabase.storage
      .from('audio-files')
      .remove([audioFile.storage_path]);

    if (storageDeleteError) {
      // eslint-disable-next-line no-console
      console.error(
        'Error deleting audio file from storage:',
        storageDeleteError
      );
      // Continue with database deletion even if storage deletion fails
    }

    // Delete the audio file record from database
    const { error: audioDeleteError } = await supabase
      .from('audio_files')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (audioDeleteError) {
      // eslint-disable-next-line no-console
      console.error('Error deleting audio file record:', audioDeleteError);
      return NextResponse.json(
        { error: 'Failed to delete journal entry' },
        { status: 500 }
      );
    }

    // Trigger daily summary regeneration
    const audioCreatedAt = new Date(audioFile.created_at || new Date());
    const { date: entryDate } = getLocalDayRange({ date: audioCreatedAt });

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
