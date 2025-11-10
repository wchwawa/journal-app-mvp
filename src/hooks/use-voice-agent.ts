'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RealtimeAgent, RealtimeSession, tool } from '@openai/agents-realtime';
import { z } from 'zod';
import { buildVoiceAgentInstructions } from '@/lib/agent/instructions';
import {
  DEFAULT_VOICE_ID,
  VOICE_PROFILES,
  findVoiceById
} from '@/lib/agent/voices';

const SESSION_LIMIT_SECONDS = 10 * 60;

export type VoiceAgentStatus = 'idle' | 'connecting' | 'ready' | 'error';

export interface VoiceAgentState {
  status: VoiceAgentStatus;
  isListening: boolean;
  isAgentSpeaking: boolean;
  lastMessage: string;
  error: string | null;
  voiceId: string;
  timeRemaining: number;
  searchRemaining: number;
}

export function useVoiceAgent() {
  // no-op
  const [state, setState] = useState<VoiceAgentState>({
    status: 'idle',
    isListening: false,
    isAgentSpeaking: false,
    lastMessage: '',
    error: null,
    voiceId: DEFAULT_VOICE_ID,
    timeRemaining: SESSION_LIMIT_SECONDS,
    searchRemaining: 5
  });
  const sessionRef = useRef<RealtimeSession | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartedRef = useRef<number | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    resetTimer();
    sessionRef.current?.close();
    sessionRef.current = null;
    sessionStartedRef.current = null;
    setState((prev) => ({
      ...prev,
      status: 'idle',
      isListening: false,
      isAgentSpeaking: false,
      timeRemaining: SESSION_LIMIT_SECONDS
    }));
  }, [resetTimer]);

  useEffect(() => () => disconnect(), [disconnect]);

  const connect = useCallback(async () => {
    if (state.status === 'connecting' || sessionRef.current) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: 'Browser does not support microphone access.'
      }));
      return;
    }

    setState((prev) => ({ ...prev, status: 'connecting', error: null }));

    try {
      const voice = findVoiceById(state.voiceId);
      const tokenResponse = await fetch(
        `/api/agent/token?voice=${encodeURIComponent(state.voiceId)}`
      );

      if (!tokenResponse.ok) {
        const details = await tokenResponse.json().catch(() => ({}));
        throw new Error(details.error ?? 'Failed to create session');
      }

      const { token } = await tokenResponse.json();
      if (!token) throw new Error('Ephemeral token missing');
      const model = 'gpt-realtime';

      const contextTool = tool({
        name: 'fetch_user_context',
        description:
          'Read structured reflections, moods, and summaries for the authenticated user.',
        parameters: z.object({
          scope: z
            .enum(['today', 'week', 'month', 'recent', 'custom'])
            .default('recent'),
          anchorDate: z.string().nullable().optional(),
          limit: z.number().nullable().optional(),
          range: z
            .object({ start: z.string(), end: z.string() })
            .nullable()
            .optional()
        }),
        execute: async (input) => {
          const response = await fetch('/api/agent/tools/context', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
          });

          if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            throw new Error(
              errorPayload.error ?? 'Unable to fetch journaling context'
            );
          }

          return await response.json();
        }
      });

      const searchTool = tool({
        name: 'web_search',
        description:
          'Leverage OpenAI web search to pull in timely knowledge. Max 5 uses per user per day.',
        parameters: z.object({
          query: z.string().min(4).max(200)
        }),
        execute: async (input) => {
          const response = await fetch('/api/agent/tools/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
          });

          if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            throw new Error(
              errorPayload.error ?? 'Search failed, please try again later.'
            );
          }

          const data = await response.json();
          if (typeof data.remaining === 'number') {
            setState((prev) => ({ ...prev, searchRemaining: data.remaining }));
          }
          return data;
        }
      });

      const agent = new RealtimeAgent({
        name: 'Echo',
        voice: voice.voice,
        instructions: buildVoiceAgentInstructions(),
        tools: [contextTool, searchTool]
      });

      const newSession = new RealtimeSession(agent, {
        model
      });

      if (process.env.NODE_ENV !== 'production') {
        try {
          const previewConfig = await newSession.getInitialSessionConfig();
          console.debug('voice agent config', previewConfig);
        } catch {}
      }

      newSession.on('agent_end', (_ctx, _agent, output) => {
        if (output) {
          setState((prev) => ({ ...prev, lastMessage: output }));
        }
      });

      newSession.on('audio_start', () => {
        setState((prev) => ({ ...prev, isAgentSpeaking: true }));
      });

      newSession.on('audio_stopped', () => {
        setState((prev) => ({ ...prev, isAgentSpeaking: false }));
      });

      newSession.on('error', (e) => {
        console.error('Realtime session error', e);
        setState((prev) => ({
          ...prev,
          error: 'Realtime session error, reconnect to continue.',
          status: 'error'
        }));
      });

      // Some runtime versions require explicit model in the URL for SDP accept
      const url = `https://api.openai.com/v1/realtime?model=${encodeURIComponent(
        model
      )}`;
      await newSession.connect({ apiKey: token, url });

      newSession.mute(true);
      sessionRef.current = newSession;
      sessionStartedRef.current = Date.now();

      resetTimer();
      timerRef.current = setInterval(() => {
        const started = sessionStartedRef.current;
        if (!started) return;
        const elapsed = Math.floor((Date.now() - started) / 1000);
        const remaining = Math.max(SESSION_LIMIT_SECONDS - elapsed, 0);
        setState((prev) => ({ ...prev, timeRemaining: remaining }));
        if (remaining <= 0) {
          disconnect();
        }
      }, 1000);

      setState((prev) => ({
        ...prev,
        status: 'ready',
        error: null,
        searchRemaining: 5,
        timeRemaining: SESSION_LIMIT_SECONDS
      }));
    } catch (error) {
      console.error('Voice agent connect error', error);
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Connection failed.'
      }));
      disconnect();
    }
  }, [disconnect, resetTimer, state.status, state.voiceId]);

  const toggleListening = useCallback(
    (listening: boolean) => {
      const session = sessionRef.current;
      if (!session || state.status !== 'ready') return;
      session.mute(!listening);
      setState((prev) => ({ ...prev, isListening: listening }));
    },
    [state.status]
  );

  const setVoiceId = useCallback(
    (id: string) => {
      if (state.status !== 'idle') return;
      setState((prev) => ({ ...prev, voiceId: id }));
    },
    [state.status]
  );

  return {
    state,
    connect,
    disconnect,
    toggleListening,
    setVoiceId,
    voiceProfiles: VOICE_PROFILES
  };
}
