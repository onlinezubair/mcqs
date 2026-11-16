import { describe, it, expect } from 'vitest';
import { getTimerPhase, getPhaseClass, getQuarter, getSlideTheme, elapsedRatio, quarterMilestonesCrossed } from '@/lib/timerTheme';

describe('getTimerPhase (slide)', () => {
  it('is critical at or below zero', () => {
    expect(getTimerPhase(0, 30_000, 'slide')).toEqual({ phase: 'critical', isPulse: true });
    expect(getTimerPhase(-100, 30_000, 'slide')).toEqual({ phase: 'critical', isPulse: true });
  });

  it('is critical in the last 3 seconds', () => {
    expect(getTimerPhase(3_000, 30_000, 'slide')).toEqual({ phase: 'critical', isPulse: true });
  });

  it('is danger between 3 and 5 seconds', () => {
    expect(getTimerPhase(4_000, 30_000, 'slide')).toEqual({ phase: 'danger', isPulse: true });
  });

  it('is danger at or below 10% once past the critical window', () => {
    expect(getTimerPhase(6_000, 60_000, 'slide')).toEqual({ phase: 'danger', isPulse: false });
  });

  it('is warning at or below 30%', () => {
    expect(getTimerPhase(18_000, 60_000, 'slide')).toEqual({ phase: 'warning', isPulse: false });
  });

  it('is normal when plenty of time remains', () => {
    expect(getTimerPhase(30_000, 60_000, 'slide')).toEqual({ phase: 'normal', isPulse: false });
  });
});

describe('getTimerPhase (paper)', () => {
  it('is critical in the last 10 seconds', () => {
    expect(getTimerPhase(10_000, 3_600_000, 'paper')).toEqual({ phase: 'critical', isPulse: true });
  });

  it('is danger in the last minute', () => {
    expect(getTimerPhase(60_000, 3_600_000, 'paper')).toEqual({ phase: 'danger', isPulse: true });
  });

  it('is normal early in a long paper', () => {
    expect(getTimerPhase(1_800_000, 3_600_000, 'paper')).toEqual({ phase: 'normal', isPulse: false });
  });

  it('treats unknown total as normal', () => {
    expect(getTimerPhase(120_000, 0, 'paper')).toEqual({ phase: 'normal', isPulse: false });
  });
});

describe('getPhaseClass', () => {
  it('prefixes with timer-', () => {
    expect(getPhaseClass('warning')).toBe('timer-warning');
  });
});

describe('getQuarter', () => {
  it('splits the question time into four equal quarters', () => {
    expect(getQuarter(30_000, 30_000)).toBe(1);
    expect(getQuarter(22_600, 30_000)).toBe(1);
    expect(getQuarter(22_400, 30_000)).toBe(2);
    expect(getQuarter(15_100, 30_000)).toBe(2);
    expect(getQuarter(14_900, 30_000)).toBe(3);
    expect(getQuarter(7_600, 30_000)).toBe(3);
    expect(getQuarter(7_400, 30_000)).toBe(4);
    expect(getQuarter(1, 30_000)).toBe(4);
  });

  it('clamps expired and overflowing timers', () => {
    expect(getQuarter(0, 30_000)).toBe(4);
    expect(getQuarter(-500, 30_000)).toBe(4);
    expect(getQuarter(60_000, 30_000)).toBe(1);
  });

  it('treats an unknown total as the first quarter', () => {
    expect(getQuarter(10_000, 0)).toBe(1);
  });
});

describe('getSlideTheme', () => {
  it('returns a light background with dark ink for every quarter', () => {
    const totals = 40_000;
    for (const remaining of [40_000, 25_000, 15_000, 5_000]) {
      const theme = getSlideTheme(remaining, totals);
      expect(theme.background).toMatch(/^#[0-9a-f]{6}$/i);
      expect(luminance(theme.background)).toBeGreaterThan(0.8);
      expect(luminance(theme.ink)).toBeLessThan(0.2);
    }
  });

  it('changes background once per quarter', () => {
    const backgrounds = [40_000, 25_000, 15_000, 5_000].map(
      remaining => getSlideTheme(remaining, 40_000).background,
    );
    expect(new Set(backgrounds).size).toBe(4);
  });

  it('reports the matching quarter', () => {
    expect(getSlideTheme(40_000, 40_000).quarter).toBe(1);
    expect(getSlideTheme(1_000, 40_000).quarter).toBe(4);
  });
});

// Relative luminance (WCAG) — enough to assert "light" vs "dark" without a
// full contrast-ratio implementation.
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16) / 255);
  const [r, g, b] = channels.map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}


describe('elapsedRatio', () => {
  it('is 0 at the start and 1 at the end', () => {
    expect(elapsedRatio(60_000, 60_000)).toBe(0);
    expect(elapsedRatio(0, 60_000)).toBe(1);
    expect(elapsedRatio(30_000, 60_000)).toBeCloseTo(0.5, 5);
  });

  it('clamps out-of-range and handles an unknown total', () => {
    expect(elapsedRatio(90_000, 60_000)).toBe(0);
    expect(elapsedRatio(-5_000, 60_000)).toBe(1);
    expect(elapsedRatio(10_000, 0)).toBe(0);
  });
});

describe('quarterMilestonesCrossed', () => {
  it('fires the one-beep mark when crossing 25 %', () => {
    expect(quarterMilestonesCrossed(0.2, 0.26)).toEqual([1]);
  });

  it('fires the two-beep mark when crossing 50 %', () => {
    expect(quarterMilestonesCrossed(0.45, 0.52)).toEqual([2]);
  });

  it('fires the three-beep mark when crossing 75 %', () => {
    expect(quarterMilestonesCrossed(0.74, 0.8)).toEqual([3]);
  });

  it('does not re-fire a mark already passed', () => {
    expect(quarterMilestonesCrossed(0.3, 0.4)).toEqual([]);
    expect(quarterMilestonesCrossed(0.6, 0.7)).toEqual([]);
  });

  it('reports every mark skipped by a long jump, in order', () => {
    expect(quarterMilestonesCrossed(0.1, 0.8)).toEqual([1, 2, 3]);
  });

  it('ignores time going backwards or standing still', () => {
    expect(quarterMilestonesCrossed(0.5, 0.5)).toEqual([]);
    expect(quarterMilestonesCrossed(0.8, 0.2)).toEqual([]);
  });

  it('fires the first mark from a fresh zero baseline', () => {
    expect(quarterMilestonesCrossed(0, 0.25)).toEqual([1]);
    expect(quarterMilestonesCrossed(0, 0.24)).toEqual([]);
  });
});

