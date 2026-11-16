import { describe, it, expect } from 'vitest';
import {
  sanitizeExamConfig,
  parseIntInRange,
  sanitizeExamMeta,
  EXAM_NAMES,
  SUBJECT_MODES,
} from './validate';
import type { ExamConfig, ExamMeta } from '@/types';

const fallback: ExamConfig = {
  numSets: 1,
  questionsPerSet: 20,
  setStrategy: 'reorderAll',
  shuffleOptions: true,
  seed: '',
  mcqTimingMode: 'perQuestion',
  slideDuration: 60,
  totalMcqMinutes: 45,
  examMode: 'mcq',
  paperDurationMinutes: 120,
  allowPaperPause: true,
  questionsPerSlide: 4,
};

describe('parseIntInRange', () => {
  it('parses valid integers', () => {
    expect(parseIntInRange('12', 1, 1, 26)).toBe(12);
  });

  it('falls back for empty, NaN and junk input', () => {
    expect(parseIntInRange('', 3, 1, 26)).toBe(3);
    expect(parseIntInRange('abc', 3, 1, 26)).toBe(3);
    expect(parseIntInRange('NaN', 3, 1, 26)).toBe(3);
  });

  it('clamps out-of-range values', () => {
    expect(parseIntInRange('0', 1, 1, 26)).toBe(1);
    expect(parseIntInRange('99', 1, 1, 26)).toBe(26);
  });
});

describe('sanitizeExamConfig', () => {
  it('returns fallback for non-objects', () => {
    expect(sanitizeExamConfig(null, fallback)).toEqual(fallback);
    expect(sanitizeExamConfig('nope', fallback)).toEqual(fallback);
  });

  it('repairs NaN and null numeric fields written by earlier builds', () => {
    const corrupted = {
      ...fallback,
      numSets: NaN,
      questionsPerSet: null,
      slideDuration: undefined,
      totalMcqMinutes: Infinity,
    };
    const result = sanitizeExamConfig(corrupted, fallback);
    expect(result.numSets).toBe(1);
    expect(result.questionsPerSet).toBe(20);
    expect(result.slideDuration).toBe(60);
    expect(result.totalMcqMinutes).toBe(45);
    expect(Number.isFinite(result.numSets)).toBe(true);
  });

  it('clamps numeric fields into their valid ranges', () => {
    const result = sanitizeExamConfig({ ...fallback, numSets: 99, slideDuration: 0, questionsPerSet: -3 }, fallback);
    expect(result.numSets).toBe(26);
    expect(result.slideDuration).toBe(1);
    expect(result.questionsPerSet).toBe(1);
  });

  it('keeps valid values and ignores unknown enum members', () => {
    const result = sanitizeExamConfig({ ...fallback, numSets: 4, examMode: 'bogus', setStrategy: 'sample' }, fallback);
    expect(result.numSets).toBe(4);
    expect(result.examMode).toBe('mcq');
    expect(result.setStrategy).toBe('sample');
  });
});


const metaFallback: ExamMeta = {
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

describe('exam meta defaults', () => {
  it('exposes the agreed dropdown values', () => {
    expect(EXAM_NAMES).toEqual(['Quiz', 'Midterm', 'Final Term']);
    expect(SUBJECT_MODES).toEqual(['Theory', 'Practical']);
    expect(metaFallback.examName).toBe('Quiz');
    expect(metaFallback.subjectMode).toBe('Theory');
    expect(metaFallback.quizNumber).toBe(1);
  });
});

describe('sanitizeExamMeta', () => {
  it('returns fallback for non-objects', () => {
    expect(sanitizeExamMeta(null, metaFallback)).toEqual(metaFallback);
  });

  it('keeps valid dropdown values', () => {
    const result = sanitizeExamMeta(
      { examName: 'Final Term', subjectMode: 'Practical', quizNumber: 5 },
      metaFallback,
    );
    expect(result.examName).toBe('Final Term');
    expect(result.subjectMode).toBe('Practical');
    expect(result.quizNumber).toBe(5);
  });

  it('maps legacy free-text exam names onto dropdown values', () => {
    expect(sanitizeExamMeta({ examName: 'Class Quiz' }, metaFallback).examName).toBe('Quiz');
    expect(sanitizeExamMeta({ examName: 'Midterm Examination' }, metaFallback).examName).toBe('Midterm');
    expect(sanitizeExamMeta({ examName: 'mid term' }, metaFallback).examName).toBe('Midterm');
    expect(sanitizeExamMeta({ examName: 'Final Examination' }, metaFallback).examName).toBe('Final Term');
  });

  it('falls back for unknown or blank values', () => {
    expect(sanitizeExamMeta({ examName: 'Pop Quiz 7' }, metaFallback).examName).toBe('Quiz');
    expect(sanitizeExamMeta({ subjectMode: 'Viva' }, metaFallback).subjectMode).toBe('Theory');
    expect(sanitizeExamMeta({ subjectMode: '' }, metaFallback).subjectMode).toBe('Theory');
  });

  it('repairs a zero, negative, fractional or non-numeric quiz number', () => {
    expect(sanitizeExamMeta({ quizNumber: 0 }, metaFallback).quizNumber).toBe(1);
    expect(sanitizeExamMeta({ quizNumber: -2 }, metaFallback).quizNumber).toBe(1);
    expect(sanitizeExamMeta({ quizNumber: 2.7 }, metaFallback).quizNumber).toBe(2);
    expect(sanitizeExamMeta({ quizNumber: 'x' }, metaFallback).quizNumber).toBe(1);
  });

  it('preserves the free-text metadata fields', () => {
    const result = sanitizeExamMeta(
      {
        program: 'Pharm.D',
        semester: '4',
        subject: 'DDSFS-II',
        subjectCode: '415',
        subjectFullName: 'Pharmaceutics IIB',
        date: '2026-05-01',
        dateManuallySet: true,
      },
      metaFallback,
    );
    expect(result).toMatchObject({
      program: 'Pharm.D',
      semester: '4',
      subject: 'DDSFS-II',
      subjectCode: '415',
      subjectFullName: 'Pharmaceutics IIB',
      date: '2026-05-01',
      dateManuallySet: true,
    });
  });
});
