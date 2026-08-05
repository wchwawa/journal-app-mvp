import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getJournalRepo } from '@/lib/data';

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

    const repo = getJournalRepo();
    const audio = await repo.getAudioBlob(userId, id);

    if (!audio) {
      return NextResponse.json(
        { error: 'Audio file not found or access denied' },
        { status: 404 }
      );
    }

    // Return the audio file with appropriate headers
    return new NextResponse(audio.data, {
      status: 200,
      headers: {
        'Content-Type': audio.mimeType || 'audio/webm',
        'Content-Length': audio.data.byteLength.toString(),
        'Cache-Control': 'private, max-age=3600' // Cache for 1 hour
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
