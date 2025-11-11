import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchUserContext } from '@/lib/agent/context';
import type { ContextRequest } from '@/lib/agent/context';
import { isTrustedOrigin } from '@/lib/security';

const payloadSchema = z.object({
  scope: z
    .enum(['today', 'week', 'month', 'recent', 'custom'])
    .default('recent'),
  anchorDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  limit: z.number().int().min(1).max(20).optional(),
  range: z
    .object({
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    })
    .optional()
});

// Handle context retrieval for agent tool requests
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

    const raw = await request.json();
    const parsed = payloadSchema.parse(raw);
    const payload: ContextRequest = {
      ...parsed,
      anchorDate: parsed.anchorDate ?? undefined
    };

    if (payload.scope === 'custom' && !payload.range) {
      return NextResponse.json(
        { error: 'Custom scope requires range' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const context = await fetchUserContext(supabase, userId, payload);

    return NextResponse.json({ context });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.flatten() },
        { status: 422 }
      );
    }

    console.error('Context tool error', error);
    return NextResponse.json(
      { error: 'Failed to fetch context' },
      { status: 500 }
    );
  }
}
