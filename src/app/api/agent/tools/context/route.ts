import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchUserContext } from '@/lib/agent/context';

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

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const raw = await request.json();
    const payload = payloadSchema.parse(raw);

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
