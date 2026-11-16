import { describe, it, expect } from 'vitest';
import {
  buildMetaFileBase,
  buildMetaHeaderLine,
  buildMetaLabelParts,
  formatDateForFilename,
  formatDateForHeader,
} from './meta';

const meta = {
  program: 'Pharm.D',
  semester: '4',
  subject: 'Pharmacology',
  subjectCode: 'PHARM412',
  examName: 'Quiz',
  quizNumber: 3,
  date: '2026-09-06',
};

describe('formatDateForHeader', () => {
  it('formats an ISO date without a UTC shift', () => {
    expect(formatDateForHeader('2026-09-06')).toBe('06 Sep 2026');
  });

  it('returns empty string for invalid input', () => {
    expect(formatDateForHeader('')).toBe('');
    expect(formatDateForHeader('not-a-date')).toBe('');
  });
});

describe('formatDateForFilename', () => {
  it('round-trips an ISO date', () => {
    expect(formatDateForFilename('2026-09-06')).toBe('2026-09-06');
  });

  it('returns empty string for invalid input', () => {
    expect(formatDateForFilename('nope')).toBe('');
  });
});

describe('buildMetaLabelParts', () => {
  it('joins program, semester, code—subject and quiz name', () => {
    expect(buildMetaLabelParts(meta)).toEqual([
      'Pharm.D',
      'Semester 4',
      'PHARM412 — Pharmacology',
      'Quiz 3',
    ]);
  });

  it('omits blank fields', () => {
    expect(
      buildMetaLabelParts({
        program: '',
        semester: '',
        subject: '',
        subjectCode: '',
        examName: '',
        quizNumber: 0,
        date: '',
      }),
    ).toEqual([]);
  });
});

describe('buildMetaHeaderLine', () => {
  it('appends the formatted date', () => {
    expect(buildMetaHeaderLine(meta)).toBe(
      'Pharm.D — Semester 4 — PHARM412 — Pharmacology — Quiz 3 — 06 Sep 2026',
    );
  });
});

describe('buildMetaFileBase', () => {
  it('builds a filesystem-safe base name', () => {
    expect(buildMetaFileBase(meta)).toBe('PharmD_Sem4_PHARM412_Quiz3_2026-09-06');
  });

  it('falls back when every field is blank', () => {
    expect(
      buildMetaFileBase({
        program: '',
        semester: '',
        subject: '',
        subjectCode: '',
        examName: '',
        quizNumber: 0,
        date: '',
      }),
    ).toMatch(/^mcq-exam-\d{4}-\d{2}-\d{2}$/);
  });
});

