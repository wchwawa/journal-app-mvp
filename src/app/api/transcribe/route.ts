import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import OpenAI from 'openai';
import { auth } from '@clerk/nextjs/server';
import { getJournalRepo, NokvUnavailableError } from '@/lib/data';
import type { JournalEntry, MoodEntry } from '@/lib/data';
import { syncReflectionsForDate } from '@/lib/reflections/sync';
import { getLocalDayRange } from '@/lib/timezone';
import { isTrustedOrigin } from '@/lib/security';
import {
  REPHRASE_MODEL,
  SUMMARY_MODEL,
  TRANSCRIBE_MODEL
} from '@/lib/ai/models';

// Transcription + rephrase chain OpenAI calls; allow more than the platform default.
export const maxDuration = 120;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg'
]);

// Helper function to generate daily summary
async function generateDailySummary(userId: string, openaiClient: OpenAI) {
  const repo = getJournalRepo();
  const { date: currentDate } = getLocalDayRange();

  // Step 1: Get all journal entries for today
  const entries = await repo.listEntriesForDay(userId, currentDate);

  if (entries.length === 0) {
    return;
  }

  // Step 2: Get daily mood data (non-fatal when unavailable)
  let mood: MoodEntry | null = null;
  try {
    mood = await repo.getMood(userId, currentDate);
  } catch (moodError) {
    // eslint-disable-next-line no-console
    console.error('Error fetching mood data for summary:', moodError);
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

  const summaryResponse = await openaiClient.chat.completions.create({
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
  return repo.upsertDailySummary(userId, currentDate, {
    summary,
    entryCount: entries.length,
    moodQuality: mood?.day_quality || null,
    dominantEmotions: mood?.emotions || []
  });
}

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

    // Parse form data
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Validate file size (25MB limit for Whisper)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (audioFile.size > maxSize) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }

    const normalizedMime =
      audioFile.type?.split(';')[0]?.toLowerCase() ?? undefined;
    if (!normalizedMime || !ALLOWED_AUDIO_MIME_TYPES.has(normalizedMime)) {
      return NextResponse.json(
        { error: 'Unsupported audio format' },
        { status: 400 }
      );
    }

    // Step 1: Transcribe audio
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: TRANSCRIBE_MODEL,
      response_format: 'text'
    });

    if (!transcription || transcription.trim().length === 0) {
      return NextResponse.json(
        { error: 'No speech detected in audio' },
        { status: 400 }
      );
    }

    // Step 2: AI rephraser for rephrasing the transcription
    const summaryResponse = await openai.chat.completions.create({
      model: REPHRASE_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that transforms spoken journal entries into polished first-person summaries.

                   Your task is to:
                   - Write ENTIRELY in first-person perspective (I, me, my)
                   - Remove ALL filler words, speech disfluencies (um, uh, like, you know)
                   - Eliminate repetitions and redundant expressions
                   - Fix grammar while maintaining the speaker's authentic voice
                   - Preserve key emotions, insights, and important details
                   - Structure thoughts coherently and logically
                   - Keep the personal, reflective tone
                   - Aim for 3-5 sentences that capture the essence

                   Transform the raw transcript into what the person would write if they were journaling directly.`
        },
        {
          role: 'user',
          content: `Transform this spoken journal entry into a first-person written summary:\n\n${transcription}`
        }
      ],
      max_completion_tokens: 300
    });

    const rephrasedText = summaryResponse.choices[0]?.message?.content || '';

    // Step 3: Persist audio + transcript through the data repository
    const repo = getJournalRepo();
    let entry: JournalEntry;
    try {
      entry = await repo.createEntry(userId, {
        audio: Buffer.from(await audioFile.arrayBuffer()),
        mimeType: audioFile.type,
        transcript: transcription,
        rephrasedText: rephrasedText,
        language: 'en'
      });
    } catch (persistError) {
      if (persistError instanceof NokvUnavailableError) {
        return NextResponse.json(
          { error: 'Data backend temporarily unavailable' },
          { status: 503 }
        );
      }
      // eslint-disable-next-line no-console
      console.error('Entry persistence error:', persistError);
      return NextResponse.json(
        { error: 'Failed to save journal entry' },
        { status: 500 }
      );
    }

    // Step 4: Daily summary + echos sync after the response is sent.
    // after() is guaranteed to run on serverless, unlike a floating promise
    // which is dropped when the instance freezes post-response.
    after(async () => {
      try {
        const summaryData = await generateDailySummary(userId, openai);
        if (summaryData?.date) {
          await syncReflectionsForDate({
            openai,
            userId,
            anchorDate: summaryData.date
          });
        }
      } catch (summaryError) {
        // eslint-disable-next-line no-console
        console.error('Background daily summary failed:', summaryError);
      }
    });

    // Return success response
    return NextResponse.json({
      success: true,
      transcription,
      rephrasedText,
      audioFileId: entry.id,
      transcriptId: entry.id
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Transcription error:', error);

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
      {
        error: 'Internal server error during transcription'
      },
      { status: 500 }
    );
  }
}
