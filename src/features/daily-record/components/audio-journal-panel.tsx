'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import {
  Mic,
  Square,
  Loader2,
  Play,
  Pause,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import LiveWaveform from './live-waveform';
import RecordedWaveform from './recorded-waveform';

interface AudioJournalPanelProps {
  className?: string;
}

type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';
type ProcessingState =
  | 'idle'
  | 'transcribing'
  | 'summarizing'
  | 'saving'
  | 'complete'
  | 'error';

const MAX_RECORDING_TIME = 10 * 60 * 1000; // 10 minutes in milliseconds
const JOURNAL_FACTS = [
  '🧠 Daily journaling helps your brain spot positive emotions faster.',
  '🌙 Noting three small wins before bed helps you fall asleep.',
  '🎯 Writing down goals makes them 42% more likely to happen.',
  '❤️ Listing what you’re grateful for eases stress hormones.',
  '☀️ Morning journaling keeps you focused 25% longer.'
];
const EMOJI_REGEX = /\p{Extended_Pictographic}/u;
const WAVE_PRIMARY_COLOR = '#7c3aed';
const WAVE_SECONDARY_COLOR = '#6d28d9';

export default function AudioJournalPanel({
  className
}: AudioJournalPanelProps) {
  const { user } = useUser();
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [processingState, setProcessingState] =
    useState<ProcessingState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const [factIndex, setFactIndex] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const resetState = useCallback(() => {
    setRecordingState('idle');
    setProcessingState('idle');
    setRecordingTime(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setTranscription('');
    setSummary('');
    setError(null);
    setIsPlaying(false);
    setLiveStream(null);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      (recordingState === 'recording' || recordingState === 'paused')
    ) {
      mediaRecorderRef.current.stop();

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (streamRef.current) {
        setLiveStream(null);
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  }, [recordingState]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      streamRef.current = stream;
      setLiveStream(stream);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setRecordingState('stopped');
      };

      mediaRecorder.start(1000);
      setRecordingState('recording');

      intervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1000;
          if (newTime >= MAX_RECORDING_TIME) {
            stopRecording();
            return MAX_RECORDING_TIME;
          }
          return newTime;
        });
      }, 1000);
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Unable to access microphone. Please check permissions.');
    }
  }, [stopRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      try {
        // Check if MediaRecorder is still in a valid state
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.pause();
          setRecordingState('paused');

          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } else {
          // MediaRecorder is in an invalid state, reset everything
          console.warn(
            'MediaRecorder is not in recording state:',
            mediaRecorderRef.current.state
          );
          setRecordingState('idle');
          setRecordingTime(0);
          setError('Recording session ended unexpectedly.');
        }
      } catch (err) {
        console.error('Error pausing recording:', err);
        setError('Failed to pause recording.');
        setRecordingState('idle');
        setRecordingTime(0);
      }
    }
  }, [recordingState]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === 'paused') {
      try {
        // Check if MediaRecorder is still in a valid state
        if (mediaRecorderRef.current.state === 'paused') {
          mediaRecorderRef.current.resume();
          setRecordingState('recording');

          intervalRef.current = setInterval(() => {
            setRecordingTime((prev) => {
              const newTime = prev + 1000;
              if (newTime >= MAX_RECORDING_TIME) {
                stopRecording();
                return MAX_RECORDING_TIME;
              }
              return newTime;
            });
          }, 1000);
        } else {
          // MediaRecorder is in an invalid state, reset everything
          console.warn(
            'MediaRecorder is not in paused state:',
            mediaRecorderRef.current.state
          );
          setRecordingState('idle');
          setRecordingTime(0);
          setError('Recording session ended. Please start a new recording.');
        }
      } catch (err) {
        console.error('Error resuming recording:', err);
        setError('Failed to resume recording. Please start a new recording.');
        setRecordingState('idle');
        setRecordingTime(0);
      }
    }
  }, [recordingState, stopRecording]);

  const restartRecording = useCallback(() => {
    // Stop current recording if any
    if (
      mediaRecorderRef.current &&
      (recordingState === 'recording' || recordingState === 'paused')
    ) {
      mediaRecorderRef.current.stop();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (streamRef.current) {
        setLiveStream(null);
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }

    // Reset states
    setRecordingTime(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setError(null);

    // Start new recording immediately
    setTimeout(() => {
      startRecording();
    }, 50);
  }, [recordingState, startRecording]);

  const discardRecording = useCallback(() => {
    // Clear recording data
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingState('idle');
    setRecordingTime(0);
    setError(null);
    setIsPlaying(false);
    setTranscription('');
    setSummary('');
    setLiveStream(null);

    // Clear any processing state
    setProcessingState('idle');
  }, []);

  const processAudio = async () => {
    if (!audioBlob || !user?.id) return;

    // Prevent duplicate processing
    if (processingState !== 'idle') {
      console.warn('Processing already in progress');
      return;
    }

    try {
      setProcessingState('transcribing');

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('userId', user.id);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const result = await response.json();
      setTranscription(result.transcription);
      setSummary(result.rephrasedText);
      setProcessingState('complete');

      // Dispatch event to notify other components
      const event = new CustomEvent('audioJournalUpdated');
      window.dispatchEvent(event);
    } catch (err) {
      console.error('Error processing audio:', err);
      setError('Failed to process audio. Please try again.');
      setProcessingState('error');
    }
  };

  const toggleAudioPlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    switch (processingState) {
      case 'transcribing':
        return 'Converting speech to text...';
      case 'summarizing':
        return 'Generating summary...';
      case 'saving':
        return 'Saving your journal...';
      case 'complete':
        return 'Journal saved successfully!';
      case 'error':
        return 'Processing failed';
      default:
        if (recordingState === 'recording') return 'Recording in progress...';
        if (recordingState === 'paused') return 'Recording paused';
        if (recordingState === 'stopped') return 'Recording complete';
        return '';
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      resetState();
    };
  }, [resetState]);

  const isRecording = recordingState === 'recording';
  const isPaused = recordingState === 'paused';
  const hasRecording = recordingState === 'stopped' && !!audioBlob;
  const isProcessing =
    processingState !== 'idle' && processingState !== 'complete';
  const isComplete = processingState === 'complete';
  const canProcess =
    hasRecording && !isProcessing && processingState === 'idle';
  const recordedBlob = hasRecording && audioBlob ? audioBlob : null;
  const showIdleFact = recordingState === 'idle' && !audioBlob;
  const currentFact = JOURNAL_FACTS[factIndex];
  const typedFact = showIdleFact ? currentFact.slice(0, typedChars) : '';

  useEffect(() => {
    if (!showIdleFact) {
      setTypedChars(0);
      setIsDeleting(false);
      return;
    }

    if (!isDeleting && typedChars === currentFact.length) {
      const pause = setTimeout(() => setIsDeleting(true), 1200);
      return () => clearTimeout(pause);
    }

    if (isDeleting && typedChars === 0) {
      setIsDeleting(false);
      setFactIndex((prev) => (prev + 1) % JOURNAL_FACTS.length);
      return;
    }

    const tick = setTimeout(
      () => {
        setTypedChars((prev) => prev + (isDeleting ? -1 : 1));
      },
      isDeleting ? 25 : 45
    );

    return () => clearTimeout(tick);
  }, [showIdleFact, currentFact, typedChars, isDeleting]);

  return (
    <div className={cn('mx-auto flex h-full w-full max-w-md', className)}>
      <div className='border-border/30 bg-card/90 flex min-h-[400px] w-full flex-col gap-5 rounded-3xl border p-6 shadow-lg'>
        <div className='text-center'>
          <h2 className='text-foreground text-xl font-semibold tracking-tight'>
            Record Your Journal
          </h2>
        </div>

        <div className='flex flex-col items-center gap-2 text-center'>
          <div className='text-foreground font-mono text-2xl font-semibold tabular-nums'>
            {formatTime(recordingTime)}
          </div>
          {getStatusText() ? (
            <div className='text-muted-foreground text-xs'>
              {getStatusText()}
            </div>
          ) : null}
        </div>

        <div className='relative min-h-[110px] w-full overflow-hidden rounded-xl transition-[min-height] duration-300'>
          {liveStream && recordingState !== 'stopped' ? (
            <LiveWaveform
              stream={liveStream}
              isActive={recordingState === 'recording'}
              waveColor={WAVE_PRIMARY_COLOR}
              height={56}
            />
          ) : null}

          {recordedBlob ? (
            <RecordedWaveform
              blob={recordedBlob}
              waveColor={WAVE_PRIMARY_COLOR}
              progressColor={WAVE_SECONDARY_COLOR}
              height={56}
            />
          ) : null}

          {showIdleFact ? (
            <div className='pointer-events-none absolute inset-0 flex items-center justify-center px-4 py-2 text-center text-sm font-medium'>
              <span
                className='from-primary bg-gradient-to-r via-pink-500 to-orange-400 bg-clip-text text-transparent'
                style={{
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
              >
                {Array.from(typedFact || '\u00A0').map((char, idx) =>
                  EMOJI_REGEX.test(char) ? (
                    <span
                      key={`emoji-${idx}`}
                      className='text-foreground'
                      style={{ WebkitTextFillColor: 'currentColor' }}
                    >
                      {char}
                    </span>
                  ) : (
                    <span key={`char-${idx}`}>{char}</span>
                  )
                )}
                <span className='text-primary ml-1 inline-block animate-pulse'>
                  |
                </span>
              </span>
            </div>
          ) : null}
        </div>

        <div className='flex w-full justify-center'>
          {!hasRecording ? (
            <div className='flex w-full max-w-sm flex-col items-center gap-4'>
              <div className='flex items-center justify-center gap-3'>
                {isRecording && (
                  <Button
                    onClick={pauseRecording}
                    variant='outline'
                    size='icon'
                    className='h-12 w-12 rounded-full'
                  >
                    <Pause className='h-4 w-4' />
                  </Button>
                )}
                <Button
                  onClick={
                    isRecording
                      ? stopRecording
                      : isPaused
                        ? resumeRecording
                        : startRecording
                  }
                  disabled={isProcessing}
                  size='lg'
                  className={cn(
                    'h-[4.25rem] w-[4.25rem] rounded-full transition-all duration-300',
                    'shadow-lg hover:shadow-xl',
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600'
                      : isPaused
                        ? 'bg-green-500 hover:bg-green-600'
                        : 'bg-primary hover:bg-primary/90'
                  )}
                >
                  {isRecording ? (
                    <Square className='h-8 w-8' />
                  ) : isPaused ? (
                    <Play className='h-8 w-8' />
                  ) : (
                    <Mic className='h-8 w-8' />
                  )}
                </Button>
                {(isRecording || isPaused) && (
                  <Button
                    onClick={restartRecording}
                    variant='outline'
                    size='icon'
                    className='h-12 w-12 rounded-full'
                  >
                    <RotateCcw className='h-4 w-4' />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className='flex w-full max-w-sm items-center justify-center gap-3'>
              <Button
                onClick={toggleAudioPlayback}
                variant='outline'
                size='icon'
                className='h-12 w-12 rounded-full'
              >
                {isPlaying ? (
                  <Pause className='h-5 w-5' />
                ) : (
                  <Play className='h-5 w-5' />
                )}
              </Button>

              <Button
                onClick={discardRecording}
                variant='outline'
                size='icon'
                className='h-12 w-12 rounded-full border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50'
              >
                <Trash2 className='h-5 w-5' />
              </Button>

              <Button
                onClick={processAudio}
                disabled={!canProcess}
                className='relative h-12 flex-1 overflow-hidden rounded-full px-5 text-sm font-semibold text-white disabled:opacity-70'
              >
                <span className='animate-spin-gradient absolute inset-[-20%] bg-[conic-gradient(var(--tw-gradient-stops))] from-purple-500 via-pink-500 to-cyan-400 opacity-70 blur-xl' />
                <span className='bg-primary/95 absolute inset-[2px] rounded-full' />
                <span className='relative z-10 flex items-center justify-center gap-2'>
                  {isProcessing ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : null}
                  Process
                </span>
              </Button>
            </div>
          )}
        </div>

        {/* Hidden Audio Element */}
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            className='hidden'
          />
        )}

        {/* Error Display */}
        {error && (
          <div className='bg-destructive/10 border-destructive/20 rounded-lg border p-4'>
            <div className='text-destructive text-center text-sm'>{error}</div>
          </div>
        )}

        {/* Results Display */}
        {isComplete && (
          <div className='border-border/40 border-t pt-4'>
            <div className='rounded-xl bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-800 dark:bg-green-900/20 dark:text-green-200'>
              Smart journal organization complete.
            </div>
            <div className='pt-4 text-center'>
              <div className='flex justify-center gap-2'>
                <Button
                  onClick={resetState}
                  variant='outline'
                  size='sm'
                  className='rounded-full'
                >
                  Record Another
                </Button>
                <Button
                  onClick={discardRecording}
                  variant='outline'
                  size='sm'
                  className='rounded-full border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50'
                >
                  <Trash2 className='mr-2 h-4 w-4' />
                  Clear
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
