# MCQ Projector — Specification v3

**Status:** Build-ready plan. Nothing is implemented yet; all test counts are targets.
**Supersedes:** Specification v2. See §22 for what changed and why.

---

## 1. Product Overview

**MCQ Projector** is a static-export Next.js (React 19, TypeScript strict) app for running timed multiple-choice exams from a shared projector display.

- **MCQ mode (default):** one set projected at a time, per-question or total-time budgeting, auto-advance, end-screen export.
- **Combined mode (opt-in):** Section A (MCQ) → hand-out interstitial → Sections B + C on one deadline-driven paper screen. B and C are fixed-order and identical for everyone.
- **Local-first:** all data in `localStorage` / `IndexedDB`; no backend. Works offline once loaded.
- **Optional Google Drive backup:** `drive.file` scope, Google Identity Services, no server.
- **Projector-first UX:** high contrast, large type, keyboard- and clicker-driven, minimal chrome, screen never sleeps.

**Primary user:** one teacher/invigilator at one laptop with one projector.

**Non-goals (v1):** student devices, realtime sync, auto-grading of B/C, user accounts.

**Success criteria (summary; full list in §19):**
1. An exam can be built from one pasted AI-formatted text in under 2 minutes.
2. A refresh, crash, or lid-close mid-exam never loses state and never silently skips questions.
3. The correct answer is never rendered on any projected screen.
4. The core exam works fully offline and with no Google account.

---

## 2. Key Decisions & Assumptions

These resolve ambiguities found in v2. Each has a default so the build is never blocked; change the default here, before Milestone 0, if you disagree.

| # | Decision | Default |
|---|---|---|
| D1 | **Multi-set run model.** Several sets exist (A, B, C…) but the projector shows one at a time. | Teacher picks the active set on Calibrate. In `mcq` mode the End screen offers **Run another set** (back to Calibrate; finished sets are marked). In `combined` mode, Section A runs once per set and B + C run once, after the last set the teacher chooses to run. |
| D2 | **Persisted schema version.** v2 required a `v3 → v4` migrator, but no earlier build exists. | If no earlier build was ever deployed: start at `version: 1`, **no migrator**. If one was: keep `version: 4` and ship the migrator. Decide at M0. |
| D3 | **Pause during Section B/C.** | Allowed (`allowPaperPause: true`), logged, and shown on the End screen. Teacher can disable it per exam for strict timing. |
| D4 | **Outage credit on crash recovery.** | Time lost while the app was not running is **credited** to students (restored to the remaining time at the last heartbeat). The teacher can switch to "real clock" in `ResumeDialog`. |
| D5 | **Hosting.** Next static export does **not** work from `file://`. | Deploy to any static host (GitHub Pages, Netlify, school server) or run `npx serve out` locally. After the first load the PWA makes it work offline. |
| D6 | **UI language.** | English UI; exam *content* may be any language incl. RTL. All UI strings live in `lib/strings.ts` so translation is possible later. |

---

## 3. Tech Stack & Conventions

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, `output: 'export'`). Pin the exact version at scaffold time. Node ≥ 20.9 (`engines` + `.node-version`; also `.nvmrc` for nvm users) |
| Language | TypeScript 5.x `strict` + `noUncheckedIndexedAccess`, React 19 |
| State | Zustand v5, slices pattern in one store, `persist` middleware with a custom async storage |
| Validation | Zod, for every untrusted payload: imported JSON, rehydrated state, Drive files |
| Styling | CSS Modules + CSS custom properties |
| ZIP | `fflate` |
| Tests | Vitest + jsdom + RTL, `fast-check` (property tests), Playwright + `@axe-core/playwright`, `@vitest/coverage-v8` |
| Quality | ESLint flat config, Prettier, `tsc --noEmit`; `npm run verify` = typecheck + lint + test + build |
| Build | `npm run build` → static `out/` |

**Conventions**
- Colocate `Component/Component.tsx`, `.module.css`, `.test.tsx`.
- `lib/` is pure logic (no React; no DOM except `storage`, `cloud`, `clockGuard`). `hooks/` holds reusable hooks. `types/index.ts` is the single source of truth for types; `lib/schemas.ts` holds Zod validators checked against those types at compile time (`satisfies`).
- Every `lib/` module is pure and unit-tested before any UI uses it.
- No comments unless requested; self-documenting names.
- `fmtHms(sec) → "H:MM:SS"` (unpadded hours).
- Never use `dangerouslySetInnerHTML`. All exported HTML goes through one `escapeHtml()` helper.
- Next config: `images.unoptimized`, `trailingSlash: true`, optional `basePath` from `NEXT_PUBLIC_BASE_PATH`.
- **Cross-platform tooling:** the primary dev machine is Windows. Use no POSIX-only shell commands in `package.json` scripts (use Node scripts, `rimraf`, `cross-env`). Add `.gitattributes` (`* text=auto eol=lf`) and Prettier `endOfLine: "lf"`.
- Fonts: use `next/font/local` with committed font files (no build-time network dependency; nothing loads from a network at exam time).

---

## 4. Screen State Machine

Canonical flow:

```
meta → setup → review → calibrate → exam ─┬─(mcq)──────────────→ end
                                          └─(combined)→ paperIntro → paper → end
end ──(mcq, more sets remain: "Run another set")──→ calibrate
```

| From | To | Guard / behaviour |
|---|---|---|
| meta | setup | `subject` and `examName` non-empty; `quizNumber` ≥ 0 |
| setup | review | Parse has zero errors; limits valid; combined: B and C each ≥ 1 question and `paperDurationMinutes` > 0. Performs `lockExam()`: builds sets and creates the frozen `ExamDefinition` |
| review | setup | Always, after confirm ("Editing rebuilds the sets"). Performs `unlockToSetup()` and discards `exam` |
| review | calibrate | Teacher approves the review |
| calibrate | review | Always (non-destructive) |
| calibrate | exam | Active set chosen; overflow audit has run (warnings do not block) |
| exam | end | Last question finished (mcq) or teacher ends (confirm) |
| exam | paperIntro | Last question finished (combined) |
| paperIntro | paper | Teacher presses **Start Section B & C**. The timer starts here, never automatically |
| paperIntro / paper | end | Deadline reached, or teacher ends (confirm) |
| end | calibrate | mcq mode only, and at least one set not yet run |
| end | meta | `resetStore()` after confirm |

`transition(to)` enforces this table and rejects illegal moves. There is no public `setScreen`.

**Draft vs frozen definition.** `draft` is editable during `meta`/`setup`. `exam` is an immutable `ExamDefinition` created at `setup → review`. Nothing after `review` mutates `exam`. Display preferences (font scale, theme, sound) are **not** part of `exam`; they live in their own persisted store so Calibrate can change them without breaking immutability.

---

## 5. Data Models (`types/index.ts`)

```ts
export type Letter = 0 | 1 | 2 | 3;
export type Opts = [string, string, string, string];
export type OptionPermutation = [Letter, Letter, Letter, Letter];   // shown position -> original index

export interface Question {
  id: string; text: string; options: Opts; answer: Letter;
  marks?: number;            // decimals allowed, default 1
  groupStem?: string;        // shared stem of an i./ii. MCQ group
  label?: string;            // e.g. "Q1 (i)"
}
export type ProjectedQuestion = Omit<Question, 'answer'>;           // the only shape slides may receive
export interface ParsedQuestion extends Question { rawIndex: number; line: number; }

export interface PaperPart { label: string; text: string; marks?: number; }
export interface PaperQuestion { number: number; text: string; marks?: number; parts: PaperPart[]; }

export interface ExamMeta {
  program: string; semester: string; subject: string; subjectCode: string;
  subjectFullName: string; subjectMode: string; examName: string; quizNumber: number;
  date: string; dateManuallySet: boolean;
}

export interface ExamConfig {                       // frozen into ExamDefinition
  numSets: number;                                  // 1-26
  questionsPerSet: number;                          // <= pool size; ignored by 'reorderAll'
  setStrategy: 'reorderAll' | 'sample';
  shuffleOptions: boolean;
  seed: string;                                     // random 8 chars at creation; editable in Advanced
  mcqTimingMode: 'perQuestion' | 'total';
  slideDuration: number;                            // seconds, perQuestion mode
  totalMcqMinutes: number;                          // total mode; ignored in perQuestion
  examMode: 'mcq' | 'combined';
  paperDurationMinutes: number;
  allowPaperPause: boolean;                         // default true (D3)
}

export interface DisplayPrefs {                     // persisted separately, never frozen
  fontScale: number;                                // 0.8-1.5
  theme: 'chalkboard' | 'light';
  soundEnabled: boolean;
}

export type Screen = 'meta'|'setup'|'review'|'calibrate'|'exam'|'paperIntro'|'paper'|'end';

export interface ExamSet { letter: string; questionIds: string[]; optionOrder?: OptionPermutation[]; } // aligned by index with questionIds

export interface ExamDefinition {                   // immutable after review
  id: string; createdAt: number;
  meta: ExamMeta; config: ExamConfig;
  pool: Question[];
  sets: ExamSet[];
  sectionB: PaperQuestion[]; sectionC: PaperQuestion[];
}

export interface PauseEntry { at: number; resumedAt?: number; reason: 'manual' | 'recovery' | 'suspended'; }

export interface DeadlineTimer {                    // data only; interval handles live in hooks/refs
  endsAt: number | null;                            // epoch ms while running
  remainingMs: number;                              // authoritative while paused
  totalMs: number;                                  // base + extraMs, denominator for phases
  paused: boolean;
  pausedLog: PauseEntry[];
  extraMs: number;
}

export interface Progress {
  activeSetIndex: number; completedSetIndexes: number[];
  questionIndex: number;
  slideTimer: DeadlineTimer; paperTimer?: DeadlineTimer;
}

export interface DraftInput { meta: ExamMeta; config: ExamConfig; rawMcq: string; rawB: string; rawC: string; rawUnified: string; }

export interface PersistedState {                   // version is owned by the persist middleware
  savedAt: number; screen: Screen;
  draft: DraftInput; exam: ExamDefinition | null; progress: Progress | null;
}

export interface Issue { line: number; severity: 'error' | 'warning'; code: IssueCode; message: string; }

export interface ExportedExam { format: 'mcq-projector-exam'; schemaVersion: 1; exportedAt: number; draft: DraftInput; }

export interface GoogleSession { accessToken: string; expiresAt: number; email: string; }   // memory + sessionStorage only
export interface CloudSettings { meta: ExamMeta; config: ExamConfig; displayPrefs: DisplayPrefs; }
export interface PaperIndexEntry { id: string; name: string; driveFileId: string; remoteModifiedTime: string; }
export interface SavedPaper { draft: DraftInput; createdAt: number; schema: 1; }
```

Notes:
- Timer handles are never stored. They are not serialisable and caused invalid typings in earlier drafts.
- `ProjectedQuestion` is enforced at the component boundary: slide components cannot render an answer because they never receive it.
- Cloud conflict detection uses Drive's `modifiedTime`, not client clocks.

---

## 6. State Management (`store/`)

One Zustand store composed from slices under `store/slices/`:

| Slice | Actions |
|---|---|
| `navigationSlice` | `transition`, `finishExam`, `runAnotherSet` |
| `draftSlice` | `setMeta`, `setConfig`, `setRawInput`, `parseDraft` (returns result + issues; never mutates `exam`) |
| `examSlice` | `lockExam`, `unlockToSetup`, `selectActiveSet` |
| `progressSlice` | `startSlide`, `nextQuestion`, `prevQuestion`, `jumpTo`, `pauseResume`, `addTime(ms)`, `startPaper`, `pausePaper`, `extendPaper` |
| `prefsSlice` | `setFontScale`, `setTheme`, `setSound` (own persisted key) |
| `persistenceSlice` | `hydrate`, `clearAutosave`, `resetStore` |
| `cloudSlice` | `signIn`, `signOut`, `syncSettings`, `savePaper`, `loadPaper`, `refreshPaperList` |

**Rules**
- Components subscribe with selectors (`useShallow`). Countdown text lives in small leaf components so a 4 Hz ticker never re-renders a whole screen. The visible text updates only when the displayed second changes.
- Persistence uses `persist` with `partialize`, `skipHydration: true`, and a custom async `StateStorage` (§12). Call `rehydrate()` in `ExamApp`'s `useEffect` to avoid SSR/static-export mismatches. `cloud` state and anything credential-like are excluded from `partialize`.
- `resetStore()` returns every slice to `initialState` (except `prefs`). A unit test iterates all keys to prove it.
- **Tab lock:** see §12.

---

## 7. Core Library (`lib/`)

| Module | Responsibility | Notes |
|---|---|---|
| `rng.ts` | `xmur3(seed)` + `mulberry32` | JS has no seedable `Math.random` |
| `shuffle.ts` | Seeded Fisher–Yates; `buildSets(pool, config)` | Seed = `config.seed + '|' + setLetter`. Remaps `answer` when options shuffle. Deterministic. Details below |
| `timing.ts` | `allocateSeconds(totalSec, n)` | `base = floor(T/n)`; first `T − base·n` questions get +1 s; sum is exactly `T`. Warns when any slide gets < 5 s |
| `deadlineTimer.ts` | Pure: `start`, `pause`, `resume`, `extend`, `remaining(now)`, `chain(prev, nextDurMs)` | Time is always an argument, so tests need no fake clock |
| `clockGuard.ts` | Detects wall-clock jumps and suspended gaps | Compares `Date.now()` deltas against `performance.now()` deltas |
| `parser.ts` | MCQ text → `{ questions, issues }` | §10.1 |
| `examParser.ts` | Unified text → `{ meta, durations, sectionA, sectionB, sectionC, issues }` | §10.2 |
| `paperSections.ts` | B/C text → `PaperQuestion[]` | Parses `i.`/`ii.` parts and marks |
| `time.ts` | `fmtHms`, `fmtClock`, `parseDuration` | |
| `meta.ts` | `todayLocalISO()` | |
| `schemas.ts` / `validate.ts` | Zod validators and safe-parse helpers | Used for import, rehydrate, Drive |
| `storage.ts` | Safe `localStorage` / IndexedDB wrappers | try/catch on every call; quota errors surface as a toast |
| `escape.ts` | `escapeHtml`, `safeFilename`, `csvCell` | See §14 |
| `exporters.ts` | `buildAnswerKeyCsv`, `buildSetHtml`, `buildPaperHtml`, `buildZip` | Includes B/C and a per-set answer-key mapping |
| `aiPrompt.ts` | `buildAiPromptText(mode)` | |
| `demoQuestions.ts` | 12 MCQs + `SAMPLE_COMBINED_TEXT` | |
| `strings.ts` | All UI text | D6 |
| `googleAuthConfig.ts` | Reads `process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Un-prefixed env vars are not exposed to the browser |
| `googleDrive.ts` | Drive v3 wrappers | §9 |
| `timerTheme.ts` | `getTimerPhase(remainingMs, totalMs, kind)` | §11 |

**`buildSets` guarantees**
- `reorderAll`: every set contains the full pool in a different order. `sample`: each set draws `questionsPerSet` from the pool.
- With ≥ 2 sets, orders are best-effort distinct position-by-position (retry up to a fixed bound) so neighbours do not share a question at the same position.
- **Option shuffling never breaks dependent options.** If any option matches `all of the above`, `none of the above`, `both X and Y`, or similar, that option stays pinned in position (or the question's options are not shuffled) and a warning is raised.
- Output includes a per-set answer-letter distribution for the Review screen.

---

## 8. Screens & Components

### 8.1 MetaScreen
Editable `ExamMeta`, date picker (auto-today until manually edited), cloud widget (only if a client ID exists), Continue.

### 8.2 SetupScreen
- **Unified paste box:** paste the whole AI-formatted exam (metadata + A + B + C). The parser fills meta, durations, MCQs, B and C.
- **Advanced:** separate MCQ / B / C textareas as a fallback; `seed` field.
- **Live preview table:** question counts, marks per section, and **issues with line numbers**. Build is disabled while errors exist.
- Mode selector, timing controls, set controls (`numSets`, `questionsPerSet`, `setStrategy`, `shuffleOptions`).
- Combined mode: warns if `Section A time + Section B&C time ≠ Total time`. Parsed durations are shown with an **Apply to settings** toggle (default on).
- **Export / Import exam JSON** (validated with Zod, 2 MB cap) so papers can move between machines without Google.
- AI prompt export, **Load sample**, format accordion.
- Build → `lockExam()` → `review`.

### 8.3 ReviewScreen
Read-only summary of meta, config, sets (expandable), B/C with marks, per-set answer distribution, option-pinning warnings. **Edit** returns to Setup after confirm.

**Answer-key safety:** the answer key is hidden by default behind **Reveal answers**, auto-hides after 30 s, and shows a banner: "Is your display mirrored? Answers are visible on screen." The key is never shown on Calibrate, Exam, or Paper screens.

### 8.4 CalibrateScreen
- Font slider, theme toggle, fullscreen button, **sound test** (this click also unlocks the browser's audio policy).
- Active-set selector (D1).
- **Overflow audit:** every question is rendered off-screen at the current scale and viewport; the screen lists the questions that exceed the slide area after the 85 % step-down. Warnings do not block, but the teacher sees the exact questions to shorten or the scale to lower. Scrolling a timed slide is not an acceptable fallback on a projector.
- Start exam.

### 8.5 SlideshowScreen
- One MCQ card, A–D options, 8 px top progress bar, `ProjectedQuestion` only.
- Keys: `Space`/`→`/`PageDown` next, `←`/`PageUp` prev, `P` pause/resume, `+` add 10 s, `F` fullscreen, `B` blank screen, `?` shortcut overlay. Presentation clickers work through `PageUp`/`PageDown`.
- **Dangerous jumps are guarded:** `Home`, `End`, and `jumpTo` show a confirm. An accidental `End` must not skip the exam.
- Shortcuts are ignored while focus is in an input, textarea, or button handling its own key, and `event.repeat` is ignored.
- Auto-advance on expiry (§11). Wake Lock held for the whole run (§13). Optional tones in the last 5 s and on advance.
- Last MCQ → `end` (mcq) or `paperIntro` (combined).

### 8.6 PaperIntroScreen
"Section A complete. Hand out Section B & C." Shows durations and a live "would end at HH:MM" preview, recomputed each second until **Start**. Students are never charged time while papers are handed out.

### 8.7 PaperScreen
- Two columns (B left, C right) with marks per question and part; section totals in headers.
- **Overflow:** columns step down to 85 % font; beyond that each column scrolls independently (long case studies are read, not flipped through). A **Focus** toggle (`1`/`2`) fills the screen with B or C only.
- Header: `fmtHms(remaining)` and "Ends at HH:MM". Footer: Pause/Resume (if `allowPaperPause`), +5 min, End exam.
- **Pause is real:** it freezes the timer, the deadline moves on resume, and the pause is recorded in `pausedLog` and listed on the End screen.
- Keys: `Space` pause, `E` end (confirm), `1`/`2` focus.
- Survives refresh via `endsAt` (§11, §12).

### 8.8 EndScreen
Summary (counts, time used, pauses, extensions, recovery events). Exports: ZIP (answer keys, per-set HTML, B/C paper HTML), Print, **Answer review mode** (steps through questions revealing the correct option, for class discussion), **Run another set** (D1).

### 8.9 Shared components

| Component | Purpose |
|---|---|
| `ExamApp` | Hydration, tab lock, `useBeforeUnloadGuard`, resume dialog, screen router, focus management on screen change |
| `ResumeDialog` | Cold start with a recoverable run (§12). Opens paused |
| `CloudAuthWidget` | Sign-in/out, sync status |
| `PrintArea` | Print-optimised sets and paper. Student-facing print never contains answers |
| `ConfirmDialog`, `Toast` | Destructive actions and storage errors |
| `Countdown` | Leaf component that owns the ticking selector |

### 8.10 Hooks
`useDeadlineTicker(timer, onExpire)`, `useFullscreen`, `useWakeLock`, `useKeyboardShortcuts`, `useBeforeUnloadGuard`, `useBeep`, `useTabLock`.

---

## 9. Cloud Sync (Google Drive, `drive.file`)

**Flow**
1. "Sign in with Google" → GIS `initTokenClient` → `requestAccessToken({ prompt: 'consent' })` on first use.
2. On callback: validate the token (`tokeninfo`) and Drive access.
3. Create/find the app folder, cache its `folderId`, sync settings.
4. Papers are individual JSON files; the list loads on demand.

**Rules**
- **Token storage:** memory + `sessionStorage` only, never `localStorage`. Persist only the email hint.
- **Expiry:** GIS tokens last about an hour with no refresh token. Five minutes before expiry, or on a 401, request a new one with `prompt: ''` (pass `hint: email`). Silent renewal can be blocked by popup rules, so failure shows **Reconnect** and never blocks anything.
- **No manual-token fallback** in production builds (dev only, behind `NODE_ENV !== 'production'`).
- **Lazy GSI script:** `next/script` `lazyOnload`, only when the widget mounts and `navigator.onLine`.
- **Conflicts:** compare Drive `modifiedTime` against the last synced `remoteModifiedTime`; on mismatch show **Keep mine / Use cloud** instead of overwriting.
- **Validation:** every downloaded file is parsed with Zod before use.
- **Never block the exam:** cloud calls are disabled on `exam`, `paperIntro`, `paper`.
- Privacy note in the UI: papers include answer keys and live in the teacher's own Drive.
- Without a client ID the widget is hidden and the app is fully usable.

```
/MCQ Projector Data/
  settings.json
  papers/<paperId>.json
```

---

## 10. Parsing & Formats

### 10.1 MCQ parser (`parser.ts`)
Accepts, case-insensitively:
- Numbering: `1.`, `1)`, `Q1.`, `Q1:`; trailing `[N mark(s)]`, `(N marks)`, decimals such as `0.5`.
- Options **a–d only**: `a)`, `A)`, `a.`, `(a)`, `A:`; options may wrap to extra lines.
- Answer: `Answer: b`, `Ans: B`, `Correct: C`, `Answer: (c)`.
- Multi-line stems, blank-line tolerance, `\r\n`, Unicode and RTL text.

**Errors (block the build):** option count ≠ 4, a fifth option (`e)`), missing or invalid answer, empty stem.
**Warnings:** duplicate stems, duplicate option text within a question, very long stem/option, answer-distribution skew, trailing text, group marks ≠ sum of sub-part marks (decimal-safe comparison).
Every issue carries a **line number** and a stable `code` (used in tests and future translation).

### 10.2 Unified exam format (`examParser.ts`)

```
=== EXAM METADATA ===
Program: BSc Computer Science
Paper: Midterm
Subject: Data Structures
Total Time: 3 hours
Section A Time: 45 minutes
Section B & C Time: 2 hours 15 minutes

=== SECTION A: MCQs ===
Q1. Select the best option against each statement: [4 mark(s)]
i. Statement one? [1 mark(s)]
a) Opt A
b) Opt B
c) Opt C
d) Opt D
Answer: a

=== SECTION B: DESCRIPTIVE QUESTIONS ===
Q2. Describe... [10 mark(s)]
i. Sub-part... [3 mark(s)]
ii. Sub-part... [7 mark(s)]

=== SECTION C: CASE STUDY ===
Q3. Case... [15 mark(s)]
i. Analyse... [5 mark(s)]
ii. Design... [10 mark(s)]
```

- Section headers matched by `=== SECTION ([ABC])`; order-independent.
- **Metadata mapping:**

| Key (case-insensitive) | Target |
|---|---|
| Program, Semester, Subject, Subject Code, Subject Full Name, Subject Mode | same-named `ExamMeta` fields |
| Paper / Exam | `examName` |
| Quiz Number | `quizNumber` |
| Date | `date` (and `dateManuallySet = true`) |
| Section A Time | `totalMcqMinutes` (sets `mcqTimingMode = 'total'`) |
| Section B & C Time | `paperDurationMinutes` |
| Total Time | consistency check only |

Unknown keys produce a warning, not an error.
- Durations parsed from `N hour(s) M minute(s)`, `2h 15m`, `H:MM`, `90 minutes`, `1.5 hours`.
- **Marks validation:** sub-part marks should sum to the parent mark (warning). Section totals appear in the preview.
- **Group stems:** an `i./ii.` MCQ group under a shared `Q1.` stem is flattened into individual `Question`s with `groupStem` and `label` ("Q1 (i)"), shown on the slide.
- Missing sections are fine in `mcq` mode and required in `combined`.

### 10.3 AI prompt export
- `mcq` → `mcq-projector-section-a.txt`.
- `combined` → one unified file `mcq-projector-exam.txt` in the §10.2 format; three-file output remains an option.
- The prompt includes the metadata block, numbering rules, mark annotations, the a–d option format, and one worked example.

---

## 11. Timer & Phase Logic

All timers are deadline-based:

```
remainingMs = paused ? remainingMs : max(0, endsAt − Date.now())
```

- `setInterval(250 ms)` in `useDeadlineTicker` only triggers re-reads; it never decrements anything, so there is no drift or throttling error.
- **Chained deadlines:** on auto-advance, `nextEndsAt = prevEndsAt + nextDuration`, not `now + duration`. Per-slide rounding never accumulates, and the total run time is exactly what was configured.
- **Manual navigation** (next/prev/jump) sets `endsAt = now + duration(target)`. In `total` mode, time saved by advancing early is not redistributed (documented behaviour).
- **Per-question mode:** `endsAt` is set at each slide start and persisted, so refresh resumes correctly.
- **Total mode:** `allocateSeconds(totalMinutes·60, n)` per question.
- **Paper:** `endsAt` set at **Start** on `paperIntro`; `extend` adds to `endsAt`, `extraMs`, and `totalMs`.
- **Expiry callbacks** fire exactly once (guarded by a ref keyed on slide id).
- **Catch-up rule:** on `visibilitychange` or after a suspended gap, the ticker re-reads immediately. If advancing by schedule would skip **two or more** slides (lid closed, laptop slept, throttled tab), the run **auto-pauses** (`reason: 'suspended'`) and asks the teacher: *Continue at slide N* / *Jump to slide M by schedule* / *Credit the lost time*. Skipped slides never replay sounds or animations.
- **Clock guard:** if `Date.now()` and `performance.now()` deltas disagree by more than 2 s (system clock changed), show a toast and auto-pause.

**Phases** (`getTimerPhase(remainingMs, totalMs, kind)`; percentage **and** absolute floors):

| Phase | Rule |
|---|---|
| `normal` | remaining > 30 % |
| `warning` | 30 % ≥ remaining > 10 % |
| `danger` | ≤ 10 % **or** ≤ 60 s (paper) / ≤ 5 s (slide) |
| `critical` | ≤ 10 s (paper) / ≤ 3 s (slide) |

**Accessibility:** phases are never colour-only; each also changes icon, weight, or pulse (pulse disabled under `prefers-reduced-motion`). Countdown text is `aria-hidden`; a separate visually-hidden `aria-live="polite"` region announces only at 10 min, 5 min, 1 min, and 10 s.

---

## 12. Persistence & Recovery

**Keys**

| Key | Contents |
|---|---|
| `mcqProjector_v<version>` | `PersistedState` via `persist` (version owned by the middleware) |
| `mcqProjector_prefs` | `DisplayPrefs` |
| `mcqProjector_hb` | `{ tabId, at }` heartbeat |

**Autosave**
- Zustand has no built-in debounce. The custom `StateStorage` debounces writes by 500 ms, **flushes immediately on `visibilitychange` (hidden) and `pagehide`**, and is async so large drafts (> 500 KB) can go to IndexedDB with `localStorage` holding a pointer.
- Rehydrated data is validated with Zod; invalid or unknown-version payloads are offered for download, never silently dropped.
- If D2 selects the migrator path, `migrate(v3 → v4)` converts old payloads.

**What restores how**
- Screens `meta`, `setup`, `review`, `calibrate`, `end` restore silently.
- Screens `exam`, `paperIntro`, `paper` show `ResumeDialog`: **Resume (paused)** / **Discard** / **Download backup JSON**, plus "Last active HH:MM:SS (N min ago)".
- **Recovery timing (D4):** a heartbeat is written every 5 s during `exam`/`paperIntro`/`paper`. On resume, `remainingMs = max(0, endsAt − heartbeat.at)`, so the outage is credited to students. A "Use real clock instead" option recomputes from the current time. The run opens **paused** with a `recovery` entry in `pausedLog`.

**Tab lock**
- The heartbeat doubles as a lock. If `hb.tabId ≠ mine` and `now − hb.at < 10 s`, a second window shows "Another window is controlling this exam" with a **Take over** button instead of writing to the autosave.
- `BroadcastChannel('mcq-projector')` gives instant takeover notification; the localStorage heartbeat is the fallback where `BroadcastChannel` is unavailable.

**Portability:** Export / Import exam JSON (§8.2).

---

## 13. Projector, Accessibility & Content

- Layout targets 16:9 at 1280×720 and 1920×1080; sizes use `rem` and `clamp()`; `fontScale` sets the root variable.
- Min body size 28 px at scale 1.0 on `exam`; options never wrap below 24 px: long text steps down to 85 %, and the Calibrate overflow audit flags anything still too long (§8.4).
- WCAG AA contrast in both themes; visible focus ring; every control reachable by keyboard; focus moves to the new screen's heading on transition.
- `dir="auto"` on every stem and option so RTL text (Arabic-script languages such as Arabic, Urdu, Persian; Hebrew) renders correctly. Bundle suitable Arabic-script fonts locally.
- Optional simple code-block rendering (monospace, preserved whitespace). Math via an opt-in KaTeX module (v1.1).
- Cursor auto-hides after 3 s of inactivity on projector screens.
- **Wake Lock:** requires a secure context (HTTPS or localhost). Re-acquire on `visibilitychange`. If unsupported or denied, show a persistent notice to disable OS sleep, and optionally use a fallback keep-awake technique.
- **Sound:** an `AudioContext` created only after a user gesture (Calibrate sound test); no audio before that.

---

## 14. Security & Privacy

- No `dangerouslySetInnerHTML`; exported HTML built only via `escapeHtml()`.
- Pasted text, imported JSON, rehydrated state, and Drive files are all treated as untrusted and Zod-validated.
- **CSV injection:** `csvCell()` prefixes cells beginning with `=`, `+`, `-`, `@`, tab, or CR with `'`, and quotes per RFC 4180. CSV is written with a UTF-8 BOM so Excel reads non-Latin text correctly.
- **Filenames:** `safeFilename` normalises Unicode, strips path separators and control characters, avoids Windows reserved names (`CON`, `NUL`, …) and trailing dots, and caps length. ZIP entries use the UTF-8 filename flag.
- **Answer exposure:** answer key hidden by default on Review; slides receive `ProjectedQuestion`; student print never includes answers.
- Google token: memory + `sessionStorage` only; minimal scope (`drive.file`).
- Service worker caches same-origin GET only; never caches cloud API responses.
- No analytics, no third-party requests at exam time.

---

## 15. Testing Strategy

| Layer | Tool | Must cover |
|---|---|---|
| Unit | Vitest + fast-check | `rng`; `shuffle` (determinism, answer remap, no duplicates, dependent-option pinning, distinct sets); `timing` (property test: sum = total for all n/T); `deadlineTimer` incl. chained deadlines; `clockGuard`; `parser` + `examParser` (fixtures: malformed input, CRLF, RTL, decimals, group stems, fifth option); `time.parseDuration`; `exporters` (HTML escaping, CSV injection, BOM, filenames); `storage`; `timerTheme`; `googleDrive` (mocked fetch); Zod schemas |
| Store | Vitest | Every legal and illegal `transition`; `resetStore` clears all keys; persist round-trip and validation failure; heartbeat recovery maths; tab lock; resume opens paused; prefs survive reset |
| Component | RTL | Each screen, shortcut guards (inputs, `repeat`, jump confirms), confirm dialogs, issues table, no answer in slide DOM |
| E2E | Playwright with `page.clock`, against the **built** `out/` | Full mcq and combined flows; refresh mid-slide; refresh mid-paper; pause/extend; background-tab catch-up; suspended-gap prompt; second-tab lock; multi-set run; offline load |
| A11y | `@axe-core/playwright` | Zero serious/critical violations on every screen |
| Visual | Playwright screenshots | 1280×720 and 1920×1080, both themes, worst-case question. **Baselines are generated and compared only on one canonical platform (CI Linux)**; local Windows runs skip them to avoid false diffs |

**Gates:** `lib/` ≥ 90 %, store ≥ 80 % (`@vitest/coverage-v8`). Test counts are targets, not claims.

---

## 16. Build, Deploy & Environment

```
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm run test        # vitest run
npm run build       # next build → out/
npm run verify      # all four, in order
npm run e2e         # playwright test (serves out/ on a local static server)
npm run e2e:visual  # visual baselines, canonical platform only
```

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Only for cloud | OAuth Web client ID; authorised JavaScript origins = deployed domain **and** `http://localhost:3000` |
| `NEXT_PUBLIC_BASE_PATH` | Only for sub-path hosting | e.g. `/mcq-projector` on GitHub Pages |

`.env.local` is git-ignored; `.env.example` is committed.

**CI:** `.github/workflows/ci.yml` runs `verify` on every push/PR, then `e2e` (and `e2e:visual` on Linux).

**Offline / PWA (M15)**
- `public/sw.js` with a versioned cache name and a **build-time precache manifest** generated by a post-build Node script that lists `out/` files.
- Cache-first for the hashed app shell; network-first for HTML.
- `manifest.webmanifest` and the service-worker scope/`start_url` must respect `basePath`.
- **Updates never swap the app mid-exam:** a new worker waits until no recoverable run exists (or the next cold start), then activates with a "Update ready" toast.

---

## 17. File Tree

```
├── app/ (layout.tsx, page.tsx, globals.css)
├── components/
│   ├── ExamApp.tsx, ResumeDialog/, ConfirmDialog/, Toast/, Countdown/
│   ├── CloudAuthWidget/, PrintArea/
│   └── screens/ MetaScreen/ SetupScreen/ ReviewScreen/ CalibrateScreen/
│                SlideshowScreen/ PaperIntroScreen/ PaperScreen/ EndScreen/
├── hooks/ useDeadlineTicker.ts useWakeLock.ts useFullscreen.ts useKeyboardShortcuts.ts
│          useBeep.ts useBeforeUnloadGuard.ts useTabLock.ts
├── lib/ rng.ts shuffle.ts timing.ts deadlineTimer.ts clockGuard.ts parser.ts examParser.ts
│        paperSections.ts time.ts meta.ts storage.ts escape.ts exporters.ts aiPrompt.ts
│        demoQuestions.ts schemas.ts validate.ts strings.ts
│        googleAuthConfig.ts googleDrive.ts timerTheme.ts
├── store/ examStore.ts persistStorage.ts slices/ (navigation, draft, exam, progress, prefs, persistence, cloud)
├── types/ index.ts google-identity.d.ts
├── e2e/ *.spec.ts
├── scripts/ generate-sw-manifest.mjs
├── public/ manifest.webmanifest, sw.js, fonts/
├── .github/workflows/ci.yml
├── .env.example, .node-version, .nvmrc, .gitattributes, .prettierrc
├── vitest.config.ts, playwright.config.ts, next.config.ts, eslint.config.js, package.json
```

---

## 18. Build Order

One milestone = one logical step = one runnable delivery. Every milestone ends with `npm run verify` green and is safe to re-run.

| # | Milestone | Deliverable | Exit gate |
|---|---|---|---|
| 0 | Scaffold | `create-next-app`, strict TS, export config, scripts, Prettier, `.gitattributes`, Node pin, `.env.example`, Vitest + Playwright config, CI file. **Resolve D2** | `verify` green on empty app |
| 1 | Types, schemas, theme | `types/index.ts`, `schemas.ts`, `globals.css` tokens (both themes) | Schema-vs-type compile check passes |
| 2 | Pure lib A | `rng`, `shuffle` (`buildSets`), `timing` + tests | lib coverage ≥ 90 %; property tests pass |
| 3 | Pure lib B | `deadlineTimer`, `clockGuard`, `time`, `meta`, `timerTheme`, `escape` + tests | Chained-deadline and phase tests pass |
| 4 | MCQ parser | `parser.ts` + fixtures | Fixtures incl. CRLF, RTL, malformed input pass |
| 5 | Exam parser | `paperSections`, `examParser` + fixtures | Sample combined text parses with zero errors |
| 6 | Store core | Navigation/draft/exam/progress/prefs slices, `transition` table + tests | Every legal/illegal transition tested |
| 7 | Persistence | `storage`, `persistStorage`, persist + validation, heartbeat, tab lock, recovery maths + tests | Round-trip and recovery tests pass |
| 8 | Shell | `ExamApp`, `ConfirmDialog`, `Toast`, `ResumeDialog`, hooks | Cold-start resume works in RTL tests |
| 9 | Setup path A | `MetaScreen`, `SetupScreen` (paste, preview, JSON import/export) | Build blocked while errors exist |
| 10 | Setup path B | `ReviewScreen`, `CalibrateScreen` (overflow audit) | Answer key hidden by default |
| 11 | MCQ run | `SlideshowScreen`, `Countdown`, wake lock, sound | Refresh mid-slide resumes correctly |
| 12 | Combined run | `PaperIntroScreen`, `PaperScreen`, pause/extend | Refresh mid-paper resumes correctly |
| 13 | Finish | `EndScreen`, `exporters`, `PrintArea`, answer review, run-another-set | ZIP contains keys, sets, and B/C |
| 14 | E2E + a11y | Playwright suites, axe, visual baselines (CI) | Zero serious/critical axe violations |
| 15 | Offline | Service worker, manifest, precache script, update flow | Built app loads offline in E2E |
| 16 | Cloud | `googleDrive`, `CloudAuthWidget`, conflict flow | Mocked-fetch tests pass; app unchanged without a client ID |

**Delivery workflow:** each milestone is delivered as one paste-ready `pwsh` script that checks prerequisites, creates or updates files idempotently, runs `npm run verify`, and ends with a green **AI Feedback Summary** containing: pass/fail per stage, test and coverage counts, files created/changed, warnings, and the next milestone ID. Cloud is last on purpose: the core exam must work before the optional feature exists.

---

## 19. Release Acceptance Criteria

1. `npm run verify` and `npm run e2e` are green in CI.
2. Full mcq and combined flows complete offline after the first load.
3. Refresh at any point during `exam`, `paperIntro`, or `paper` resumes **paused** with correct remaining time; no slide is silently skipped.
4. A 2-hour laptop suspension produces the catch-up prompt, not a skipped exam.
5. No projected screen, slide DOM, or student print contains the correct answer.
6. Axe reports zero serious/critical violations on every screen in both themes.
7. A deliberately malformed paste yields line-numbered errors and no build.
8. Exported ZIP opens in Windows Explorer and Excel with non-Latin text intact.
9. With no Google client ID configured, no cloud UI or network request to Google occurs.
10. Updating the deployed app never interrupts a run in progress.

---

## 20. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| AI-formatted text varies | Tolerant parser, line-numbered issues, JSON import as an escape hatch |
| Laptop sleeps or tab throttled mid-exam | Deadline timers, wake lock, suspended-gap auto-pause |
| Crash or accidental close | Debounced + flush-on-hide autosave, heartbeat recovery, backup JSON download |
| Accidental key press skips questions | Guarded jumps, input-aware shortcuts, `repeat` ignored |
| Answers exposed on a mirrored display | Hidden-by-default key, banner, `ProjectedQuestion` type |
| Stale service worker serves an old build | Versioned cache, update only between runs |
| Visual-test flakiness across OSes | Baselines only on canonical CI platform |
| Long questions unreadable on projector | Measured overflow audit at Calibrate |

---

## 21. Known Gaps / Future Work

1. Student-device sync or a presenter window (`BroadcastChannel` two-window mode is the cheapest next step).
2. KaTeX math and image-in-question support.
3. Live scoring: teacher enters responses or imports OMR/CSV answers, and the app grades against the key.
4. B/C auto-pagination for very long case studies.
5. CSV/JSON bulk import of question banks.
6. UI translation (strings already centralised, D6).

---

## 22. Change Log: v2 → v3

| # | Change | Why |
|---|---|---|
| 1 | Frozen `ExamConfig` split from `DisplayPrefs` | v2 froze `config` at review but Calibrate edited font/theme/sound, breaking immutability |
| 2 | Freeze point defined once: `setup → review` (`lockExam`); table now has `calibrate → review`, `end → calibrate`, abort paths | v2 said the freeze happened at both `review` and `review → calibrate` |
| 3 | Multi-set run model (D1), `activeSetIndex`, `completedSetIndexes`, Run another set | v2 had `setIndex` but no way to run a second set |
| 4 | `OptionPermutation` type replaces `Letter[][]` | Original type allowed invalid permutations |
| 5 | `ProjectedQuestion` (answer omitted) | Makes answer leakage a compile error |
| 6 | Answer key hidden by default on Review, mirrored-display banner | Review is shown on the teacher's screen, which may be mirrored |
| 7 | Dependent-option pinning ("all of the above") during shuffle | Shuffling breaks such options |
| 8 | `seed` stored in config, distinct-set best effort | v2 seed was derivable from public names and could repeat across exams |
| 9 | Metadata mapping table; durations feed config; `groupStem`/`label`; decimal marks; a–d only; stable issue codes | v2 left parser-to-model mapping implicit |
| 10 | Chained deadlines, manual-navigation rule, catch-up auto-pause, clock guard | `now + duration` drifts and "advance once per slide" could skip an exam after a suspend |
| 11 | `totalMs` in timer; phases use it after extensions | Percent bands were wrong after +time |
| 12 | Heartbeat, outage credit, flush-on-hide, silent vs prompted restore by screen | v2 recovery used a stale `savedAt`, and debounced writes could be lost |
| 13 | Tab lock via localStorage heartbeat + BroadcastChannel | Stale locks and unsupported-API fallback |
| 14 | Persisted version owned by `persist`; D2 makes the v3 migrator conditional | v2 duplicated versioning and migrated data that may not exist |
| 15 | Zod validation for imports, rehydrate, Drive | All three are untrusted inputs |
| 16 | Guarded `Home`/`End`/jump, clicker keys, blank screen, input-aware shortcuts | An accidental `End` could skip the whole exam |
| 17 | Measured overflow audit on Calibrate | "Longest question by length" is not worst-case rendered height; scrolling a timed slide is unusable |
| 18 | CSV injection, UTF-8 BOM, safe filenames, ZIP UTF-8 names | Exports contain pasted text opened in Excel |
| 19 | Drive conflicts use `modifiedTime`, not client clocks | Client clocks are unreliable |
| 20 | Service worker precache manifest, `basePath`-aware, no mid-run updates | Cache-first without a manifest cannot work on a static export; stale updates are dangerous |
| 21 | Windows-safe scripts, `.gitattributes`, Prettier, platform-pinned visual baselines, CI workflow, `fast-check`, coverage tool | Dev environment is Windows; screenshot baselines differ by OS |
| 22 | Milestones split (17 steps) with explicit exit gates; acceptance criteria and risk table added | One script = one logical step; testable definition of done |
| 23 | Removed v1 history, inline change tags, and "nothing built yet" disclaimers from the body | The spec now stands alone |
