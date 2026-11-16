import { describe, it, expect } from 'vitest';
import { buildZipGradeAnswerKeyCsv } from './exporters';
import type { ExamDefinition, ExamConfig, Question } from '@/types';

const config: ExamConfig = {
  numSets: 2,
  questionsPerSet: 2,
  setStrategy: 'reorderAll',
  shuffleOptions: true,
  seed: 's',
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
    // Question 1's correct option is shown in position 2 for set B.
    { letter: 'B', questionIds: ['q1', 'q2'], optionOrder: [[3, 0, 1, 2], [0, 1, 2, 3]] },
  ],
  sectionB: [],
  sectionC: [],
};

describe('buildZipGradeAnswerKeyCsv', () => {
  it('starts with the literal ZipGrade header', () => {
    const csv = buildZipGradeAnswerKeyCsv(exam);
    expect(csv.split('\r\n')[0]).toBe(
      'Key Letter,Question Number,Response/Mapping,Point Value,Tags',
    );
  });

  it('has no BOM so ZipGrade parses the header literally', () => {
    expect(buildZipGradeAnswerKeyCsv(exam).charCodeAt(0)).not.toBe(0xfeff);
  });

  it('emits one row per set per question with remapped answers', () => {
    const rows = buildZipGradeAnswerKeyCsv(exam).split('\r\n');
    expect(rows).toContain('A,1,A,1,');
    expect(rows).toContain('B,1,B,1,');
    expect(rows).toContain('A,2,C,2,');
    expect(rows).toContain('B,2,C,2,');
    expect(rows).toHaveLength(1 + 2 * 2);
  });
});
