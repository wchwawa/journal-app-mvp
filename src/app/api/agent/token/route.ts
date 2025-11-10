import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { findVoiceById } from '@/lib/agent/voices';
import OpenAI from 'openai';

const REALTIME_MODEL = 'gpt-realtime';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const voiceParam = request.nextUrl.searchParams.get('voice') ?? undefined;
    const voiceProfile = findVoiceById(voiceParam);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const session = await openai.beta.realtime.sessions.create({
      // type: "realtime",
      model: REALTIME_MODEL
    });

    const token: string | undefined = session?.client_secret.value;
    if (!token) {
      return NextResponse.json(
        { error: 'Ephemeral token missing in response' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      token,
      model: REALTIME_MODEL,
      voice: voiceProfile.voice
    });
  } catch (error) {
    console.error('Realtime token error', error);
    return NextResponse.json(
      { error: 'Unable to create realtime session' },
      { status: 500 }
    );
  }
}
