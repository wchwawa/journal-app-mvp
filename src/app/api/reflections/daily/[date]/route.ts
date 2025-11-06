import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { patchDailySchema } from '@/lib/reflections/schema';
import { serializeDailyReflection } from '@/lib/reflections/serialize';
import type { TablesUpdate } from '@/types/supabase';

const paramsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const finalParams = paramsSchema.parse(await params);
    const payload = patchDailySchema.parse(await request.json());

    const supabase = createAdminClient();

    const { data: existing, error: existingError } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', finalParams.date)
      .single();

    if (existingError) {
      if (existingError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      console.error('Failed to fetch daily reflection', existingError);
      return NextResponse.json(
        { error: 'Failed to fetch reflection' },
        { status: 500 }
      );
    }

    const updatePayload: TablesUpdate<'daily_summaries'> = {
      edited: true,
      last_generated_at: existing.last_generated_at,
      gen_version: existing.gen_version
    };

    if (payload.achievements !== undefined) {
      updatePayload.achievements = payload.achievements;
    }

    if (payload.commitments !== undefined) {
      updatePayload.commitments = payload.commitments;
    }

    if (payload.moodOverall !== undefined) {
      updatePayload.mood_overall = payload.moodOverall;
    }

    if (payload.moodReason !== undefined) {
      updatePayload.mood_reason = payload.moodReason;
    }

    if (payload.flashback !== undefined) {
      updatePayload.flashback = payload.flashback;
    }

    const { data, error } = await supabase
      .from('daily_summaries')
      .update(updatePayload)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update daily reflection', error);
      return NextResponse.json(
        { error: 'Failed to update reflection' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      card: serializeDailyReflection(data)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.flatten() },
        { status: 422 }
      );
    }
    console.error('Daily reflection patch error', error);
    return NextResponse.json(
      { error: 'Failed to update reflection' },
      { status: 500 }
    );
  }
}
