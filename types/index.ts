export type Letter = 0 | 1 | 2 | 3;
export type Opts = [string, string, string, string];
export type OptionPermutation = [Letter, Letter, Letter, Letter];

export interface Question {
  id: string;
  text: string;
  options: Opts;
  answer: Letter;
  marks?: number;
  groupStem?: string;
  label?: string;
}
export type ProjectedQuestion = Omit<Question, 'answer'>;
export interface ParsedQuestion extends Question {
  rawIndex: number;
  line: number;
}

export interface PaperPart {
  label: string;
  text: string;
  marks?: number;
}
export interface PaperQuestion {
  number: number;
  text: string;
  marks?: number;
  parts: PaperPart[];
}

export interface ExamMeta {
  program: string;
  semester: string;
  subject: string;
  subjectCode: string;
  subjectFullName: string;
  subjectMode: string;
  examName: string;
  quizNumber: number;
  date: string;
  dateManuallySet: boolean;
}

export interface ExamConfig {
  numSets: number;
  questionsPerSet: number;
  setStrategy: 'reorderAll' | 'sample';
  shuffleOptions: boolean;
  seed: string;
  mcqTimingMode: 'perQuestion' | 'total';
  slideDuration: number;
  totalMcqMinutes: number;
  examMode: 'mcq' | 'combined';
  paperDurationMinutes: number;
  allowPaperPause: boolean;
  questionsPerSlide: number;
}

export interface DisplayPrefs {
  fontScale: number;
  theme: 'chalkboard' | 'light';
  soundEnabled: boolean;
}

export type Screen =
  | 'meta'
  | 'setup'
  | 'review'
  | 'calibrate'
  | 'exam'
  | 'paperIntro'
  | 'paper'
  | 'end';

export interface ExamSet {
  letter: string;
  questionIds: string[];
  optionOrder?: OptionPermutation[];
}

export interface ExamDefinition {
  id: string;
  createdAt: number;
  meta: ExamMeta;
  config: ExamConfig;
  pool: Question[];
  sets: ExamSet[];
  sectionB: PaperQuestion[];
  sectionC: PaperQuestion[];
}

export interface PauseEntry {
  at: number;
  resumedAt?: number;
  reason: 'manual' | 'recovery' | 'suspended';
}

export interface DeadlineTimer {
  endsAt: number | null;
  remainingMs: number;
  totalMs: number;
  paused: boolean;
  pausedLog: PauseEntry[];
  extraMs: number;
}

export interface Progress {
  activeSetIndex: number;
  completedSetIndexes: number[];
  slideIndex: number;
  slideTimer: DeadlineTimer;
  paperTimer?: DeadlineTimer;
}

export interface DraftInput {
  meta: ExamMeta;
  config: ExamConfig;
  rawMcq: string;
  rawB: string;
  rawC: string;
  rawUnified: string;
}

export interface PersistedState {
  savedAt: number;
  screen: Screen;
  draft: DraftInput;
  exam: ExamDefinition | null;
  progress: Progress | null;
}

export interface Issue {
  line: number;
  severity: 'error' | 'warning';
  code: IssueCode;
  message: string;
}

export type IssueCode =
  | 'PARSE_OPTION_COUNT'
  | 'PARSE_MISSING_ANSWER'
  | 'PARSE_EMPTY_STEM'
  | 'PARSE_FIFTH_OPTION'
  | 'PARSE_DUPLICATE_STEM'
  | 'PARSE_DUPLICATE_OPTION'
  | 'PARSE_LONG_STEM'
  | 'PARSE_LONG_OPTION'
  | 'PARSE_ANSWER_SKEW'
  | 'PARSE_TRAILING_TEXT'
  | 'PARSE_MARKS_MISMATCH'
  | 'UNIFIED_MISSING_SECTION'
  | 'UNIFIED_MARKS_MISMATCH'
  | 'UNIFIED_TOTAL_MISMATCH'
  | 'UNIFIED_UNKNOWN_KEY';

export interface ExportedExam {
  format: 'mcq-projector-exam';
  schemaVersion: 1;
  exportedAt: number;
  draft: DraftInput;
}

export interface GoogleSession {
  accessToken: string;
  expiresAt: number;
  email: string;
}

export interface CloudSettings {
  meta: ExamMeta;
  config: ExamConfig;
  displayPrefs: DisplayPrefs;
}

export interface PaperIndexEntry {
  id: string;
  name: string;
  driveFileId: string;
  remoteModifiedTime: string;
}

export interface SavedPaper {
  draft: DraftInput;
  createdAt: number;
  schema: 1;
}

export interface TimerPhase {
  phase: 'normal' | 'warning' | 'danger' | 'critical';
  isPulse: boolean;
}