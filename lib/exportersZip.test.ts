import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { buildZip } from './exporters';
import type { ExamDefinition, ExamConfig, Question } from '@/types';

const config: ExamConfig = {
  numSets: 2,
  questionsPerSet: 2,
  setStrategy: 'reorderAll',
  shuffleOptions: true,
  seed: 'reproduce-me',
  mcqTimingMode: 'perQuestion',
  slideDuration: 30,
  totalMcqMinutes: 10,
  examMode: 'mcq',
  paperDurationMinutes: 0,
  allowPaperPause: false,
  questionsPerSlide: 4,
};

const pool: Question[] = [
  { id: 'q1', text: 'One?', options: ['a', 'b', 'c', 'd'], answer: 0, marks: 1 },
  { id: 'q2', text: 'Two?', options: ['a', 'b', 'c', 'd'], answer: 2, marks: 2 },
];

const exam: ExamDefinition = {
  id: 'exam-1',
  createdAt: 0,
  meta: {
    program: '',
    semester: '',
    subject: 'S',
    subjectCode: '',
    subjectFullName: '',
    subjectMode: '',
    examName: 'E',
    quizNumber: 0,
    date: '2026-01-01',
    dateManuallySet: false,
  },
  config,
  pool,
  sets: [
    { letter: 'A', questionIds: ['q1', 'q2'], optionOrder: [[0, 1, 2, 3], [0, 1, 2, 3]] },
    { letter: 'B', questionIds: ['q2', 'q1'], optionOrder: [[3, 0, 1, 2], [0, 1, 2, 3]] },
  ],
  sectionB: [],
  sectionC: [],
};

async function readZip(examDef: ExamDefinition): Promise<Record<string, string>> {
  const blob = await buildZip(examDef);
  const buffer = new Uint8Array(await blob.arrayBuffer());
  const files = unzipSync(buffer);
  const out: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(files)) {
    out[name] = strFromU8(bytes);
  }
  return out;
}

describe('buildZip seed persistence', () => {
  it('includes the seed in manifest.json', async () => {
    const files = await readZip(exam);
    const manifest = JSON.parse(files['manifest.json']!);
    expect(manifest.seed).toBe('reproduce-me');
    expect(manifest.numSets).toBe(2);
    expect(manifest.setStrategy).toBe('reorderAll');
  });

  it('includes a plain-text seed.txt with reproduction steps', async () => {
    const files = await readZip(exam);
    expect(files['seed.txt']).toBeDefined();
    expect(files['seed.txt']).toContain('Seed: reproduce-me');
    expect(files['seed.txt']).toContain('reproduce this exact exam');
  });

  it('includes a locked-exam snapshot with the seed, sets and option order', async () => {
    const files = await readZip(exam);
    expect(files['locked-exam.json']).toBeDefined();
    const snapshot = JSON.parse(files['locked-exam.json']!);
    expect(snapshot.seed).toBe('reproduce-me');
    expect(snapshot.sets).toEqual(exam.sets);
    expect(snapshot.pool).toEqual(exam.pool);
  });

  it('the snapshot round-trips to an identical exam definition', async () => {
    const files = await readZip(exam);
    const snapshot = JSON.parse(files['locked-exam.json']!);
    expect(snapshot.sets.map((s: { questionIds: string[] }) => s.questionIds)).toEqual(
      exam.sets.map(s => s.questionIds),
    );
    expect(snapshot.config.seed).toBe(exam.config.seed);
  });

  it('backfills a stable seed when the exam has none (older locked exams)', async () => {
    const legacy: ExamDefinition = {
      ...exam,
      id: 'abcdef12-3456-7890-abcd-ef1234567890',
      config: { ...exam.config, seed: '' },
    };
    const files = await readZip(legacy);
    const manifest = JSON.parse(files['manifest.json']!);
    expect(manifest.seed).toBe('exam-abcdef12');
    expect(files['seed.txt']).toContain('Seed: exam-abcdef12');
    // Re-exporting must produce the same fallback seed, not a fresh random one.
    const again = await readZip(legacy);
    expect(JSON.parse(again['manifest.json']!).seed).toBe('exam-abcdef12');
  });
});
