import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import OpenAI from 'openai';
import { ZodError } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateReflection } from '@/lib/reflections/generator';
import { syncPayloadSchema } from '@/lib/reflections/schema';

export async function POST(request: NextRequest) {
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

    const payload = await request.json();
    const parsed = syncPayloadSchema.parse(payload);

    const supabase = createAdminClient();
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const result = await generateReflection({
      supabase,
      openai,
      userId,
      mode: parsed.mode,
      anchorDate: parsed.anchorDate
    });

    return NextResponse.json({ success: true, card: result });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.flatten() },
        { status: 422 }
      );
    }
    console.error('Reflection sync error:', error);
    return NextResponse.json(
      { error: 'Failed to generate reflection' },
      { status: 500 }
    );
  }
}
