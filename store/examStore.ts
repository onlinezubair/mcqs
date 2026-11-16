import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PersistedState, Screen, ExamDefinition, Progress, DraftInput, ExamMeta, ExamConfig, DisplayPrefs, ExamSet, DeadlineTimer, PauseEntry, Question, PaperQuestion } from '@/types';
import { todayLocalISO } from '@/lib/meta';
import { buildSets } from '@/lib/shuffle';
import { generateSeed } from '@/lib/rng';
import { resolveMcqTiming } from '@/lib/timing';
import { deadlineTimerStart, deadlineTimerPause, deadlineTimerResume, deadlineTimerExtend, deadlineTimerRemaining } from '@/lib/deadlineTimer';
import { uuidv4 } from '@/lib/uuid';
import { getLockstepCount, getSlideCount } from '@/lib/lockstep';
import { sanitizeExamConfig, sanitizeExamMeta } from '@/lib/validate';
import { isFirebaseConfigured } from '@/lib/firebase';
import { signInWithGoogle, signOut as signOutAuth, subscribeToAuth } from '@/lib/auth';
import { getAdapter } from '@/lib/persistence';

const STORAGE_VERSION = 1;
const STORAGE_KEY = 'mcq-projector-storage';
const PREFS_KEY = 'mcqProjector_prefs';
const HEARTBEAT_KEY = 'mcqProjector_hb';

const initialDraft: DraftInput = {
  meta: {
    program: '',
    semester: '',
    subject: '',
    subjectCode: '',
    subjectFullName: '',
    subjectMode: 'Theory',
    examName: 'Quiz',
    quizNumber: 1,
    date: todayLocalISO(),
    dateManuallySet: false,
  },
  config: {
    numSets: 4,
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
  },
  rawMcq: '',
  rawB: '',
  rawC: '',
  rawUnified: '',
};

const initialPrefs: DisplayPrefs = {
  fontScale: 1,
  theme: 'chalkboard',
  soundEnabled: true,
};

const initialProgress: Progress = {
  activeSetIndex: 0,
  completedSetIndexes: [],
  slideIndex: 0,
  slideTimer: {
    endsAt: null,
    remainingMs: 0,
    totalMs: 0,
    paused: true,
    pausedLog: [],
    extraMs: 0,
  },
};

export type ExamStoreState = PersistedState & {
  prefs: DisplayPrefs;
  config: ExamConfig;
  showShortcuts: boolean;
  blankScreen: boolean;
  // Cloud/sync state (never persisted — derived at runtime).
  cloudUser: import('@/lib/auth').AuthUser | null;
  cloudStatus: 'signed-out' | 'idle' | 'syncing' | 'error';
  cloudError: string | null;
  cloudPapers: import('@/types').CloudPaperMeta[];
  cloudConfigured: boolean;
};

function createInitialState(): PersistedState & { prefs: DisplayPrefs; config: ExamConfig; showShortcuts: boolean; blankScreen: boolean; cloudUser: import('@/lib/auth').AuthUser | null; cloudStatus: 'signed-out' | 'idle' | 'syncing' | 'error'; cloudError: string | null; cloudPapers: import('@/types').CloudPaperMeta[]; cloudConfigured: boolean } {
  return {
    savedAt: Date.now(),
    // Exam metadata is optional for a one-off projector run, so the app opens
    // straight on Setup. The Meta screen is reachable via "Exam details".
    screen: 'setup',
    draft: initialDraft,
    exam: null,
    progress: null,
    prefs: initialPrefs,
    config: initialDraft.config,
    showShortcuts: false,
    blankScreen: false,
    cloudUser: null,
    cloudStatus: 'signed-out',
    cloudError: null,
    cloudPapers: [],
    cloudConfigured: false,
  };
}

type NavigationSlice = {
  transition: (to: Screen) => void;
  finishExam: () => void;
  runAnotherSet: () => void;
  setShowShortcuts: (show: boolean) => void;
  toggleBlank: () => void;
};

type DraftSlice = {
  setMeta: (meta: Partial<ExamMeta>) => void;
  setConfig: (config: Partial<ExamConfig>) => void;
  setRawInput: (field: keyof DraftInput, value: string) => void;
  parseDraft: () => { questions: Question[]; issues: import('@/types').Issue[] };
};

type ExamSlice = {
  lockExam: (questions: Question[], paper?: { sectionB?: PaperQuestion[]; sectionC?: PaperQuestion[] }) => ExamDefinition;
  unlockToSetup: () => void;
  selectActiveSet: (index: number) => void;
  /**
   * Apply settings recovered from a saved exam/seed. Only touches the
   * shuffle-relevant fields so a teacher restoring a seed never has to
   * remember the set count or strategy.
   */
  applyRestoredSeed: (restore: {
    seed: string;
    numSets?: number;
    setStrategy?: ExamConfig['setStrategy'];
    shuffleOptions?: boolean;
  }) => void;
  /** Restore a fully locked exam snapshot (pool + sets + option order). */
  restoreLockedExam: (exam: ExamDefinition) => void;
};

type ProgressSlice = {
  startSlide: (setIndex: number, slideIndex: number) => void;
  nextSlide: () => void;
  prevSlide: () => void;
  jumpToSlide: (slideIndex: number) => void;
  pauseResume: () => void;
  addTime: (ms: number) => void;
  adjustPerSlide: (delta: number) => void;
  startPaper: () => void;
  pausePaper: () => void;
  extendPaper: (minutes: number) => void;
};

type PrefsSlice = {
  setFontScale: (scale: number) => void;
  setTheme: (theme: DisplayPrefs['theme']) => void;
  setSound: (enabled: boolean) => void;
};

type PersistenceSlice = {
  hydrate: () => void;
  rehydrate: () => void;
  clearAutosave: () => void;
  resetStore: () => void;
  writeHeartbeat: () => void;
};

type CloudSlice = {
  initCloud: () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  syncSettings: () => Promise<void>;
  savePaper: (name?: string) => Promise<void>;
  loadPaper: (id: string) => Promise<void>;
  deletePaper: (id: string) => Promise<void>;
  refreshPaperList: () => Promise<void>;
};

export type ExamStore = ExamStoreState &
  NavigationSlice &
  DraftSlice &
  ExamSlice &
  ProgressSlice &
  PrefsSlice &
  PersistenceSlice &
  CloudSlice;

const storage = {
  getItem: async (name: string): Promise<string | null> => {
    if (typeof window === 'undefined') return null;
    try {
      const item = localStorage.getItem(name);
      return item;
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(name, value);
    } catch {
      // quota exceeded, could fallback to IndexedDB
    }
  },
  removeItem: async (name: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};

const store = create<ExamStore>()(
  persist(
    (set, get) => ({
      ...createInitialState(),

      transition: (to: Screen) => {
        const { screen, exam, progress } = get();
        const legal: Record<Screen, Screen[]> = {
          meta: ['setup'],
          setup: ['review', 'meta'],
          review: ['setup', 'calibrate'],
          calibrate: ['review', 'exam'],
          exam: ['end', 'paperIntro'],
          paperIntro: ['paper', 'end'],
          paper: ['end', 'paperIntro'],
          end: ['calibrate', 'meta'],
        };

        if (!legal[screen]?.includes(to)) {
          console.warn(`Illegal transition ${screen} -> ${to}`);
          return;
        }

        if (to === 'setup' && screen === 'review') {
          get().unlockToSetup();
        }

        if (to === 'calibrate' && screen === 'end') {
          set({ screen: 'calibrate' });
          return;
        }

        if (to === 'meta' && screen === 'end') {
          get().resetStore();
          return;
        }

if (to === 'exam' && screen === 'calibrate') {
          const examDef = get().exam;
          if (!examDef) return;

          // All sets run together, so the timer spans the longest set.
          const positionCount = getLockstepCount(examDef);
          if (positionCount === 0) return;

          const questionsPerSlide = examDef.config.questionsPerSlide ?? 4;
          const slideCount = getSlideCount(examDef, questionsPerSlide);
          if (slideCount === 0) return;

          const durations = resolveMcqTiming(examDef.config, positionCount).durationsSeconds;

          const slideTimer = deadlineTimerStart((durations[0] ?? 60) * 1000, 0, []);
          set({
            progress: {
              ...initialProgress,
              activeSetIndex: 0,
              slideIndex: 0,
              slideTimer,
            },
            screen: 'exam',
          });
          return;
        }

        if (to === 'paperIntro' && screen === 'exam') {
          const examDef = get().exam;
          if (!examDef) return;
          const paperTimer = {
            endsAt: null,
            remainingMs: examDef.config.paperDurationMinutes * 60 * 1000,
            totalMs: examDef.config.paperDurationMinutes * 60 * 1000,
            paused: true,
            pausedLog: [] as PauseEntry[],
            extraMs: 0,
          };
          set({
            progress: { ...get().progress!, paperTimer },
            screen: 'paperIntro',
          });
          return;
        }

        if (to === 'paperIntro' && screen === 'paper') {
          // Returning from the live paper pauses its clock and keeps the
          // remaining time, so the intro screen can show and resume it.
          const progress = get().progress;
          if (!progress?.paperTimer) return;
          set({
            screen: 'paperIntro',
            progress: { ...progress, paperTimer: deadlineTimerPause(progress.paperTimer) },
          });
          return;
        }

        set({ screen: to });
      },

      finishExam: () => {
        const { screen, progress, exam } = get();
        if (screen === 'exam') {
          // Every set ran together, so finishing the position sequence
          // completes them all at once.
          const allSets = exam ? exam.sets.map((_, i) => i) : [];
          const pausedSlide = progress
            ? { ...progress, completedSetIndexes: allSets, slideTimer: { ...progress.slideTimer, paused: true } }
            : progress;

          const isCombined = exam?.config.examMode === 'combined' && (exam.sectionB.length > 0 || exam.sectionC.length > 0);
          if (isCombined && pausedSlide) {
            const paperTimer = pausedSlide.paperTimer ?? {
              endsAt: null,
              remainingMs: (exam?.config.paperDurationMinutes ?? 0) * 60 * 1000,
              totalMs: (exam?.config.paperDurationMinutes ?? 0) * 60 * 1000,
              paused: true,
              pausedLog: [] as PauseEntry[],
              extraMs: 0,
            };
            set({
              screen: 'paperIntro',
              progress: { ...pausedSlide, paperTimer: { ...paperTimer, paused: true } },
            });
            return;
          }

          set({ screen: 'end', progress: pausedSlide ?? progress });
        } else if (screen === 'paper' || screen === 'paperIntro') {
          const nextProgress = progress && progress.paperTimer
            ? { ...progress, paperTimer: { ...progress.paperTimer, paused: true } }
            : progress;
          set({ screen: 'end', progress: nextProgress });
        }
      },

runAnotherSet: () => {
        const { exam } = get();
        if (!exam) return;
        // All sets are projected together, so a fresh run restarts the whole
        // position sequence from question 1.
        set({
          screen: 'calibrate',
          progress: { ...initialProgress },
        });
      },

      setShowShortcuts: (show: boolean) => set({ showShortcuts: show }),
      toggleBlank: () => set(state => ({ blankScreen: !state.blankScreen })),

      setMeta: (meta) => set(state => ({ draft: { ...state.draft, meta: { ...state.draft.meta, ...meta } } })),
      setConfig: (configUpdate) => set(state => ({
        config: { ...state.config, ...configUpdate },
        draft: { ...state.draft, config: { ...state.draft.config, ...configUpdate } },
      })),
      setRawInput: (field, value) => set(state => ({ draft: { ...state.draft, [field]: value } })),

      parseDraft: () => {
        return { questions: [], issues: [] };
      },

      lockExam: (questions, paper) => {
        const { draft } = get();
        const id = uuidv4();
        const createdAt = Date.now();
        // Guarantee a concrete seed is captured at lock time: the shuffle can
        // never be reproduced if the teacher left Advanced's Seed blank.
        const lockedConfig: ExamConfig = {
          ...draft.config,
          seed: draft.config.seed.trim() || generateSeed(),
        };
        const sets = buildSets(questions, lockedConfig);

        const examDef: ExamDefinition = {
          id,
          createdAt,
          meta: draft.meta,
          config: lockedConfig,
          pool: questions,
          sets,
          sectionB: paper?.sectionB ?? [],
          sectionC: paper?.sectionC ?? [],
        };

        const paperTimer = lockedConfig.examMode === 'combined'
          ? {
              endsAt: null,
              remainingMs: lockedConfig.paperDurationMinutes * 60 * 1000,
              totalMs: lockedConfig.paperDurationMinutes * 60 * 1000,
              paused: true,
              pausedLog: [] as PauseEntry[],
              extraMs: 0,
            }
          : undefined;

        set({
          exam: examDef,
          config: lockedConfig,
          draft: { ...draft, config: lockedConfig },
          progress: {
            ...initialProgress,
            activeSetIndex: 0,
            ...(paperTimer ? { paperTimer } : {}),
          },
        });
        return examDef;
      },

      unlockToSetup: () => set({ exam: null, progress: null }),

      applyRestoredSeed: ({ seed, numSets, setStrategy, shuffleOptions }) => {
        set(state => {
          const nextConfig: ExamConfig = {
            ...state.config,
            seed,
            ...(typeof numSets === 'number' ? { numSets } : {}),
            ...(setStrategy ? { setStrategy } : {}),
            ...(typeof shuffleOptions === 'boolean' ? { shuffleOptions } : {}),
          };
          return {
            config: nextConfig,
            draft: { ...state.draft, config: { ...state.draft.config, ...nextConfig } },
          };
        });
      },

      restoreLockedExam: (examDef: ExamDefinition) => {
        set(state => ({
          exam: examDef,
          config: examDef.config,
          draft: {
            ...state.draft,
            meta: examDef.meta,
            config: examDef.config,
          },
          progress: { ...initialProgress },
        }));
      },

selectActiveSet: (index) => set(state => ({
        progress: state.progress ? { ...state.progress, activeSetIndex: index } : { ...initialProgress, activeSetIndex: index },
      })),

      startSlide: (_setIndex, slideIndex) => {
        const { exam, progress } = get();
        if (!exam || !progress) return;

        // Questions are projected for every set at once, so a "slide" is a
        // position across the whole exam rather than a point in one set.
        const slideCount = getSlideCount(exam, exam.config.questionsPerSlide ?? 4);
        if (slideIndex < 0 || slideIndex >= slideCount) return;

        const durations = resolveMcqTiming(exam.config, getLockstepCount(exam)).durationsSeconds;

        const slideTimer = deadlineTimerStart((durations[slideIndex] ?? 60) * 1000, 0, []);
        set({ progress: { ...progress, activeSetIndex: 0, slideIndex, slideTimer } });
      },

      nextSlide: () => {
        const { exam, progress } = get();
        if (!exam || !progress) return;
        const slideCount = getSlideCount(exam, exam.config.questionsPerSlide ?? 4);
        const nextIndex = progress.slideIndex + 1;
        if (nextIndex >= slideCount) {
          get().finishExam();
          return;
        }
        get().startSlide(0, nextIndex);
      },

      prevSlide: () => {
        const { progress } = get();
        if (!progress) return;
        const prevIndex = progress.slideIndex - 1;
        if (prevIndex < 0) return;
        get().startSlide(0, prevIndex);
      },

      jumpToSlide: (slideIndex: number) => {
        const { exam, progress } = get();
        if (!exam || !progress) return;
        const slideCount = getSlideCount(exam, exam.config.questionsPerSlide ?? 4);
        if (slideIndex < 0 || slideIndex >= slideCount) return;
        get().startSlide(0, slideIndex);
      },

      pauseResume: () => {
        const { progress } = get();
        if (!progress) return;
        const { slideTimer } = progress;
        if (slideTimer.paused) {
          const resumed = deadlineTimerResume(slideTimer);
          set({ progress: { ...progress, slideTimer: resumed } });
        } else {
          const paused = deadlineTimerPause(slideTimer);
          set({ progress: { ...progress, slideTimer: paused } });
        }
      },

      addTime: (ms: number) => {
        const { progress } = get();
        if (!progress) return;
        const extended = deadlineTimerExtend(progress.slideTimer, ms);
        set({ progress: { ...progress, slideTimer: extended } });
      },

      adjustPerSlide: (delta: number) => {
        const { exam, progress } = get();
        if (!exam || !progress) return;

        const currentPerSlide = exam.config.questionsPerSlide ?? 4;
        const questionsPerSlide = Math.min(6, Math.max(2, currentPerSlide + delta));
        if (questionsPerSlide === currentPerSlide) return;

        // Keep showing (as closely as possible) the same starting question.
        const currentStart = progress.slideIndex * currentPerSlide;
        const slideCount = getSlideCount(exam, questionsPerSlide);
        const newSlideIndex = Math.min(slideCount - 1, Math.floor(currentStart / questionsPerSlide));

        const durations = resolveMcqTiming({ ...exam.config, questionsPerSlide }, getLockstepCount(exam)).durationsSeconds;
        const slideDuration = durations[newSlideIndex] ?? 60;

        set({
          exam: { ...exam, config: { ...exam.config, questionsPerSlide } },
          progress: {
            ...progress,
            slideIndex: newSlideIndex,
            slideTimer: { ...progress.slideTimer, totalMs: slideDuration * 1000, remainingMs: slideDuration * 1000 },
          },
        });
      },

      startPaper: () => {
        const { progress, exam } = get();
        if (!progress || !exam || !progress.paperTimer) return;
        const paperTimer = deadlineTimerStart(progress.paperTimer.remainingMs, 0, []);
        set({ progress: { ...progress, paperTimer } });
        get().transition('paper');
      },

      pausePaper: () => {
        const { progress } = get();
        if (!progress || !progress.paperTimer) return;
        const { paperTimer } = progress;
        if (paperTimer.paused) {
          const resumed = deadlineTimerResume(paperTimer);
          set({ progress: { ...progress, paperTimer: resumed } });
        } else {
          const paused = deadlineTimerPause(paperTimer);
          set({ progress: { ...progress, paperTimer: paused } });
        }
      },

      extendPaper: (minutes: number) => {
        const { progress } = get();
        if (!progress || !progress.paperTimer) return;
        const extended = deadlineTimerExtend(progress.paperTimer, minutes * 60 * 1000);
        set({ progress: { ...progress, paperTimer: extended } });
      },

      setFontScale: (scale) => set(state => ({ prefs: { ...state.prefs, fontScale: scale } })),
      setTheme: (theme) => set(state => ({ prefs: { ...state.prefs, theme } })),
      setSound: (soundEnabled) => set(state => ({ prefs: { ...state.prefs, soundEnabled } })),

      hydrate: () => {
        get().rehydrate();
        const prefs = localStorage.getItem(PREFS_KEY);
        if (prefs) {
          try {
            const parsed = JSON.parse(prefs);
            set(state => ({ prefs: { ...state.prefs, ...parsed } }));
          } catch {
            // ignore
          }
        }
      },

      rehydrate: () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return;
        try {
          const parsed = JSON.parse(stored);
          const data = parsed?.state ?? parsed;
          const screen = data?.screen;
          const draft = data?.draft;
          const exam = data?.exam ?? null;
          let progress = data?.progress ?? null;
          const savedAt = data?.savedAt;

          if (!screen || !draft) return;

          if (screen === 'exam' || screen === 'paperIntro' || screen === 'paper') {
            if (progress?.slideTimer) {
              const now = Date.now();
              const remaining = deadlineTimerRemaining(progress.slideTimer, now);
              progress = {
                ...progress,
                slideTimer: { ...progress.slideTimer, remainingMs: remaining, paused: true },
                paperTimer: progress.paperTimer
                  ? { ...progress.paperTimer, remainingMs: deadlineTimerRemaining(progress.paperTimer, now), paused: true }
                  : progress.paperTimer,
              };
            }
          }

          const sanitizedConfig = sanitizeExamConfig(draft?.config, initialDraft.config);
          const sanitizedMeta = sanitizeExamMeta(draft?.meta, initialDraft.meta);

          set({
            screen,
            draft: { ...draft, meta: sanitizedMeta, config: sanitizedConfig },
            exam,
            progress,
            savedAt: savedAt ?? Date.now(),
            config: sanitizedConfig,
          });
        } catch {
          // invalid persisted payload; leave state untouched
        }
      },

      clearAutosave: () => {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(HEARTBEAT_KEY);
      },

      resetStore: () => {
        get().clearAutosave();
        set(createInitialState());
      },

      writeHeartbeat: () => {
        const { screen } = get();
        if (screen === 'exam' || screen === 'paperIntro' || screen === 'paper') {
          const tabId = Math.random().toString(36).substring(2, 10);
          localStorage.setItem(HEARTBEAT_KEY, JSON.stringify({ tabId, at: Date.now() }));
        }
      },

      initCloud: () => {
        if (typeof window === 'undefined') return;
        const configured = isFirebaseConfigured();
        set({ cloudConfigured: configured });
        if (!configured) return;
        subscribeToAuth(user => {
          set({
            cloudUser: user,
            cloudStatus: user ? 'idle' : 'signed-out',
            cloudError: null,
          });
          if (user) void get().refreshPaperList();
        });
      },

      signIn: async () => {
        set({ cloudStatus: 'syncing', cloudError: null });
        const result = await signInWithGoogle();
        if (result.ok) {
          set({ cloudUser: result.user, cloudStatus: 'idle', cloudError: null });
          await get().refreshPaperList();
        } else {
          set({ cloudStatus: 'error', cloudError: result.message, cloudConfigured: isFirebaseConfigured() });
        }
      },

      signOut: async () => {
        await signOutAuth();
        set({ cloudUser: null, cloudStatus: 'signed-out', cloudError: null, cloudPapers: [] });
      },

      syncSettings: async () => {
        const { cloudUser } = get();
        if (!cloudUser) return;
        set({ cloudStatus: 'syncing', cloudError: null });
        try {
          const { draft } = get();
          const adapter = getAdapter(cloudUser.uid);
          await adapter.saveSettings({ meta: draft.meta, config: draft.config, updatedAt: Date.now() });
          set({ cloudStatus: 'idle' });
        } catch (error) {
          set({ cloudStatus: 'error', cloudError: (error as Error).message || 'Could not sync settings.' });
        }
      },

      savePaper: async (name?: string) => {
        const { cloudUser, draft, exam } = get();
        if (!cloudUser) {
          throw new Error('Sign in to save papers to the cloud.');
        }
        set({ cloudStatus: 'syncing', cloudError: null });
        try {
          const adapter = getAdapter(cloudUser.uid);
          const payload = {
            draft: name ? { ...draft, meta: { ...draft.meta, examName: name } } : draft,
            sectionB: exam?.sectionB ?? [],
            sectionC: exam?.sectionC ?? [],
            seed: exam?.config.seed ?? draft.config.seed,
          };
          await adapter.savePaper(payload);
          await get().refreshPaperList();
          set({ cloudStatus: 'idle' });
        } catch (error) {
          set({ cloudStatus: 'error', cloudError: (error as Error).message || 'Could not save paper.' });
          throw error;
        }
      },

      loadPaper: async (id: string) => {
        const { cloudUser } = get();
        if (!cloudUser) return;
        set({ cloudStatus: 'syncing', cloudError: null });
        try {
          const adapter = getAdapter(cloudUser.uid);
          const payload = await adapter.loadPaper(id);
          if (!payload) {
            set({ cloudStatus: 'error', cloudError: 'That paper could not be found.' });
            return;
          }
          set({
            draft: payload.draft,
            config: payload.draft.config,
            screen: 'setup',
            cloudStatus: 'idle',
          });
        } catch (error) {
          set({ cloudStatus: 'error', cloudError: (error as Error).message || 'Could not load paper.' });
        }
      },

      deletePaper: async (id: string) => {
        const { cloudUser } = get();
        if (!cloudUser) return;
        try {
          const adapter = getAdapter(cloudUser.uid);
          await adapter.deletePaper(id);
          await get().refreshPaperList();
        } catch (error) {
          set({ cloudStatus: 'error', cloudError: (error as Error).message || 'Could not delete paper.' });
        }
      },

      refreshPaperList: async () => {
        const { cloudUser } = get();
        if (!cloudUser) return;
        try {
          const adapter = getAdapter(cloudUser.uid);
          const papers = await adapter.listPapers();
          set({ cloudPapers: papers });
        } catch {
          // Listing is best-effort; keep whatever we had.
        }
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        savedAt: state.savedAt,
        screen: state.screen,
        draft: state.draft,
        exam: state.exam,
        progress: state.progress,
      }),
      version: STORAGE_VERSION,
      skipHydration: true,
      merge: (persisted, current) => {
        const incoming = (persisted ?? {}) as Partial<PersistedState>;
        const draft = incoming.draft
          ? {
              ...incoming.draft,
              meta: sanitizeExamMeta(incoming.draft.meta, initialDraft.meta),
              config: sanitizeExamConfig(incoming.draft.config, initialDraft.config),
            }
          : current.draft;
        return {
          ...current,
          ...incoming,
          draft,
          config: sanitizeExamConfig(draft.config, initialDraft.config),
        };
      },
    }
  )
);

export const useExamStore = store;
export const { transition, finishExam } = store.getState();
