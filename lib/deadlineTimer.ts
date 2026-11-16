import type { DeadlineTimer } from '@/types';

export function deadlineTimerStart(durationMs: number, extraMs: number = 0, pausedLog: DeadlineTimer['pausedLog'] = []): DeadlineTimer {
  const now = Date.now();
  return {
    endsAt: now + durationMs,
    remainingMs: durationMs,
    totalMs: durationMs + extraMs,
    paused: false,
    pausedLog,
    extraMs,
  };
}

export function deadlineTimerPause(timer: DeadlineTimer): DeadlineTimer {
  if (timer.paused) return timer;
  const now = Date.now();
  const remaining = Math.max(0, (timer.endsAt ?? now + timer.remainingMs) - now);
  return {
    ...timer,
    endsAt: null,
    remainingMs: remaining,
    paused: true,
    pausedLog: [...timer.pausedLog, { at: now, reason: 'manual' }],
  };
}

export function deadlineTimerResume(timer: DeadlineTimer): DeadlineTimer {
  if (!timer.paused) return timer;
  const now = Date.now();
  const lastPause = timer.pausedLog[timer.pausedLog.length - 1];
  const newPausedLog = timer.pausedLog.map((entry, i) =>
    i === timer.pausedLog.length - 1 && entry.resumedAt === undefined
      ? { ...entry, resumedAt: now }
      : entry
  );
  return {
    ...timer,
    endsAt: now + timer.remainingMs,
    paused: false,
    pausedLog: newPausedLog,
  };
}

export function deadlineTimerExtend(timer: DeadlineTimer, extraMs: number): DeadlineTimer {
  const newExtraMs = timer.extraMs + extraMs;
  if (timer.paused) {
    return {
      ...timer,
      remainingMs: timer.remainingMs + extraMs,
      totalMs: timer.totalMs + extraMs,
      extraMs: newExtraMs,
    };
  }
  const newEndsAt = (timer.endsAt ?? Date.now() + timer.remainingMs) + extraMs;
  return {
    ...timer,
    endsAt: newEndsAt,
    remainingMs: timer.remainingMs + extraMs,
    totalMs: timer.totalMs + extraMs,
    extraMs: newExtraMs,
  };
}

export function deadlineTimerRemaining(timer: DeadlineTimer, now: number = Date.now()): number {
  if (timer.paused) return timer.remainingMs;
  const end = timer.endsAt ?? now + timer.remainingMs;
  return Math.max(0, end - now);
}

export function deadlineTimerChain(prev: DeadlineTimer, nextDurationMs: number): DeadlineTimer {
  const baseEnd = prev.endsAt ?? Date.now() + prev.remainingMs;
  return deadlineTimerStart(nextDurationMs, prev.extraMs, prev.pausedLog);
}

export function deadlineTimerFromRemaining(remainingMs: number, totalMs: number, extraMs: number, pausedLog: DeadlineTimer['pausedLog']): DeadlineTimer {
  return {
    endsAt: null,
    remainingMs,
    totalMs,
    paused: true,
    pausedLog,
    extraMs,
  };
}