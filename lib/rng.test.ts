import { describe, it, expect } from 'vitest';
import { createRng, shuffleInPlace, generateSeed } from '@/lib/rng';

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng('seed-1');
    const b = createRng('seed-1');
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('differs across seeds', () => {
    const a = createRng('seed-1');
    const b = createRng('seed-2');
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('produces values in [0, 1)', () => {
    const rng = createRng('bounds');
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('shuffles deterministically and preserves all elements', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = shuffleInPlace([...input], createRng('abc'));
    expect([...shuffled].sort((x, y) => x - y)).toEqual(input);
    const again = shuffleInPlace([...input], createRng('abc'));
    expect(again).toEqual(shuffled);
  });
});

describe('generateSeed', () => {
  it('produces a non-empty url-safe seed', () => {
    const seed = generateSeed();
    expect(seed.length).toBeGreaterThan(0);
    expect(seed).toMatch(/^[a-z0-9]+$/);
  });

  it('produces different seeds across calls', () => {
    const seeds = new Set(Array.from({ length: 50 }, () => generateSeed()));
    expect(seeds.size).toBeGreaterThan(1);
  });
});
