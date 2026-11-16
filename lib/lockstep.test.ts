import { describe, it, expect } from 'vitest';
import { getLockstepCount, getLockstepColumns, getQuestionIdAtPosition } from './lockstep';
import type { ExamDefinition, ExamSet, Question } from '@/types';

function q(id: string, options: [string, string, string, string]): Question {
  return { id, text: `Text ${id}`, options, answer: 0 };
}

const pool: Question[] = [
  q('q1', ['a1', 'b1', 'c1', 'd1']),
  q('q2', ['a2', 'b2', 'c2', 'd2']),
  q('q3', ['a3', 'b3', 'c3', 'd3']),
];

const sets: ExamSet[] = [
  { letter: 'A', questionIds: ['q1', 'q2', 'q3'] },
  { letter: 'B', questionIds: ['q2', 'q3', 'q1'] },
];

const exam = { sets, pool } as Pick<ExamDefinition, 'sets' | 'pool'>;

describe('getLockstepCount', () => {
  it('returns the longest set length', () => {
    expect(getLockstepCount(exam)).toBe(3);
  });

  it('follows the longest set when lengths differ', () => {
    expect(
      getLockstepCount({ sets: [{ letter: 'A', questionIds: ['q1'] }, { letter: 'B', questionIds: ['q1', 'q2'] }] }),
    ).toBe(2);
  });

  it('is zero with no sets', () => {
    expect(getLockstepCount({ sets: [] })).toBe(0);
  });
});

describe('getQuestionIdAtPosition', () => {
  it('reads the position within a set', () => {
    expect(getQuestionIdAtPosition(sets[1]!, 0)).toBe('q2');
    expect(getQuestionIdAtPosition(sets[1]!, 2)).toBe('q1');
  });

  it('is undefined past the end of a shorter set', () => {
    expect(getQuestionIdAtPosition({ letter: 'A', questionIds: ['q1'] }, 3)).toBeUndefined();
  });
});

describe('getLockstepColumns', () => {
  it('returns one column per set', () => {
    expect(getLockstepColumns(exam, 0)).toHaveLength(2);
  });

  it('shows each set its own question for the same position', () => {
    const [a, b] = getLockstepColumns(exam, 1);
    expect(a?.question?.id).toBe('q2');
    expect(b?.question?.id).toBe('q3');
  });

  it('applies that set\'s option permutation', () => {
    const permuted: ExamSet[] = [
      { letter: 'A', questionIds: ['q1'], optionOrder: [[2, 3, 0, 1]] },
      { letter: 'B', questionIds: ['q1'] },
    ];
    const [a, b] = getLockstepColumns({ sets: permuted, pool }, 0);
    expect(a?.options).toEqual(['c1', 'd1', 'a1', 'b1']);
    expect(b?.options).toEqual(['a1', 'b1', 'c1', 'd1']);
  });

  it('leaves a shorter set blank instead of borrowing another question', () => {
    const uneven: ExamSet[] = [
      { letter: 'A', questionIds: ['q1', 'q2'] },
      { letter: 'B', questionIds: ['q1'] },
    ];
    const [a, b] = getLockstepColumns({ sets: uneven, pool }, 1);
    expect(a?.question?.id).toBe('q2');
    expect(b?.question).toBeUndefined();
    expect(b?.options).toBeUndefined();
    expect(b?.set.letter).toBe('B');
  });

  it('numbers the column by position, not by pool index', () => {
    const [a, b] = getLockstepColumns(exam, 2);
    expect(a?.displayNumber).toBe(3);
    expect(b?.displayNumber).toBe(3);
  });

  it('tolerates a position past the end', () => {
    const columns = getLockstepColumns(exam, 99);
    expect(columns.every(column => column.question === undefined)).toBe(true);
  });
});
