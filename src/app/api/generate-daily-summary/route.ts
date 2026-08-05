import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import OpenAI from 'openai';
import { auth } from '@clerk/nextjs/server';
import { getJournalRepo, NokvUnavailableError } from '@/lib/data';
import type { DailySummary, JournalEntry, MoodEntry } from '@/lib/data';
import { syncReflectionsForDate } from '@/lib/reflections/sync';
import { isTrustedOrigin } from '@/lib/security';
import { SUMMARY_MODEL } from '@/lib/ai/models';

// Summary generation chains OpenAI calls; allow more than the platform default.
export const maxDuration = 120;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: NextRequest) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json(
        { error: 'Invalid request origin' },
        { status: 403 }
      );
    }

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

    const repo = getJournalRepo();

    // Step 1: Get all journal entries for the requested date
    let entries: JournalEntry[];
    try {
      entries = await repo.listEntriesForDay(userId, date);
    } catch (entriesError) {
      // eslint-disable-next-line no-console
      console.error('Error fetching transcripts:', entriesError);
      return NextResponse.json(
        { error: 'Failed to fetch transcripts' },
        { status: 500 }
      );
    }

    if (entries.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No journal entries found for this date'
      });
    }

    // Step 2: Get daily mood data (non-fatal when unavailable)
    let mood: MoodEntry | null = null;
    try {
      mood = await repo.getMood(userId, date);
    } catch (moodError) {
      // eslint-disable-next-line no-console
      console.error('Error fetching mood data:', moodError);
    }

    // Step 3: Generate summary using GPT-4o
    const journalTexts = entries
      .map((entry, index) => {
        const time = new Date(entry.created_at).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });
        return `Entry ${index + 1} (${time}): ${entry.transcript.rephrased_text || entry.transcript.text}`;
      })
      .join('\n\n');

    const moodContext = mood
      ? `\nToday's mood: ${mood.day_quality}, feeling ${mood.emotions.join(', ')}.`
      : '';

    const summaryResponse = await openai.chat.completions.create({
      model: SUMMARY_MODEL,
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
      max_completion_tokens: 300
    });

    const summary = summaryResponse.choices[0]?.message?.content || '';

    // Step 4: Upsert daily summary
    let summaryData: DailySummary;
    try {
      summaryData = await repo.upsertDailySummary(userId, date, {
        summary,
        entryCount: entries.length,
        moodQuality: mood?.day_quality || null,
        dominantEmotions: mood?.emotions || []
      });
    } catch (summaryError) {
      if (summaryError instanceof NokvUnavailableError) {
        return NextResponse.json(
          { error: 'Data backend temporarily unavailable' },
          { status: 503 }
        );
      }
      // eslint-disable-next-line no-console
      console.error('Error saving summary:', summaryError);
      return NextResponse.json(
        { error: 'Failed to save summary' },
        { status: 500 }
      );
    }

    // Echos sync after the response is sent. after() is guaranteed to run on
    // serverless, unlike a floating promise dropped when the instance freezes.
    after(async () => {
      try {
        await syncReflectionsForDate({
          openai,
          userId,
          anchorDate: date
        });
      } catch (reflectionError) {
        // eslint-disable-next-line no-console
        console.error('Background reflections sync failed:', reflectionError);
      }
    });

    // Return success response
    return NextResponse.json({
      success: true,
      summary: summary,
      entryCount: entries.length,
      summaryId: summaryData.id
    });
  } catch (error) {
    // eslint-disable-next-line no-console
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
