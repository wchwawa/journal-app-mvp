'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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

  const getProgressPercent = () => {
    return Math.min((recordingTime / MAX_RECORDING_TIME) * 100, 100);
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
        return 'Ready to record your thoughts';
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

  return (
    <div className={cn('mx-auto w-full max-w-sm', className)}>
      {/* Central recording interface */}
      <div className='space-y-5 p-4'>
        {/* Title */}
        <div className='space-y-1.5 text-center'>
          <h2 className='text-foreground text-xl font-semibold tracking-tight'>
            Voice journal
          </h2>
          <p className='text-muted-foreground text-xs leading-relaxed'>
            Capture a quick audio note and let AI tidy it up.
          </p>
        </div>

        {/* Recording Status */}
        <div className='space-y-3 text-center'>
          <div className='text-foreground font-mono text-2xl font-semibold'>
            {formatTime(recordingTime)}
          </div>
          <div className='text-muted-foreground text-xs'>{getStatusText()}</div>
        </div>

        {/* Progress Bar */}
        <div className='space-y-1.5'>
          <Progress value={getProgressPercent()} className='bg-muted h-1.5' />
          <div className='text-muted-foreground text-center text-[11px]'>
            Max {formatTime(MAX_RECORDING_TIME)}
          </div>
        </div>

        {/* Waveform visual */}
        <div className='bg-muted/30 border-border/40 relative rounded-2xl border p-3'>
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

          {!liveStream && !hasRecording ? (
            <div className='text-muted-foreground/70 text-center text-xs'>
              Waveform preview will appear while recording.
            </div>
          ) : null}
        </div>

        {/* Main Recording Button */}
        <div className='flex justify-center'>
          {!hasRecording ? (
            <div className='flex items-center gap-4'>
              {/* Primary Recording Button */}
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
                      : 'bg-primary hover:bg-primary/90 hover:scale-105'
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

              {/* Secondary Controls */}
              {(isRecording || isPaused) && (
                <div className='flex flex-col gap-2'>
                  {isRecording && (
                    <Button
                      onClick={pauseRecording}
                      variant='outline'
                      size='sm'
                      className='h-12 w-12 rounded-full'
                    >
                      <Pause className='h-4 w-4' />
                    </Button>
                  )}
                  <Button
                    onClick={restartRecording}
                    variant='outline'
                    size='sm'
                    className='h-12 w-12 rounded-full'
                  >
                    <RotateCcw className='h-4 w-4' />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className='flex items-center gap-4'>
              <Button
                onClick={toggleAudioPlayback}
                variant='outline'
                size='lg'
                className='h-16 w-16 rounded-full'
              >
                {isPlaying ? (
                  <Pause className='h-6 w-6' />
                ) : (
                  <Play className='h-6 w-6' />
                )}
              </Button>

              <Button
                onClick={discardRecording}
                variant='outline'
                size='lg'
                className='h-16 w-16 rounded-full border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50'
              >
                <Trash2 className='h-6 w-6' />
              </Button>

              <Button
                onClick={processAudio}
                disabled={!canProcess}
                size='lg'
                className='rounded-full px-8 py-4 shadow-lg hover:shadow-xl'
              >
                {isProcessing ? (
                  <Loader2 className='mr-2 h-5 w-5 animate-spin' />
                ) : null}
                {isProcessing ? 'Processing...' : 'Process Recording'}
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
        {isComplete && (transcription || summary) && (
          <div className='border-border/50 space-y-4 border-t pt-4 text-sm'>
            {transcription && (
              <div className='space-y-2'>
                <h4 className='text-foreground text-xs font-semibold tracking-[0.2em] uppercase'>
                  Transcription
                </h4>
                <div className='bg-muted/40 text-muted-foreground rounded-lg p-3 text-xs leading-relaxed'>
                  {transcription}
                </div>
              </div>
            )}
            {summary && (
              <div className='space-y-2'>
                <h4 className='text-foreground text-xs font-semibold tracking-[0.2em] uppercase'>
                  Summary
                </h4>
                <div className='bg-muted/40 text-muted-foreground rounded-lg p-3 text-xs leading-relaxed'>
                  {summary}
                </div>
              </div>
            )}
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
