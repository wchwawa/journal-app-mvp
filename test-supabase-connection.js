const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Test Supabase connection and data insertion
async function testSupabaseConnection() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables');
    console.log(
      'NEXT_PUBLIC_SUPABASE_URL:',
      supabaseUrl ? '✓ Set' : '✗ Missing'
    );
    console.log(
      'SUPABASE_SERVICE_ROLE_KEY:',
      supabaseServiceKey ? '✓ Set' : '✗ Missing'
    );
    return;
  }

  console.log('📍 Supabase URL:', supabaseUrl);
  console.log('🔑 Service Key:', supabaseServiceKey.substring(0, 20) + '...');

  // Create admin client (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Test 1: Check if we can query tables
    console.log('\n📊 Testing table access...');

    const { data: audioFiles, error: audioError } = await supabase
      .from('audio_files')
      .select('count')
      .limit(1);

    if (audioError) {
      console.error('❌ Error accessing audio_files table:', audioError);
    } else {
      console.log('✅ Successfully accessed audio_files table');
    }

    const { data: transcripts, error: transcriptError } = await supabase
      .from('transcripts')
      .select('count')
      .limit(1);

    if (transcriptError) {
      console.error('❌ Error accessing transcripts table:', transcriptError);
    } else {
      console.log('✅ Successfully accessed transcripts table');
    }

    const { data: dailySummaries, error: summaryError } = await supabase
      .from('daily_summaries')
      .select('count')
      .limit(1);

    if (summaryError) {
      console.error('❌ Error accessing daily_summaries table:', summaryError);
    } else {
      console.log('✅ Successfully accessed daily_summaries table');
    }

    // Test 2: Try to insert test data
    console.log('\n📝 Testing data insertion...');

    const testUserId = 'test_user_' + Date.now();
    const testAudioId = crypto.randomUUID
      ? crypto.randomUUID()
      : 'test_audio_' + Date.now();
    const testTranscriptId = crypto.randomUUID
      ? crypto.randomUUID()
      : 'test_transcript_' + Date.now();

    // Insert test audio file
    const { data: audioData, error: audioInsertError } = await supabase
      .from('audio_files')
      .insert({
        id: testAudioId,
        user_id: testUserId,
        storage_path: 'test/path/file.webm',
        mime_type: 'audio/webm',
        duration_ms: 5000
      })
      .select()
      .single();

    if (audioInsertError) {
      console.error('❌ Error inserting audio file:', audioInsertError);
    } else {
      console.log('✅ Successfully inserted audio file:', audioData.id);

      // Insert test transcript
      const { data: transcriptData, error: transcriptInsertError } =
        await supabase
          .from('transcripts')
          .insert({
            id: testTranscriptId,
            user_id: testUserId,
            audio_id: audioData.id,
            text: 'Test transcript text',
            rephrased_text: 'Test rephrased text',
            language: 'en'
          })
          .select()
          .single();

      if (transcriptInsertError) {
        console.error('❌ Error inserting transcript:', transcriptInsertError);
      } else {
        console.log('✅ Successfully inserted transcript:', transcriptData.id);
      }

      // Clean up test data
      console.log('\n🧹 Cleaning up test data...');

      await supabase.from('transcripts').delete().eq('id', testTranscriptId);

      await supabase.from('audio_files').delete().eq('id', testAudioId);

      console.log('✅ Test data cleaned up');
    }

    // Test 3: Check storage bucket
    console.log('\n📦 Testing storage bucket...');
    const { data: buckets, error: bucketError } =
      await supabase.storage.listBuckets();

    if (bucketError) {
      console.error('❌ Error listing storage buckets:', bucketError);
    } else {
      console.log(
        '✅ Storage buckets found:',
        buckets.map((b) => b.name).join(', ')
      );

      // Check if audio-files bucket exists
      const audioFilesBucket = buckets.find((b) => b.name === 'audio-files');
      if (audioFilesBucket) {
        console.log('✅ audio-files bucket exists');
      } else {
        console.log('⚠️  audio-files bucket not found');
      }
    }

    console.log('\n✨ All tests completed!');
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testSupabaseConnection();
