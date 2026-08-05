import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import OpenAI from 'openai';
import { findVoiceById } from '@/lib/agent/voices';
import { REALTIME_MODEL } from '@/lib/ai/models';
import { isTrustedOrigin } from '@/lib/security';
import { isNokvEnabled } from '@/lib/nokv/mcp-client';
import {
  createSessionWorkspace,
  mintSessionRef
} from '@/lib/nokv/session-workspace';

// Mint an ephemeral client secret for the GA Realtime API.
// The session config (model + voice) is bound server-side so the client
// cannot escalate to a more expensive model.
export async function POST(request: NextRequest) {
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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const voiceProfile = findVoiceById(
      typeof body?.voice === 'string' ? body.voice : undefined
    );

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const secret = await openai.realtime.clientSecrets.create({
      session: {
        type: 'realtime',
        model: REALTIME_MODEL,
        audio: {
          // semantic_vad tolerates the long pauses of journaling monologues
          // far better than server_vad's fixed silence threshold.
          input: {
            turn_detection: { type: 'semantic_vad', eagerness: 'low' }
          },
          output: { voice: voiceProfile.voice }
        }
      }
    });

    if (!secret?.value) {
      return NextResponse.json(
        { error: 'Ephemeral token missing in response' },
        { status: 500 }
      );
    }

    // Optional NoKV session workspace: mint a signed ref for the client and
    // create the workbench after the response (never on the hot path).
    let sessionRef: string | null = null;
    if (isNokvEnabled()) {
      sessionRef = mintSessionRef(userId);
      if (sessionRef) {
        const startedAt = new Date().toISOString();
        const ref = sessionRef;
        after(() =>
          createSessionWorkspace(userId, ref, {
            voice: voiceProfile.voice,
            model: REALTIME_MODEL,
            startedAt
          })
        );
      }
    }

    return NextResponse.json({
      token: secret.value,
      expiresAt: secret.expires_at,
      model: REALTIME_MODEL,
      voice: voiceProfile.voice,
      ...(sessionRef ? { sessionRef } : {})
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Realtime token error', error);
    return NextResponse.json(
      { error: 'Unable to create realtime session' },
      { status: 500 }
    );
  }
}
