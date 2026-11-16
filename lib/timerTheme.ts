import type { TimerPhase } from '@/types';

export function getTimerPhase(remainingMs: number, totalMs: number, kind: 'slide' | 'paper'): TimerPhase {
  if (remainingMs <= 0) {
    return { phase: 'critical', isPulse: true };
  }

  const remainingSec = remainingMs / 1000;
  const totalSec = totalMs / 1000;
  const pct = totalSec > 0 ? remainingSec / totalSec : 1;

  if (kind === 'slide') {
    if (remainingSec <= 3) return { phase: 'critical', isPulse: true };
    if (remainingSec <= 5) return { phase: 'danger', isPulse: true };
    if (pct <= 0.1) return { phase: 'danger', isPulse: false };
    if (pct <= 0.3) return { phase: 'warning', isPulse: false };
    return { phase: 'normal', isPulse: false };
  } else {
    if (remainingSec <= 10) return { phase: 'critical', isPulse: true };
    if (remainingSec <= 60) return { phase: 'danger', isPulse: true };
    if (pct <= 0.1) return { phase: 'danger', isPulse: false };
    if (pct <= 0.3) return { phase: 'warning', isPulse: false };
    return { phase: 'normal', isPulse: false };
  }
}

export function getPhaseClass(phase: TimerPhase['phase']): string {
  return `timer-${phase}`;
}

export type Quarter = 1 | 2 | 3 | 4;

export interface SlideTheme {
  quarter: Quarter;
  background: string;
  surface: string;
  ink: string;
  muted: string;
  border: string;
  timerNormal: string;
  timerWarning: string;
  timerDanger: string;
  timerCritical: string;
}

// Light projector-friendly palettes, one per quarter of the time a question
// is on screen. Green while there is plenty of time, then cream, peach and
// rose as the clock runs out. Every palette keeps dark ink so the projected
// text stays high-contrast even from the back of a room.
const QUARTER_THEMES: Record<Quarter, Omit<SlideTheme, 'quarter'>> = {
  1: {
    background: '#e8f7ef',
    surface: '#ffffff',
    ink: '#0f2f22',
    muted: '#4a6b5c',
    border: '#bfe3cf',
    timerNormal: '#0f2f22',
    timerWarning: '#8a6200',
    timerDanger: '#a8431c',
    timerCritical: '#a01212',
  },
  2: {
    background: '#fbf4d9',
    surface: '#fffdf4',
    ink: '#3a2e08',
    muted: '#6b5c2e',
    border: '#e6d9a2',
    timerNormal: '#3a2e08',
    timerWarning: '#8a6200',
    timerDanger: '#a8431c',
    timerCritical: '#a01212',
  },
  3: {
    background: '#ffe9d4',
    surface: '#fff8f1',
    ink: '#4a2408',
    muted: '#7c5233',
    border: '#f0c9a6',
    timerNormal: '#4a2408',
    timerWarning: '#8a5b00',
    timerDanger: '#a8431c',
    timerCritical: '#9d1414',
  },
  4: {
    background: '#ffe9e7',
    surface: '#fff7f6',
    ink: '#4a1414',
    muted: '#8a4a45',
    border: '#f2c3bf',
    timerNormal: '#4a1414',
    timerWarning: '#8a4a00',
    timerDanger: '#a8261c',
    timerCritical: '#8f0f0f',
  },
};

export function getQuarter(remainingMs: number, totalMs: number): Quarter {
  if (totalMs <= 0) return 1;
  if (remainingMs <= 0) return 4;
  const elapsed = 1 - Math.min(remainingMs, totalMs) / totalMs;
  if (elapsed < 0.25) return 1;
  if (elapsed < 0.5) return 2;
  if (elapsed < 0.75) return 3;
  return 4;
}

export type QuarterMilestone = 1 | 2 | 3;

const MILESTONE_RATIOS: Record<QuarterMilestone, number> = { 1: 0.25, 2: 0.5, 3: 0.75 };

// Which 25 / 50 / 75 % marks were passed between two elapsed-time readings.
// The caller plays 1, 2 or 3 beeps respectively, so a jump caused by a
// throttled tab still announces every milestone it skipped past.
export function quarterMilestonesCrossed(
  previousElapsedRatio: number,
  nextElapsedRatio: number,
): QuarterMilestone[] {
  const from = Number.isFinite(previousElapsedRatio) ? Math.min(1, Math.max(0, previousElapsedRatio)) : 0;
  const to = Number.isFinite(nextElapsedRatio) ? Math.min(1, Math.max(0, nextElapsedRatio)) : 0;
  if (to <= from) return [];

  return (Object.keys(MILESTONE_RATIOS) as unknown as QuarterMilestone[])
    .map(key => Number(key) as QuarterMilestone)
    .filter(milestone => from < MILESTONE_RATIOS[milestone] && to >= MILESTONE_RATIOS[milestone])
    .sort((a, b) => a - b);
}

export function elapsedRatio(remainingMs: number, totalMs: number): number {
  if (totalMs <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - remainingMs / totalMs));
}

export function getSlideTheme(remainingMs: number, totalMs: number): SlideTheme {
  const quarter = getQuarter(remainingMs, totalMs);
  return { quarter, ...QUARTER_THEMES[quarter] };
}