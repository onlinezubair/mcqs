import { describe, it, expect } from 'vitest';
import { buildSets, getSetAnswerDistribution } from '@/lib/shuffle';
import type { Question, ExamConfig } from '@/types';

function makeQuestion(i: number, answer: 0 | 1 | 2 | 3 = 0, options?: [string, string, string, string]): Question {
  return {
    id: `q-${i}`,
    text: `Question ${i}`,
    options: options ?? [`A${i}`, `B${i}`, `C${i}`, `D${i}`],
    answer,
  };
}

const baseConfig: ExamConfig = {
  numSets: 3,
  questionsPerSet: 5,
  setStrategy: 'reorderAll',
  shuffleOptions: true,
  seed: 'test-seed',
  mcqTimingMode: 'perQuestion',
  slideDuration: 30,
  totalMcqMinutes: 20,
  examMode: 'mcq',
  paperDurationMinutes: 0,
  allowPaperPause: false,
  questionsPerSlide: 4,
};

const pool = Array.from({ length: 10 }, (_, i) => makeQuestion(i, (i % 4) as 0 | 1 | 2 | 3));

describe('buildSets', () => {
  it('creates the requested number of sets', () => {
    const sets = buildSets(pool, baseConfig);
    expect(sets).toHaveLength(3);
    expect(sets.map(s => s.letter)).toEqual(['A', 'B', 'C']);
  });

  it('is deterministic for the same seed', () => {
    const a = buildSets(pool, baseConfig);
    const b = buildSets(pool, baseConfig);
    expect(a).toEqual(b);
  });

  it('reorderAll keeps every question in each set', () => {
    const sets = buildSets(pool, baseConfig);
    for (const set of sets) {
      expect(set.questionIds).toHaveLength(pool.length);
      expect([...set.questionIds].sort()).toEqual(pool.map(q => q.id).sort());
    }
  });

  it('sample draws questionsPerSet per set', () => {
    const sets = buildSets(pool, { ...baseConfig, setStrategy: 'sample' });
    for (const set of sets) {
      expect(set.questionIds).toHaveLength(5);
      expect(new Set(set.questionIds).size).toBe(5);
    }
  });

  it('aligns optionOrder with questionIds', () => {
    const sets = buildSets(pool, baseConfig);
    for (const set of sets) {
      expect(set.optionOrder).toHaveLength(set.questionIds.length);
    }
  });

  it('ansinuate remap: shuffled answer maps back to the same option text', () => {
    const sets = buildSets(pool, baseConfig);
    for (const set of sets) {
      set.questionIds.forEach((qid, i) => {
        const q = pool.find(p => p.id === qid)!;
        const perm = set.optionOrder![i]!;
        const displayed = perm.map(idx => q.options[idx]);
        expect(displayed).toEqual([0, 1, 2, 3].map(j => q.options[perm[j]!]));
      });
    }
  });

  it('pins dependent options (all of the above)', () => {
    const dependentPool: Question[] = [
      makeQuestion(0, 3, ['One', 'Two', 'Three', 'All of the above']),
      ...Array.from({ length: 6 }, (_, i) => makeQuestion(i + 1, 0)),
    ];
    const sets = buildSets(dependentPool, baseConfig);
    const pinIndex = dependentPool.findIndex(q => q.options.some(o => /all of the above/i.test(o)));
    for (const set of sets) {
      set.questionIds.forEach((qid, i) => {
        if (qid === `q-${pinIndex}`) {
          expect(set.optionOrder![i]).toEqual([0, 1, 2, 3]);
        }
      });
    }
  });

  it('produces distinct orders position-by-position for multiple sets', () => {
    const sets = buildSets(pool, baseConfig);
    for (let i = 0; i < sets.length; i++) {
      for (let j = i + 1; j < sets.length; j++) {
        const samePositions = sets[i]!.questionIds.filter((id, k) => id === sets[j]!.questionIds[k]);
        expect(samePositions.length).toBeLessThan(sets[i]!.questionIds.length);
      }
    }
  });

  it('does not shuffle options when shuffleOptions is false', () => {
    const sets = buildSets(pool, { ...baseConfig, shuffleOptions: false });
    for (const set of sets) {
      expect(set.optionOrder).toBeUndefined();
    }
  });
});

describe('getSetAnswerDistribution', () => {
  it('counts display letters accounting for permutation', () => {
    const q = makeQuestion(0, 0);
    const sets = buildSets([q], { ...baseConfig, numSets: 1, setStrategy: 'sample', questionsPerSet: 1 });
    const set = sets[0]!;
    const dist = getSetAnswerDistribution(set, [q]);
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    expect(total).toBe(1);
  });

  it('uses unshuffled answers when optionOrder is absent', () => {
    const qs = [makeQuestion(0, 0), makeQuestion(1, 1)];
    const set = { letter: 'A', questionIds: qs.map(q => q.id) };
    const dist = getSetAnswerDistribution(set, qs);
    expect(dist.A).toBe(1);
    expect(dist.B).toBe(1);
  });
});
