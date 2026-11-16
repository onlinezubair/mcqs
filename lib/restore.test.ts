import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { restoreSavedExam, isRestoreSuccess, isRestoreFailure, describeRestoredConfig } from './restore';
import type { ExamConfig, ExamDefinition, ExamMeta, Question } from '@/types';

const fallbackConfig: ExamConfig = {
  numSets: 1,
  questionsPerSet: 1,
  setStrategy: 'sample',
  shuffleOptions: false,
  seed: '',
  mcqTimingMode: 'perQuestion',
  slideDuration: 30,
  totalMcqMinutes: 10,
  examMode: 'mcq',
  paperDurationMinutes: 0,
  allowPaperPause: false,
  questionsPerSlide: 4,
};

const fallbackMeta: ExamMeta = {
  program: '',
  semester: '',
  subject: '',
  subjectCode: '',
  subjectFullName: '',
  subjectMode: 'Theory',
  examName: 'Quiz',
  quizNumber: 1,
  date: '2026-01-01',
  dateManuallySet: false,
};

const config: ExamConfig = {
  ...fallbackConfig,
  numSets: 4,
  questionsPerSet: 5,
  setStrategy: 'reorderAll',
  shuffleOptions: true,
  seed: 'RECOVER-ME',
};

const pool: Question[] = [
  { id: 'q1', text: 'One?', options: ['a', 'b', 'c', 'd'], answer: 0, marks: 1 },
  { id: 'q2', text: 'Two?', options: ['a', 'b', 'c', 'd'], answer: 2, marks: 2 },
];

const exam: ExamDefinition = {
  id: 'exam-xyz',
  createdAt: 123,
  meta: { ...fallbackMeta, examName: 'Final Term', subject: 'Biology' },
  config,
  pool,
  sets: [
    { letter: 'A', questionIds: ['q2', 'q1'], optionOrder: [[3, 0, 1, 2], [0, 1, 2, 3]] },
    { letter: 'B', questionIds: ['q1', 'q2'], optionOrder: [[0, 1, 2, 3], [2, 3, 0, 1]] },
  ],
  sectionB: [],
  sectionC: [],
};

function buildBundle(options: { includeLocked?: boolean; includeManifest?: boolean } = {}): ArrayBuffer {
  const { includeLocked = true, includeManifest = true } = options;
  const files: Record<string, Uint8Array> = {};

  if (includeLocked) {
    files['locked-exam.json'] = strToU8(JSON.stringify({
      format: 'mcq-projector-locked-exam',
      schemaVersion: 1,
      seed: exam.config.seed,
      meta: exam.meta,
      config: exam.config,
      pool: exam.pool,
      sets: exam.sets,
      sectionB: exam.sectionB,
      sectionC: exam.sectionC,
    }));
  }
  if (includeManifest) {
    files['manifest.json'] = strToU8(JSON.stringify({
      seed: exam.config.seed,
      config: exam.config,
    }));
  }
  files['seed.txt'] = strToU8(`Seed: ${exam.config.seed}\n\nNumber of sets : 4\nSet strategy   : Reorder all`);

  return zipSync(files).buffer as ArrayBuffer;
}

const opts = { fallbackConfig, fallbackMeta };

describe('restoreSavedExam', () => {
  it('restores a full locked exam from a ZIP, including exact sets and option order', () => {
    const result = restoreSavedExam(buildBundle(), opts);
    expect(isRestoreSuccess(result)).toBe(true);
    if (!isRestoreSuccess(result)) return;
    expect(result.kind).toBe('locked');
    expect(result.exam?.sets).toEqual(exam.sets);
    expect(result.exam?.pool).toEqual(pool);
    expect(result.seed).toBe('RECOVER-ME');
  });

  it('restores seed + config from a ZIP without locked-exam.json', () => {
    const result = restoreSavedExam(buildBundle({ includeLocked: false }), opts);
    expect(isRestoreSuccess(result)).toBe(true);
    if (!isRestoreSuccess(result)) return;
    expect(result.kind).toBe('seed');
    expect(result.config.seed).toBe('RECOVER-ME');
    expect(result.config.numSets).toBe(4);
    expect(result.config.setStrategy).toBe('reorderAll');
  });

  it('restores a bare pasted seed, keeping the current set count', () => {
    const result = restoreSavedExam('RECOVER-ME', opts);
    expect(isRestoreSuccess(result)).toBe(true);
    if (!isRestoreSuccess(result)) return;
    expect(result.seed).toBe('RECOVER-ME');
    expect(result.config.numSets).toBe(fallbackConfig.numSets);
  });

  it('restores a pasted seed.txt block', () => {
    const text = 'MCQ Projector — Saved exam key\n\nSeed: RECOVER-ME\n\nNumber of sets : 4';
    const result = restoreSavedExam(text, opts);
    expect(isRestoreSuccess(result)).toBe(true);
    if (!isRestoreSuccess(result)) return;
    expect(result.seed).toBe('RECOVER-ME');
  });

  it('rejects empty input', () => {
    const result = restoreSavedExam('   ', opts);
    expect(isRestoreFailure(result)).toBe(true);
  });

  it('rejects a non-exam ZIP', () => {
    const zip = zipSync({ 'readme.txt': strToU8('hello') }).buffer as ArrayBuffer;
    const result = restoreSavedExam(zip, opts);
    expect(isRestoreFailure(result)).toBe(true);
    if (!isRestoreFailure(result)) return;
    expect(result.message).toMatch(/does not contain a saved exam/i);
  });

  it('describeRestoredConfig names the set count and strategy', () => {
    const text = describeRestoredConfig(config);
    expect(text).toContain('4 sets');
    expect(text).toContain('Reorder all');
    expect(text).toContain('RECOVER-ME');
  });
});
