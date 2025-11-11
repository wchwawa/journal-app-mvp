import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceAgent } from '@/hooks/use-voice-agent';

const connectSpy = vi.fn();
const muteSpy = vi.fn();
const closeSpy = vi.fn();
const onSpy = vi.fn();

vi.mock('@openai/agents-realtime', () => {
  class FakeSession {
    connect = connectSpy;
    mute = muteSpy;
    close = closeSpy;
    on = onSpy;
  }

  const FakeRealtimeSession = vi.fn(() => new FakeSession());
  const toolSpy = vi.fn().mockImplementation((config) => config);
  const fakeAgent = vi.fn().mockImplementation(() => ({}));

  return {
    RealtimeAgent: fakeAgent,
    RealtimeSession: FakeRealtimeSession,
    tool: toolSpy
  };
});

vi.mock('@/lib/agent/instructions', () => ({
  buildVoiceAgentInstructions: vi.fn().mockReturnValue('act calm and kind')
}));

describe('useVoiceAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Provide a basic MediaStream + microphone implementation for the hook.
    class FakeMediaStream {
      getTracks() {
        return [];
      }
    }

    (globalThis as any).MediaStream = FakeMediaStream;

    const navigatorRef =
      typeof globalThis.navigator === 'undefined'
        ? ({} as Navigator)
        : globalThis.navigator;

    if (typeof globalThis.navigator === 'undefined') {
      Object.defineProperty(globalThis, 'navigator', {
        value: navigatorRef,
        configurable: true
      });
    }

    (navigatorRef as any).mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(new FakeMediaStream())
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'ek-test', model: 'gpt-realtime' })
    }) as unknown as typeof fetch;
  });

  it('transitions to ready state and toggles listening when session connects', async () => {
    const { result } = renderHook(() => useVoiceAgent());

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.state.status).toBe('ready');
    expect(connectSpy).toHaveBeenCalledOnce();
    expect(result.current.state.timeRemaining).toBeGreaterThan(0);

    await act(async () => {
      result.current.toggleListening(true);
    });

    expect(result.current.state.isListening).toBe(true);
    expect(muteSpy).toHaveBeenCalledWith(false);

    await act(async () => {
      result.current.disconnect();
    });

    expect(closeSpy).toHaveBeenCalled();
    expect(result.current.state.status).toBe('idle');
  });
});
