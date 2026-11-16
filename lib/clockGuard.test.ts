import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clockGuardStart, clockGuardTick, clockGuardReset } from '@/lib/clockGuard';

describe('clockGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clockGuardReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports no drift when wall and perf clocks advance together', () => {
    clockGuardStart(() => {});
    vi.advanceTimersByTime(1000);
    const { driftMs, suspended } = clockGuardTick();
    expect(suspended).toBe(false);
    expect(driftMs).toBeLessThanOrEqual(1000);
  });

  it('first tick after reset is stable', () => {
    clockGuardReset();
    const first = clockGuardTick();
    expect(first.driftMs).toBeLessThan(50);
    expect(first.suspended).toBe(false);
  });

  it('invokes the drift callback when the wall clock jumps', () => {
    const onDrift = vi.fn();
    clockGuardStart(onDrift);
    const realNow = Date.now;
    const base = realNow();
    vi.spyOn(Date, 'now').mockReturnValue(base + 60_000);
    try {
      clockGuardTick();
      expect(onDrift).toHaveBeenCalled();
    } finally {
      vi.spyOn(Date, 'now').mockImplementation(realNow);
    }
  });
});
