import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createAdminClient } from '@/lib/supabase/admin';
import { auth } from '@clerk/nextjs/server';
import { syncReflectionsForDate } from '@/lib/reflections/sync';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Helper function to generate daily summary
async function generateDailySummary(
  userId: string,
  supabase: any,
  openaiClient: OpenAI
) {
  const currentDate = new Date().toISOString().split('T')[0];

  console.log(
    `Generating daily summary for user ${userId} on date ${currentDate}`
  );

  // Step 1: Get all transcripts for today
  const startOfDay = new Date(currentDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(currentDate);
  endOfDay.setHours(23, 59, 59, 999);

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
    .gte('audio_files.created_at', startOfDay.toISOString())
    .lte('audio_files.created_at', endOfDay.toISOString())
    .order('created_at', { ascending: true });

  if (transcriptsError) {
    console.error('Error fetching transcripts for summary:', transcriptsError);
    throw transcriptsError;
  }

  if (!transcripts || transcripts.length === 0) {
    console.log('No transcripts found for summary generation');
    return;
  }

  // Step 2: Get daily mood data
  const { data: moodData, error: moodError } = await supabase
    .from('daily_question')
    .select('day_quality, emotions')
    .eq('user_id', userId)
    .gte('created_at', startOfDay.toISOString())
    .lte('created_at', endOfDay.toISOString())
    .single();

  if (moodError && moodError.code !== 'PGRST116') {
    console.error('Error fetching mood data for summary:', moodError);
  }

  // Step 3: Generate summary using GPT-4o
  const journalTexts = transcripts
    .map((t: any, index: number) => {
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

  const summaryResponse = await openaiClient.chat.completions.create({
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
        date: currentDate,
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
    throw summaryError;
  }

  console.log('Daily summary generated successfully:', summaryData.id);
  return summaryData;
}

export async function POST(request: NextRequest) {
  try {
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

    console.log(
      `Processing audio file: ${audioFile.name}, size: ${audioFile.size} bytes`
    );

    // Step 1: Transcribe audio with Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'text'
    });

    if (!transcription || transcription.trim().length === 0) {
      return NextResponse.json(
        { error: 'No speech detected in audio' },
        { status: 400 }
      );
    }

    console.log(
      'Transcription completed:',
      transcription.substring(0, 100) + '...'
    );

    // Step 2: AI rephraser for rephrasing the transcription
    const summaryResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
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
      max_tokens: 300,
      temperature: 0.3
    });

    const rephrasedText = summaryResponse.choices[0]?.message?.content || '';
    console.log('Summary generated:', rephrasedText.substring(0, 100) + '...');

    // Step 3: Store audio file in Supabase Storage
    const supabase = createAdminClient();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `journal-audio/${userId}/${timestamp}-recording.webm`;

    const audioBuffer = await audioFile.arrayBuffer();
    const { data: storageData, error: storageError } = await supabase.storage
      .from('audio-files')
      .upload(fileName, audioBuffer, {
        contentType: audioFile.type,
        upsert: false
      });

    if (storageError) {
      console.error('Storage error:', storageError);
      return NextResponse.json(
        { error: 'Failed to store audio file' },
        { status: 500 }
      );
    }

    console.log('Audio stored at:', storageData.path);

    // Step 4: Save audio file metadata
    const { data: audioFileData, error: audioFileError } = await supabase
      .from('audio_files')
      .insert({
        user_id: userId,
        storage_path: storageData.path,
        mime_type: audioFile.type,
        duration_ms: null // Could be calculated from audio if needed
      })
      .select()
      .single();

    if (audioFileError) {
      console.error('Audio file DB error:', audioFileError);
      return NextResponse.json(
        { error: 'Failed to save audio metadata' },
        { status: 500 }
      );
    }

    // Step 5: Save transcript with rephrased text
    const { data: transcriptData, error: transcriptError } = await supabase
      .from('transcripts')
      .insert({
        user_id: userId,
        audio_id: audioFileData.id,
        text: transcription,
        rephrased_text: rephrasedText,
        language: 'en' // Could be detected from Whisper if neededs
      })
      .select()
      .single();

    if (transcriptError) {
      console.error('Transcript DB error:', transcriptError);
      return NextResponse.json(
        { error: 'Failed to save transcript' },
        { status: 500 }
      );
    }

    // Step 6: Kick off daily summary + echos sync in background (non-blocking)
    (async () => {
      try {
        const summaryData = await generateDailySummary(
          userId,
          supabase,
          openai
        );
        if (summaryData?.date) {
          await syncReflectionsForDate({
            supabase,
            openai,
            userId,
            anchorDate: summaryData.date
          });
        }
      } catch (summaryError) {
        console.error('Background daily summary failed:', summaryError);
      }
    })();

    // Return success response
    return NextResponse.json({
      success: true,
      transcription,
      rephrasedText,
      audioFileId: audioFileData.id,
      transcriptId: transcriptData.id
    });
  } catch (error) {
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
