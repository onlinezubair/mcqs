'use client';

import { useEffect } from 'react';
import { clockGuardStart, clockGuardTick, clockGuardReset } from '@/lib/clockGuard';
import { useExamStore } from '@/store/examStore';

const RESUMABLE = new Set(['exam', 'paperIntro', 'paper']);

export function useClockGuard() {
  const screen = useExamStore(s => s.screen);
  const pauseResume = useExamStore(s => s.pauseResume);

  useEffect(() => {
    if (!RESUMABLE.has(screen)) {
      clockGuardReset();
      return;
    }

    let warned = false;
    clockGuardStart(() => {
      if (warned) return;
      warned = true;
      const progress = useExamStore.getState().progress;
      if (progress && !progress.slideTimer.paused) {
        pauseResume();
      }
    });

    const id = setInterval(() => {
      try {
        clockGuardTick();
      } catch {
        // ignore transient timing errors
      }
    }, 1000);

    return () => {
      clearInterval(id);
      clockGuardReset();
    };
  }, [screen, pauseResume]);
}
