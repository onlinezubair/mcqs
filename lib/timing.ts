import type { ExamConfig } from '@/types';

export function allocateSeconds(totalSec: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(totalSec / n);
  const remainder = totalSec - base * n;
  const result: number[] = [];
  for (let i = 0; i < n; i++) {
    result.push(base + (i < remainder ? 1 : 0));
  }
  return result;
}

export function allocateSecondsWithWarnings(totalSec: number, n: number): { durations: number[]; warnings: string[] } {
  const durations = allocateSeconds(totalSec, n);
  const warnings: string[] = [];
  durations.forEach((d, i) => {
    if (d < 5) {
      warnings.push(`Question ${i + 1} gets only ${d} seconds (minimum 5 recommended)`);
    }
  });
  if (durations.some(d => d < 1)) {
    warnings.push('Total time too short for number of questions');
  }
  return { durations, warnings };
}

export type McqTimingMode = ExamConfig['mcqTimingMode'];

export interface McqTiming {
  mode: McqTimingMode;
  /** Exact per-slide durations in seconds, one entry per slide. */
  durationsSeconds: number[];
  totalSeconds: number;
  minSeconds: number;
  maxSeconds: number;
  /** True when every slide gets exactly the same time. */
  even: boolean;
  /** Number of questions per slide used for calculation. */
  questionsPerSlide: number;
  /** Total number of questions across all slides. */
  totalQuestions: number;
}

// The one place MCQ timing is resolved. Both modes reduce to the same shape
// so the store, the setup preview and the summary card can never disagree.
//
// - perQuestion: every slide gets exactly `slideDuration * questionsPerSlide` seconds.
// - total: the configured total is split with a largest-remainder pass across slides,
//   so the durations sum to the total exactly and no slide drops below 1s.
//
// An empty bank resolves to zero durations rather than inventing a question.
export function resolveMcqTiming(
  config: Pick<ExamConfig, 'mcqTimingMode' | 'slideDuration' | 'totalMcqMinutes' | 'questionsPerSlide'>,
  questionCount: number,
): McqTiming {
  const questionsPerSlide = Math.max(1, Math.min(6, Math.trunc(config.questionsPerSlide ?? 4)));
  const n = Math.max(0, Math.trunc(questionCount));
  const slideCount = Math.ceil(n / questionsPerSlide);

  if (n === 0 || slideCount === 0) {
    return {
      mode: config.mcqTimingMode,
      durationsSeconds: [],
      totalSeconds: 0,
      minSeconds: 0,
      maxSeconds: 0,
      even: true,
      questionsPerSlide,
      totalQuestions: n,
    };
  }

  let durationsSeconds: number[];
  if (config.mcqTimingMode === 'total') {
    // Guarantee at least 1 second per slide even if the teacher typed a
    // total that is too small for the bank.
    const total = Math.max(slideCount, Math.round(config.totalMcqMinutes * 60));
    durationsSeconds = allocateSeconds(total, slideCount);
  } else {
    const perSlide = Math.max(1, Math.round(config.slideDuration * questionsPerSlide));
    durationsSeconds = Array.from({ length: slideCount }, () => perSlide);
  }

  const totalSeconds = durationsSeconds.reduce((sum, s) => sum + s, 0);
  const minSeconds = Math.min(...durationsSeconds);
  const maxSeconds = Math.max(...durationsSeconds);

  return {
    mode: config.mcqTimingMode,
    durationsSeconds,
    totalSeconds,
    minSeconds,
    maxSeconds,
    even: minSeconds === maxSeconds,
    questionsPerSlide,
    totalQuestions: n,
  };
}
