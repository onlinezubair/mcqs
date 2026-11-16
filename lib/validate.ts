import type { ExamConfig, ExamMeta } from '@/types';

const INT_FIELDS = {
  numSets: { min: 1, max: 26 },
  questionsPerSet: { min: 1, max: 10000 },
  slideDuration: { min: 1, max: 86400 },
  totalMcqMinutes: { min: 0, max: 100000 },
  paperDurationMinutes: { min: 0, max: 100000 },
} as const;

type IntField = keyof typeof INT_FIELDS;

export function parseIntInRange(raw: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function sanitizeExamConfig(candidate: unknown, fallback: ExamConfig): ExamConfig {
  if (!candidate || typeof candidate !== 'object') return fallback;

  const input = candidate as Partial<ExamConfig>;
  const result: ExamConfig = { ...fallback };

  for (const key of Object.keys(INT_FIELDS) as IntField[]) {
    const value = input[key];
    const { min, max } = INT_FIELDS[key];
    result[key] =
      typeof value === 'number' && Number.isFinite(value)
        ? Math.min(max, Math.max(min, Math.trunc(value)))
        : fallback[key];
  }

  if (input.setStrategy === 'reorderAll' || input.setStrategy === 'sample') {
    result.setStrategy = input.setStrategy;
  }
  if (input.mcqTimingMode === 'perQuestion' || input.mcqTimingMode === 'total') {
    result.mcqTimingMode = input.mcqTimingMode;
  }
  if (input.examMode === 'mcq' || input.examMode === 'combined') {
    result.examMode = input.examMode;
  }
  if (typeof input.shuffleOptions === 'boolean') result.shuffleOptions = input.shuffleOptions;
  if (typeof input.allowPaperPause === 'boolean') result.allowPaperPause = input.allowPaperPause;
  if (typeof input.seed === 'string') result.seed = input.seed;

  return result;
}

export const EXAM_NAMES = ['Quiz', 'Midterm', 'Final Term'] as const;
export const SUBJECT_MODES = ['Theory', 'Practical'] as const;

export type ExamName = (typeof EXAM_NAMES)[number];
export type SubjectMode = (typeof SUBJECT_MODES)[number];

const LEGACY_EXAM_NAMES: Record<string, ExamName> = {
  'class quiz': 'Quiz',
  quiz: 'Quiz',
  'mid term': 'Midterm',
  midterm: 'Midterm',
  'midterm exam': 'Midterm',
  'midterm examination': 'Midterm',
  'final term': 'Final Term',
  'final exam': 'Final Term',
  'final examination': 'Final Term',
};

function matchEnum<T extends string>(value: string, options: readonly T[]): T | null {
  const cleaned = value.trim().toLowerCase();
  return options.find(option => option.toLowerCase() === cleaned) ?? null;
}

// Repairs meta loaded from an older build, where examName/subjectMode were
// free text and quizNumber could be 0. Unknown values fall back to defaults
// so the dropdowns always have a valid option selected.
export function sanitizeExamMeta(candidate: unknown, fallback: ExamMeta): ExamMeta {
  if (!candidate || typeof candidate !== 'object') return fallback;
  const input = candidate as Partial<ExamMeta>;
  const result: ExamMeta = { ...fallback };

  for (const key of ['program', 'semester', 'subject', 'subjectCode', 'subjectFullName', 'date'] as const) {
    const value = input[key];
    if (typeof value === 'string') result[key] = value;
  }
  if (typeof input.dateManuallySet === 'boolean') result.dateManuallySet = input.dateManuallySet;

  const examName = typeof input.examName === 'string' ? input.examName : '';
  result.examName =
    matchEnum(examName, EXAM_NAMES) ?? LEGACY_EXAM_NAMES[examName.trim().toLowerCase()] ?? fallback.examName;

  const subjectMode = typeof input.subjectMode === 'string' ? input.subjectMode : '';
  result.subjectMode = matchEnum(subjectMode, SUBJECT_MODES) ?? fallback.subjectMode;

  const quizNumber = input.quizNumber;
  result.quizNumber =
    typeof quizNumber === 'number' && Number.isFinite(quizNumber) && quizNumber >= 1
      ? Math.trunc(quizNumber)
      : fallback.quizNumber;

  return result;
}
