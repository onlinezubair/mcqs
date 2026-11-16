'use client';

import { deadlineTimerRemaining } from '@/lib/deadlineTimer';
import { getTimerPhase } from '@/lib/timerTheme';
import { fmtHms } from '@/lib/time';
import type { DeadlineTimer } from '@/types';

export function Countdown({ timer, kind = 'slide' }: { timer: DeadlineTimer | null | undefined; kind?: 'slide' | 'paper' }) {
  const remainingMs = timer ? deadlineTimerRemaining(timer, Date.now()) : 0;
  const phase = getTimerPhase(remainingMs, timer?.totalMs ?? 0, kind);

  return (
    <div
      className={`timer-${phase.phase}`}
      aria-hidden="true"
      style={{
        fontSize: 'clamp(1.5rem, 5vw, 4rem)',
        fontWeight: phase.phase === 'critical' ? 800 : phase.phase === 'danger' ? 700 : 600,
        fontVariantNumeric: 'tabular-nums',
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        transition: 'color 0.2s',
      }}
    >
      {fmtHms(Math.ceil(remainingMs / 1000))}
    </div>
  );
}
