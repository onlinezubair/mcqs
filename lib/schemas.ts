import { z } from 'zod';
import type {
  Letter,
  Opts,
  Question,
  ExamMeta,
  ExamConfig,
  DisplayPrefs,
  Screen,
  ExamSet,
  ExamDefinition,
  PauseEntry,
  DeadlineTimer,
  Progress,
  DraftInput,
  PersistedState,
  Issue,
  ExportedExam,
  GoogleSession,
  CloudSettings,
  PaperIndexEntry,
  SavedPaper,
  PaperQuestion,
  PaperPart,
  TimerPhase,
} from '@/types';

export const letterSchema: z.ZodType<Letter> = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
export const optsSchema: z.ZodType<Opts> = z.tuple([z.string(), z.string(), z.string(), z.string()]);

export const questionSchema: z.ZodType<Question> = z.object({
  id: z.string(),
  text: z.string(),
  options: optsSchema,
  answer: letterSchema,
  marks: z.number().default(1),
  groupStem: z.string().optional(),
  label: z.string().optional(),
});

export const paperPartSchema: z.ZodType<PaperPart> = z.object({
  label: z.string(),
  text: z.string(),
  marks: z.number().optional(),
});

export const paperQuestionSchema: z.ZodType<PaperQuestion> = z.object({
  number: z.number(),
  text: z.string(),
  marks: z.number().optional(),
  parts: z.array(paperPartSchema),
});

export const examMetaSchema: z.ZodType<ExamMeta> = z.object({
  program: z.string(),
  semester: z.string(),
  subject: z.string(),
  subjectCode: z.string(),
  subjectFullName: z.string(),
  subjectMode: z.string(),
  examName: z.string(),
  quizNumber: z.number().int().nonnegative(),
  date: z.string(),
  dateManuallySet: z.boolean(),
});

export const examConfigSchema: z.ZodType<ExamConfig> = z.object({
  numSets: z.number().int().min(1).max(26),
  questionsPerSet: z.number().int().min(1),
  setStrategy: z.enum(['reorderAll', 'sample']),
  shuffleOptions: z.boolean(),
  seed: z.string().min(1),
  mcqTimingMode: z.enum(['perQuestion', 'total']),
  slideDuration: z.number().int().positive(),
  totalMcqMinutes: z.number().int().nonnegative(),
  examMode: z.enum(['mcq', 'combined']),
  paperDurationMinutes: z.number().int().nonnegative(),
  allowPaperPause: z.boolean(),
  questionsPerSlide: z.number().int().min(2).max(6).default(4),
});

export const displayPrefsSchema: z.ZodType<DisplayPrefs> = z.object({
  fontScale: z.number().min(0.8).max(1.5),
  theme: z.enum(['chalkboard', 'light']),
  soundEnabled: z.boolean(),
});

export const screenSchema: z.ZodType<Screen> = z.enum([
  'meta',
  'setup',
  'review',
  'calibrate',
  'exam',
  'paperIntro',
  'paper',
  'end',
]);

export const optionPermutationSchema: z.ZodType<[Letter, Letter, Letter, Letter]> = z.tuple([
  letterSchema,
  letterSchema,
  letterSchema,
  letterSchema,
]);

export const examSetSchema: z.ZodType<ExamSet> = z.object({
  letter: z.string(),
  questionIds: z.array(z.string()),
  optionOrder: z.array(optionPermutationSchema).optional(),
});

export const pauseEntrySchema: z.ZodType<PauseEntry> = z.object({
  at: z.number(),
  resumedAt: z.number().optional(),
  reason: z.enum(['manual', 'recovery', 'suspended']),
});

export const deadlineTimerSchema: z.ZodType<DeadlineTimer> = z.object({
  endsAt: z.number().nullable(),
  remainingMs: z.number(),
  totalMs: z.number(),
  paused: z.boolean(),
  pausedLog: z.array(pauseEntrySchema),
  extraMs: z.number(),
});

export const progressSchema: z.ZodType<Progress> = z.object({
  activeSetIndex: z.number().int().nonnegative(),
  completedSetIndexes: z.array(z.number().int().nonnegative()),
  slideIndex: z.number().int().nonnegative(),
  slideTimer: deadlineTimerSchema,
  paperTimer: deadlineTimerSchema.optional(),
});

export const draftInputSchema: z.ZodType<DraftInput> = z.object({
  meta: examMetaSchema,
  config: examConfigSchema,
  rawMcq: z.string(),
  rawB: z.string(),
  rawC: z.string(),
  rawUnified: z.string(),
});

export const examDefinitionSchema: z.ZodType<ExamDefinition> = z.object({
  id: z.string(),
  createdAt: z.number(),
  meta: examMetaSchema,
  config: examConfigSchema,
  pool: z.array(questionSchema),
  sets: z.array(examSetSchema),
  sectionB: z.array(paperQuestionSchema),
  sectionC: z.array(paperQuestionSchema),
});

export const persistedStateSchema: z.ZodType<PersistedState> = z.object({
  savedAt: z.number(),
  screen: screenSchema,
  draft: draftInputSchema,
  exam: examDefinitionSchema.nullable(),
  progress: progressSchema.nullable(),
});

export const issueSchema: z.ZodType<Issue> = z.object({
  line: z.number().int().positive(),
  severity: z.enum(['error', 'warning']),
  code: z.enum([
    'PARSE_OPTION_COUNT',
    'PARSE_MISSING_ANSWER',
    'PARSE_EMPTY_STEM',
    'PARSE_FIFTH_OPTION',
    'PARSE_DUPLICATE_STEM',
    'PARSE_DUPLICATE_OPTION',
    'PARSE_LONG_STEM',
    'PARSE_LONG_OPTION',
    'PARSE_ANSWER_SKEW',
    'PARSE_TRAILING_TEXT',
    'PARSE_MARKS_MISMATCH',
    'UNIFIED_MISSING_SECTION',
    'UNIFIED_MARKS_MISMATCH',
    'UNIFIED_TOTAL_MISMATCH',
    'UNIFIED_UNKNOWN_KEY',
  ]),
  message: z.string(),
});

export const exportedExamSchema: z.ZodType<ExportedExam> = z.object({
  format: z.literal('mcq-projector-exam'),
  schemaVersion: z.literal(1),
  exportedAt: z.number(),
  draft: draftInputSchema,
});

export const googleSessionSchema: z.ZodType<GoogleSession> = z.object({
  accessToken: z.string(),
  expiresAt: z.number(),
  email: z.string().email(),
});

export const cloudSettingsSchema: z.ZodType<CloudSettings> = z.object({
  meta: examMetaSchema,
  config: examConfigSchema,
  displayPrefs: displayPrefsSchema,
});

export const paperIndexEntrySchema: z.ZodType<PaperIndexEntry> = z.object({
  id: z.string(),
  name: z.string(),
  driveFileId: z.string(),
  remoteModifiedTime: z.string(),
});

export const savedPaperSchema: z.ZodType<SavedPaper> = z.object({
  draft: draftInputSchema,
  createdAt: z.number(),
  schema: z.literal(1),
});

export const timerPhaseSchema: z.ZodType<TimerPhase> = z.object({
  phase: z.enum(['normal', 'warning', 'danger', 'critical']),
  isPulse: z.boolean(),
});

export function safeParse<T>(schema: z.ZodType<T>, data: unknown): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  return result.success ? { success: true, data: result.data } : { success: false, error: result.error };
}

// type satisfies type checks below are compile-time type assertions
const _typeCheckQuestion: z.ZodType<Question> = questionSchema;
const _typeCheckPaperPart: z.ZodType<PaperPart> = paperPartSchema;
const _typeCheckPaperQuestion: z.ZodType<PaperQuestion> = paperQuestionSchema;
const _typeCheckExamMeta: z.ZodType<ExamMeta> = examMetaSchema;
const _typeCheckExamConfig: z.ZodType<ExamConfig> = examConfigSchema;
const _typeCheckDisplayPrefs: z.ZodType<DisplayPrefs> = displayPrefsSchema;
const _typeCheckScreen: z.ZodType<Screen> = screenSchema;
const _typeCheckExamSet: z.ZodType<ExamSet> = examSetSchema;
const _typeCheckPauseEntry: z.ZodType<PauseEntry> = pauseEntrySchema;
const _typeCheckDeadlineTimer: z.ZodType<DeadlineTimer> = deadlineTimerSchema;
const _typeCheckProgress: z.ZodType<Progress> = progressSchema;
const _typeCheckDraftInput: z.ZodType<DraftInput> = draftInputSchema;
const _typeCheckExamDefinition: z.ZodType<ExamDefinition> = examDefinitionSchema;
const _typeCheckPersistedState: z.ZodType<PersistedState> = persistedStateSchema;
const _typeCheckIssue: z.ZodType<Issue> = issueSchema;
const _typeCheckExportedExam: z.ZodType<ExportedExam> = exportedExamSchema;
const _typeCheckGoogleSession: z.ZodType<GoogleSession> = googleSessionSchema;
const _typeCheckCloudSettings: z.ZodType<CloudSettings> = cloudSettingsSchema;
paperIndexEntrySchema satisfies z.ZodType<PaperIndexEntry>;
savedPaperSchema satisfies z.ZodType<SavedPaper>;
timerPhaseSchema satisfies z.ZodType<TimerPhase>;