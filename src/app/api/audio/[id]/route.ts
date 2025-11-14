import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { auth } from '@clerk/nextjs/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify user authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: 'Audio ID is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // First, verify that the audio file belongs to the authenticated user
    const { data: audioFile, error: audioFileError } = await supabase
      .from('audio_files')
      .select('storage_path, mime_type')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (audioFileError || !audioFile) {
      return NextResponse.json(
        { error: 'Audio file not found or access denied' },
        { status: 404 }
      );
    }

    // Get the audio file from Supabase Storage
    const { data: audioData, error: storageError } = await supabase.storage
      .from('audio-files')
      .download(audioFile.storage_path);

    if (storageError || !audioData) {
      // eslint-disable-next-line no-console
      console.error('Error downloading audio file:', storageError);
      return NextResponse.json(
        { error: 'Failed to retrieve audio file' },
        { status: 500 }
      );
    }

    // Convert blob to array buffer
    const buffer = await audioData.arrayBuffer();

    // Return the audio file with appropriate headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': audioFile.mime_type || 'audio/webm',
        'Content-Length': buffer.byteLength.toString(),
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
        'Accept-Ranges': 'bytes'
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error serving audio file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
