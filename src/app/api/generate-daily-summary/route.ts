import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createAdminClient } from '@/lib/supabase/admin';
import { auth } from '@clerk/nextjs/server';
import { syncReflectionsForDate } from '@/lib/reflections/sync';
import { getUtcRangeForDate } from '@/lib/timezone';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: NextRequest) {
  try {
    // Verify user authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { date } = body;

    if (!date) {
      return NextResponse.json(
        { error: 'Date parameter is required' },
        { status: 400 }
      );
    }

    console.log(`Generating daily summary for user ${userId} on date ${date}`);

    const supabase = createAdminClient();
    const { start: dayStart, end: dayEnd } = getUtcRangeForDate(date);

    const { data: transcripts, error: transcriptsError } = await supabase
      .from('transcripts')
      .select(
        `
        id,
        text,
        rephrased_text,
        created_at,
        audio_files!inner(
          created_at
        )
      `
      )
      .eq('user_id', userId)
      .gte('audio_files.created_at', dayStart)
      .lte('audio_files.created_at', dayEnd)
      .order('created_at', { ascending: true });

    if (transcriptsError) {
      console.error('Error fetching transcripts:', transcriptsError);
      return NextResponse.json(
        { error: 'Failed to fetch transcripts' },
        { status: 500 }
      );
    }

    if (!transcripts || transcripts.length === 0) {
      console.log('No transcripts found for this date');
      return NextResponse.json({
        success: true,
        message: 'No journal entries found for this date'
      });
    }

    // Step 2: Get daily mood data
    const { data: moodData, error: moodError } = await supabase
      .from('daily_question')
      .select('day_quality, emotions')
      .eq('user_id', userId)
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd)
      .single();

    if (moodError && moodError.code !== 'PGRST116') {
      console.error('Error fetching mood data:', moodError);
    }

    // Step 3: Generate summary using GPT-4o
    const journalTexts = transcripts
      .map((t, index) => {
        const time = new Date(t.created_at!).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });
        return `Entry ${index + 1} (${time}): ${t.rephrased_text || t.text}`;
      })
      .join('\n\n');

    const moodContext = moodData
      ? `\nToday's mood: ${moodData.day_quality}, feeling ${moodData.emotions.join(', ')}.`
      : '';

    const summaryResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a thoughtful journal assistant that creates concise daily summaries.
                   
                   Your task is to:
                   - Synthesize multiple journal entries into a coherent daily narrative
                   - Maintain first-person perspective throughout
                   - Identify key themes, emotions, and insights from the day
                   - Highlight important events or realizations
                   - Keep the summary between 3-5 sentences
                   - Make it reflective and meaningful
                   - Consider the overall mood context if provided
                   
                   The summary should read like a thoughtful reflection on the day, not just a list of events.`
        },
        {
          role: 'user',
          content: `Create a daily summary from these journal entries:${moodContext}\n\n${journalTexts}`
        }
      ],
      max_tokens: 300,
      temperature: 0.7
    });

    const summary = summaryResponse.choices[0]?.message?.content || '';
    console.log('Generated summary:', summary.substring(0, 100) + '...');

    // Step 4: Upsert daily summary
    const { data: summaryData, error: summaryError } = await supabase
      .from('daily_summaries')
      .upsert(
        {
          user_id: userId,
          date: date,
          summary: summary,
          entry_count: transcripts.length,
          mood_quality: moodData?.day_quality || null,
          dominant_emotions: moodData?.emotions || null,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'user_id,date'
        }
      )
      .select()
      .single();

    if (summaryError) {
      console.error('Error saving summary:', summaryError);
      return NextResponse.json(
        { error: 'Failed to save summary' },
        { status: 500 }
      );
    }

    // Trigger echos sync in background to keep summary response fast
    (async () => {
      try {
        await syncReflectionsForDate({
          supabase,
          openai,
          userId,
          anchorDate: date
        });
      } catch (reflectionError) {
        console.error('Background reflections sync failed:', reflectionError);
      }
    })();

    // Return success response
    return NextResponse.json({
      success: true,
      summary: summary,
      entryCount: transcripts.length,
      summaryId: summaryData.id
    });
  } catch (error) {
    console.error('Summary generation error:', error);

    // Handle specific OpenAI errors
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'OpenAI API configuration error' },
          { status: 500 }
        );
      }
      if (error.message.includes('quota')) {
        return NextResponse.json(
          { error: 'API quota exceeded' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error during summary generation' },
      { status: 500 }
    );
  }
}
