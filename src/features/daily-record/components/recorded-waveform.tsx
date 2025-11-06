'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type RecordedWaveformProps = {
  blob: Blob | null;
  className?: string;
  waveColor?: string;
  progressColor?: string;
  height?: number;
};

/**
 * Renders the waveform of a recorded Blob using wavesurfer.js.
 * Playback is kept external for now – this component focuses purely on visualising the file.
 */
export default function RecordedWaveform({
  blob,
  className,
  waveColor = '#7c3aed',
  progressColor = '#6d28d9',
  height = 56
}: RecordedWaveformProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  // create wavesurfer instance
  useEffect(() => {
    let isCancelled = false;

    if (!containerRef.current) {
      return;
    }

    const createWaveform = async () => {
      const { default: WaveSurfer } = await import('wavesurfer.js');

      if (isCancelled || !containerRef.current) {
        return;
      }

      const wavesurfer = WaveSurfer.create({
        container: containerRef.current,
        waveColor,
        progressColor,
        barWidth: 1,
        barGap: 0,
        cursorWidth: 0,
        interact: false,
        height,
        normalize: true,
        fillParent: true,
        autoCenter: true,
        autoScroll: false,
        hideScrollbar: true
      });

      wavesurferRef.current = wavesurfer;
      setIsReady(true);
    };

    createWaveform().catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Failed to initialise recorded waveform', error);
    });

    return () => {
      isCancelled = true;
      setIsReady(false);
      wavesurferRef.current?.destroy();
      wavesurferRef.current = null;
    };
  }, [waveColor, progressColor, height]);

  // load blob when ready
  useEffect(() => {
    if (!blob || !isReady || !wavesurferRef.current) {
      return;
    }

    const wavesurfer = wavesurferRef.current;

    wavesurfer.loadBlob(blob).catch((error: unknown) => {
      // eslint-disable-next-line no-console
      console.error('Failed to load recorded waveform blob', error);
    });
  }, [blob, isReady]);

  // keep waveform responsive to container width changes
  useEffect(() => {
    if (!isReady || !containerRef.current || !wavesurferRef.current) {
      return;
    }

    const wavesurfer = wavesurferRef.current;
    const container = containerRef.current;
    const resizeObserver = new ResizeObserver(() => {
      wavesurfer.setOptions({ height });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isReady, height]);

  return (
    <div
      ref={containerRef}
      className={cn('w-full overflow-hidden', className)}
    />
  );
}
