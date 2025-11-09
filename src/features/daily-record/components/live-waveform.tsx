'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type LiveWaveformProps = {
  stream: MediaStream | null;
  isActive: boolean;
  className?: string;
  waveColor?: string;
  height?: number;
};

/**
 * Renders a real-time waveform using wavesurfer.js Record plugin.
 * The underlying MediaStream remains untouched – this component only visualises it.
 */
export default function LiveWaveform({
  stream,
  isActive,
  className,
  waveColor = '#7c3aed',
  height = 56
}: LiveWaveformProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<any>(null);
  const recordPluginRef = useRef<any>(null);
  const micCleanupRef = useRef<(() => void) | null>(null);
  const [isPluginReady, setIsPluginReady] = useState(false);

  // Initialise the wavesurfer instance and record plugin
  useEffect(() => {
    let isCancelled = false;

    if (!stream || !containerRef.current) {
      micCleanupRef.current?.();
      micCleanupRef.current = null;
      recordPluginRef.current = null;
      wavesurferRef.current?.destroy?.();
      wavesurferRef.current = null;
      setIsPluginReady(false);
      return;
    }

    const setup = async () => {
      const [{ default: WaveSurfer }, { default: RecordPlugin }] =
        await Promise.all([
          import('wavesurfer.js'),
          import('wavesurfer.js/dist/plugins/record.esm.js')
        ]);

      if (isCancelled || !containerRef.current) {
        return;
      }

      const wavesurfer = WaveSurfer.create({
        container: containerRef.current,
        waveColor,
        progressColor: waveColor,
        barWidth: 1,
        barGap: 0,
        cursorWidth: 0,
        interact: false,
        height,
        normalize: true,
        fillParent: true,
        autoCenter: false,
        autoScroll: false,
        hideScrollbar: true
      });

      const recordPlugin = wavesurfer.registerPlugin(
        RecordPlugin.create({
          renderRecordedAudio: false,
          scrollingWaveform: true,
          scrollingWaveformWindow: 15
        })
      );

      wavesurferRef.current = wavesurfer;
      recordPluginRef.current = recordPlugin;
      setIsPluginReady(true);
    };

    setup().catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Failed to initialise live waveform', error);
    });

    return () => {
      isCancelled = true;
      micCleanupRef.current?.();
      micCleanupRef.current = null;
      recordPluginRef.current = null;
      wavesurferRef.current?.destroy?.();
      wavesurferRef.current = null;
      setIsPluginReady(false);
    };
  }, [stream, waveColor, height]);

  // Attach the media stream to the plugin once it's ready
  useEffect(() => {
    const recordPlugin = recordPluginRef.current;

    if (!isPluginReady || !recordPlugin || !stream) {
      return;
    }

    if (!micCleanupRef.current) {
      const micStream = recordPlugin.renderMicStream(stream);
      micCleanupRef.current = () => {
        micStream?.onDestroy?.();
      };
    }

    recordPlugin.isWaveformPaused = !isActive;
  }, [isPluginReady, stream, isActive]);

  return (
    <div
      ref={containerRef}
      className={cn('w-full overflow-hidden', className)}
    />
  );
}
