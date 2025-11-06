const fs = require('fs');
const path = require('path');

async function testTranscribeAPI() {
  console.log('🎤 Testing /api/transcribe route...\n');

  // Create a small test audio file (just a dummy file for testing)
  const testAudioPath = path.join(__dirname, 'test-audio.webm');
  const dummyAudioData = Buffer.from('test audio data');
  fs.writeFileSync(testAudioPath, dummyAudioData);

  try {
    // Prepare form data
    const FormData = require('form-data');
    const form = new FormData();

    // Add audio file
    form.append('audio', fs.createReadStream(testAudioPath), {
      filename: 'recording.webm',
      contentType: 'audio/webm'
    });

    // Test without authentication (should fail)
    console.log('📡 Test 1: Calling API without authentication...');
    const response1 = await fetch('http://localhost:3001/api/transcribe', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    console.log('Response status:', response1.status);
    const result1 = await response1.text();
    console.log('Response:', result1.substring(0, 200));

    if (response1.status === 401) {
      console.log('✅ Correctly returned 401 Unauthorized\n');
    } else {
      console.log('⚠️  Unexpected status code\n');
    }

    // Note: To properly test with authentication, we would need:
    // 1. A valid Clerk session token
    // 2. Or modify the API to accept a test mode

    console.log('💡 The issue is likely that:');
    console.log('1. The API route expects Clerk authentication (await auth())');
    console.log(
      '2. When you record audio, you might not be properly authenticated'
    );
    console.log(
      '3. Or the Clerk session might not be passed correctly to the API\n'
    );

    console.log('🔍 To debug further:');
    console.log('1. Check browser DevTools Network tab when recording');
    console.log('2. Look for the /api/transcribe request');
    console.log('3. Check if authentication headers are included');
    console.log('4. Check the response status and error message');
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  } finally {
    // Clean up test file
    if (fs.existsSync(testAudioPath)) {
      fs.unlinkSync(testAudioPath);
    }
  }
}

testTranscribeAPI();
