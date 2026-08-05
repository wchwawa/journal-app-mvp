import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { isTrustedOrigin } from '@/lib/security';
import { isNokvEnabled } from '@/lib/nokv/mcp-client';
import { commitSession, verifySessionRef } from '@/lib/nokv/session-workspace';

const payloadSchema = z.object({
  sessionRef: z.string().min(10).max(256),
  lastMessage: z.string().max(8192).optional(),
  endedReason: z.enum(['user_disconnect', 'timeout', 'error']).optional()
});

// Commits the session workbench to NoKV. Fire-and-forget from the client
// (keepalive fetch on disconnect); all NoKV work happens after the response.
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

    if (!isNokvEnabled()) {
      return NextResponse.json({ ok: true, disabled: true }, { status: 202 });
    }

    const payload = payloadSchema.parse(await request.json());

    if (!verifySessionRef(userId, payload.sessionRef)) {
      return NextResponse.json(
        { error: 'Invalid session reference' },
        { status: 403 }
      );
    }

    after(async () => {
      try {
        await commitSession(userId, payload.sessionRef, {
          lastMessage: payload.lastMessage,
          endedReason: payload.endedReason
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[nokv] session commit failed', err);
      }
    });

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.flatten() },
        { status: 422 }
      );
    }
    // eslint-disable-next-line no-console
    console.error('Session end error', error);
    return NextResponse.json(
      { error: 'Failed to end session' },
      { status: 500 }
    );
  }
}
