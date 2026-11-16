import { useEffect, useRef, useState } from 'react';
import type { DeadlineTimer } from '@/types';
import { deadlineTimerRemaining } from '@/lib/deadlineTimer';

export function useDeadlineTicker(
  timer: DeadlineTimer | null | undefined,
  onExpire: () => void,
  intervalMs = 250
) {
  const onExpireRef = useRef(onExpire);
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    timer ? deadlineTimerRemaining(timer) : 0
  );
  const firedRef = useRef(false);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!timer) {
      setRemainingMs(0);
      firedRef.current = false;
      return;
    }

    setRemainingMs(deadlineTimerRemaining(timer));
    firedRef.current = false;

    if (timer.paused) return;

    const id = setInterval(() => {
      const remaining = deadlineTimerRemaining(timer);
      setRemainingMs(remaining);
      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current();
      }
    }, intervalMs);

    return () => clearInterval(id);
  }, [timer, timer?.paused, timer?.endsAt, timer?.remainingMs, intervalMs]);

  return { remainingMs };
}
