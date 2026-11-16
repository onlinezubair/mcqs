# MCQ Projector

Offline-first, static-export web app for running timed multiple-choice exams from a projector. Built with Next.js 16 (App Router, static export), React 19, TypeScript (strict), Zustand and Zod.

The instructor pastes an exam (or loads the bundled sample, or imports a `.docx`/`.pdf`/`.xlsx`/`.csv` paper), builds shuffled paper sets, calibrates on the room display, then runs Section A as timed slides and, if enabled, Sections B & C as a paper timer.

The app opens straight on the Setup screen: the optional Exam Metadata page is reachable via **Exam details** in the Setup header, so a one-off projector run never has to fill it in.

While a question is on screen, the slide background is a soft light colour that shifts once per quarter of that question's time (green → cream → peach → rose), keeping dark high-contrast text throughout.

## Requirements

- Node.js >= 20.9 (see `.nvmrc`)
- npm 11+

## Development

```bash
npm install
npm run dev
```

## Scripts

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm run test        # vitest run
npm run build       # next build -> out/
npm run verify      # typecheck + lint + test + build
npm run e2e         # playwright test (serves out/ on a local static server)
npm run build:sw    # regenerate the service-worker precache manifest from out/
```

`npm run build` runs `build:sw` automatically as a postbuild step, and `postinstall` copies the pdf.js worker to `public/` so PDF import works offline.

## Deployment

Next.js static export does **not** work over `file://`. Serve `out/` from any static host (GitHub Pages, Netlify, a school server) or locally:

```bash
npm run build
npx serve out
```

After the first load the service worker caches the app shell, so the app keeps working offline.

### Environment

Copy `.env.example` to `.env.local` when needed.

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Only for cloud | OAuth Web client ID; authorised JavaScript origins = deployed domain **and** `http://localhost:3000` |
| `NEXT_PUBLIC_BASE_PATH` | Only for sub-path hosting | e.g. `/mcq-projector` on GitHub Pages |

`NEXT_PUBLIC_BASE_PATH` is honoured by `next.config.ts` and by the service-worker registration.

## Data & privacy

Everything is local-first: exam input, generated sets, progress and preferences are stored in `localStorage` (falling back to IndexedDB for large payloads). Google Drive sync is optional and only enabled when a client ID is configured. The Google token is kept in memory and `sessionStorage` only.

## Exam input format

The setup screen accepts either a pasted unified text (metadata, then three sections) or a dropped/browsed document — `.docx`, `.pdf`, `.odt`, `.rtf`, `.xlsx`, `.csv`, `.tsv`, `.txt`, `.md`. Imported files are converted to the same text format in the browser; nothing is uploaded.

When a paper arrives by file (drop or Browse), the parsed questions are **not** shown on the page. Instead a confirmation card reports how many questions were uploaded, the marks, per-question time, total MCQ time, total allowed time and number of sets, plus a short set of MCQ instructions. From there the teacher can **Build → Review**, open the **Review imported text** editor, or **Replace paper**.

Setup defaults are **4 sets** and **60 seconds per question**. Both live in Configuration under an explicit **MCQ timing** choice (same time per question, or a fixed total). There is no separate "questions per set" setting — every set always contains the full bank.

```
Program: BSc Computer Science
Subject: Data Structures
Exam: Midterm Examination
Date: 2024-10-15
Section A Time: 45 minutes
Section B & C Time: 2 hours 15 minutes

=== SECTION A ===
1. Question text?
a) Option A
b) Option B
c) Option C
d) Option D
Answer: B

=== SECTION B ===
Q1. Descriptive question [10 marks]
i. Part one [4 marks]
ii. Part two [6 marks]

=== SECTION C ===
Q1. Case study [15 marks]
i. Part one [7 marks]
ii. Part two [8 marks]
```

Option labels may be `a)`, `A.`, `(A)`, `A:` or lowercase Roman `i) ii) iii) iv)`; answers may be `Answer: B`, `Ans: B` or the `*B` shorthand. Sections without `=== SECTION A ===` headers are treated as plain MCQ text.

Select **Load Sample** on the Setup screen to see a complete working example.

## Running the exam

All paper sets are projected **side by side**, one column per set, advancing in lockstep: position N of the run shows Set A's question N, Set B's question N, and so on, each with its own shuffled option order. The number of columns follows the number of sets, so 2 sets use two wide columns and 6 sets use six narrow ones. Every set contains the whole question bank, so a run is as long as the bank.

The countdown is a compact **floating pill** that does not take layout space from the questions. It starts in the top-right corner and can be dragged anywhere on screen (or nudged with the arrow keys when focused); the chosen position is remembered for the next exam.

Timing has one of two modes:
- **Same time per question** — every question gets the configured seconds.
- **Fixed total time** — the total is split across the bank with a largest-remainder pass, so the durations sum to the total exactly and no question drops below one second.

Sound cues mark progress: a two-note chime when a new question appears, one beep at 25 % of the question's time, two at 50 %, and three at 75 %.

## Course lookup

`Subject Code` is the first field on the metadata screen: typing a known code (`310`, `PHARM 310`, or even `pharm-310`) fills Program, Semester, Subject and Subject Full Name in one step. Unknown codes show a warning instead of guessing.

If the teacher doesn't know the code, the same form works hierarchically: pick Semester, then Subject from that semester's dropdown (both lists come from `PharmD_Course_Codes.csv`, bundled as `lib/courses.ts`). Choosing a subject fills the code back in, so the form stays consistent both ways.

Rows in the CSV with no code still appear under their semester, listed by name. Selecting a different Program switches to free-text Subject entry, since only Pharm.D has a bundled list.

**Exam Name** offers `Quiz`, `Midterm`, `Final Term` (default `Quiz`; the Quiz Number field appears only for `Quiz`, defaulting to `1`). **Subject Mode** offers `Theory` and `Practical` (default `Theory`). Values persisted by older builds, such as `Class Quiz` or a blank mode, are mapped onto the closest option on load.

## Exports

The end-screen ZIP contains per-set question-paper HTML, Sections B & C HTML, a human-readable `answer-key.csv`, a ZipGrade-compatible `zipgrade-answer-key.csv`, and a `manifest.json`. ZIP filenames are built from `lib/meta.ts` (`buildMetaFileBase`), e.g. `PharmD_Sem4_PHARM412_ClassQuiz3_2026-09-06.zip`.

## Licensing

Third-party dependency licenses are unchanged; this project is internal.
