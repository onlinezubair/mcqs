import { describe, it, expect } from 'vitest';
import { allocateSeconds, allocateSecondsWithWarnings, resolveMcqTiming } from '@/lib/timing';

describe('allocateSeconds', () => {
  it('returns an empty array for n <= 0', () => {
    expect(allocateSeconds(60, 0)).toEqual([]);
    expect(allocateSeconds(60, -1)).toEqual([]);
  });

  it('sums exactly to the total', () => {
    for (const total of [0, 1, 59, 600, 1234, 3600]) {
      for (const n of [1, 2, 3, 7, 12, 60]) {
        const durations = allocateSeconds(total, n);
        expect(durations).toHaveLength(n);
        expect(durations.reduce((a, b) => a + b, 0)).toBe(total);
      }
    }
  });

  it('gives the remainder to the first questions', () => {
    expect(allocateSeconds(10, 3)).toEqual([4, 3, 3]);
    expect(allocateSeconds(11, 3)).toEqual([4, 4, 3]);
  });

  it('never produces negative durations', () => {
    const durations = allocateSeconds(5, 10);
    expect(durations.every(d => d >= 0)).toBe(true);
  });
});

describe('allocateSecondsWithWarnings', () => {
  it('warns when a slide gets under 5 seconds', () => {
    const { warnings } = allocateSecondsWithWarnings(20, 10);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(w => w.includes('only'))).toBe(true);
  });

  it('does not warn for comfortable durations', () => {
    const { warnings } = allocateSecondsWithWarnings(600, 10);
    expect(warnings).toEqual([]);
  });
});

describe('resolveMcqTiming', () => {
  const perQuestion = { mcqTimingMode: 'perQuestion' as const, slideDuration: 60, totalMcqMinutes: 45, questionsPerSlide: 4 };
  const totalMode = { mcqTimingMode: 'total' as const, slideDuration: 60, totalMcqMinutes: 10, questionsPerSlide: 4 };

  it('gives every slide the same time in per-question mode (slideDuration * questionsPerSlide)', () => {
    // 10 questions, 4 per slide = 3 slides, each gets 60*4 = 240s
    const timing = resolveMcqTiming(perQuestion, 10);
    expect(timing.durationsSeconds).toEqual([240, 240, 240]);
    expect(timing.totalSeconds).toBe(720);
    expect(timing.even).toBe(true);
    expect(timing.questionsPerSlide).toBe(4);
    expect(timing.totalQuestions).toBe(10);
  });

  it('splits the total exactly across slides in total mode', () => {
    // 7 questions, 4 per slide = 2 slides, 10 min = 600s total, split as [300, 300]
    const timing = resolveMcqTiming(totalMode, 7);
    expect(timing.durationsSeconds).toHaveLength(2);
    expect(timing.totalSeconds).toBe(600);
    expect(timing.even).toBe(true);
    expect(timing.questionsPerSlide).toBe(4);
    expect(timing.totalQuestions).toBe(7);
  });

  it('guarantees at least 1 second per slide in total mode even for tiny totals', () => {
    // 12 questions, 4 per slide = 3 slides, 0 min = 0s total -> guaranteed 3s (1 per slide)
    const timing = resolveMcqTiming({ ...totalMode, totalMcqMinutes: 0 }, 12);
    expect(timing.totalSeconds).toBe(3);
    expect(timing.minSeconds).toBe(1);
    expect(timing.durationsSeconds).toHaveLength(3);
  });

  it('returns nothing for an empty bank', () => {
    const timing = resolveMcqTiming(perQuestion, 0);
    expect(timing.durationsSeconds).toEqual([]);
    expect(timing.totalSeconds).toBe(0);
  });

  it('is identical for both modes when the totals coincide', () => {
    // 2 questions, 4 per slide = 1 slide
    // perQuestion: 60 * 4 = 240s per slide
    // total: 2 min = 120s total -> 120s per slide (but minimum 1 slide)
    const per = resolveMcqTiming({ ...perQuestion, slideDuration: 60 }, 2);
    const tot = resolveMcqTiming({ ...totalMode, totalMcqMinutes: 4 }, 2); // 4 min = 240s total
    expect(per.durationsSeconds).toEqual(tot.durationsSeconds);
    expect(per.totalSeconds).toBe(tot.totalSeconds);
  });

  it('reports min/max so the UI can explain uneven splits', () => {
    // 7 questions, 3 per slide = 3 slides, 10 min = 600s
    const timing = resolveMcqTiming({ ...totalMode, questionsPerSlide: 3 }, 7);
    expect(timing.maxSeconds - timing.minSeconds).toBeLessThanOrEqual(1);
    expect(timing.minSeconds).toBeGreaterThan(0);
  });
});

