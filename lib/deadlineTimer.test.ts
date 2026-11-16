import { describe, it, expect } from 'vitest';
import {
  deadlineTimerStart,
  deadlineTimerPause,
  deadlineTimerResume,
  deadlineTimerExtend,
  deadlineTimerRemaining,
  deadlineTimerChain,
} from '@/lib/deadlineTimer';

describe('deadlineTimer', () => {
  it('starts running with the given duration', () => {
    const t = deadlineTimerStart(60_000);
    expect(t.paused).toBe(false);
    expect(t.remainingMs).toBe(60_000);
    expect(t.totalMs).toBe(60_000);
    expect(t.endsAt).toBeTypeOf('number');
  });

  it('pause preserves remaining time and marks paused', () => {
    const t = deadlineTimerStart(60_000);
    const paused = deadlineTimerPause(t);
    expect(paused.paused).toBe(true);
    expect(paused.endsAt).toBeNull();
    expect(paused.remainingMs).toBeGreaterThan(0);
    expect(paused.pausedLog).toHaveLength(1);
    expect(paused.pausedLog[0]!.reason).toBe('manual');
  });

  it('pause is idempotent', () => {
    const t = deadlineTimerPause(deadlineTimerStart(60_000));
    expect(deadlineTimerPause(t)).toBe(t);
  });

  it('resume clears paused and records resumedAt', () => {
    const paused = deadlineTimerPause(deadlineTimerStart(60_000));
    const resumed = deadlineTimerResume(paused);
    expect(resumed.paused).toBe(false);
    expect(resumed.endsAt).toBeTypeOf('number');
    expect(resumed.pausedLog[0]!.resumedAt).toBeTypeOf('number');
  });

  it('extend adds time while running', () => {
    const t = deadlineTimerStart(60_000);
    const extended = deadlineTimerExtend(t, 10_000);
    expect(extended.remainingMs).toBe(70_000);
    expect(extended.totalMs).toBe(70_000);
    expect(extended.extraMs).toBe(10_000);
  });

  it('extend adds time while paused without setting endsAt', () => {
    const paused = deadlineTimerPause(deadlineTimerStart(60_000));
    const extended = deadlineTimerExtend(paused, 15_000);
    expect(extended.paused).toBe(true);
    expect(extended.endsAt).toBeNull();
    expect(extended.remainingMs).toBe(paused.remainingMs + 15_000);
  });

  it('remaining returns remainingMs when paused', () => {
    const paused = deadlineTimerPause(deadlineTimerStart(60_000));
    expect(deadlineTimerRemaining(paused, Date.now() + 10_000)).toBe(paused.remainingMs);
  });

  it('remaining never goes negative', () => {
    const t = deadlineTimerStart(1_000);
    expect(deadlineTimerRemaining(t, Date.now() + 60_000)).toBe(0);
  });

  it('chain carries extraMs and pausedLog to next slide', () => {
    const t = deadlineTimerExtend(deadlineTimerStart(30_000), 5_000);
    const next = deadlineTimerChain(t, 40_000);
    expect(next.extraMs).toBe(5_000);
    expect(next.remainingMs).toBe(40_000);
    expect(next.pausedLog).toEqual(t.pausedLog);
  });
});
