import { describe, it, expect } from 'vitest';
import { fmtHms, fmtClock, parseDuration } from '@/lib/time';

describe('fmtHms', () => {
  it('formats under an hour as m:ss', () => {
    expect(fmtHms(0)).toBe('0:00');
    expect(fmtHms(5)).toBe('0:05');
    expect(fmtHms(65)).toBe('1:05');
    expect(fmtHms(600)).toBe('10:00');
  });

  it('formats an hour or more as h:mm:ss', () => {
    expect(fmtHms(3600)).toBe('1:00:00');
    expect(fmtHms(3661)).toBe('1:01:01');
    expect(fmtHms(7325)).toBe('2:02:05');
  });

  it('clamps negatives to zero', () => {
    expect(fmtHms(-50)).toBe('0:00');
  });
});

describe('fmtClock', () => {
  it('formats a date to 24-hour time', () => {
    const d = new Date(2024, 0, 1, 14, 5, 0);
    expect(fmtClock(d)).toMatch(/14:05/);
  });
});

describe('parseDuration', () => {
  it('parses h:mm:ss and m:ss', () => {
    expect(parseDuration('1:00:00')).toBe(3600);
    expect(parseDuration('1:30')).toBe(90);
    expect(parseDuration('0:05')).toBe(5);
  });

  it('parses h/m suffixes', () => {
    expect(parseDuration('1h')).toBe(3600);
    expect(parseDuration('90m')).toBe(5400);
    expect(parseDuration('1h 30m')).toBe(5400);
    expect(parseDuration('1.5h')).toBe(5400);
  });

  it('parses full-word minutes and hours', () => {
    expect(parseDuration('45 minutes')).toBe(2700);
    expect(parseDuration('2 hours')).toBe(7200);
    expect(parseDuration('1 minute')).toBe(60);
    expect(parseDuration('1 hour')).toBe(3600);
  });

  it('treats a bare number as minutes', () => {
    expect(parseDuration('30')).toBe(1800);
    expect(parseDuration('1.5')).toBe(90);
  });

  it('returns null for empty or invalid input', () => {
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('   ')).toBeNull();
    expect(parseDuration('abc')).toBeNull();
  });

  it('is case-insensitive and trims', () => {
    expect(parseDuration('  1H 30M  ')).toBe(5400);
  });
});
