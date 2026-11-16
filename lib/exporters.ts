import type { DraftInput, ExportedExam, ExamDefinition, Question } from '@/types';
import { escapeHtml, safeFilename, buildCsv, csvCell } from './escape';
import { fmtHms } from './time';
import * as fflate from 'fflate';

// Every export must carry a usable seed. Exams locked by an older build may
// have an empty seed; derive a stable one from the exam id so the value is
// reproducible and never blank in the bundle.
function effectiveSeed(exam: ExamDefinition): string {
  const seed = exam.config.seed.trim();
  return seed || `exam-${exam.id.slice(0, 8)}`;
}

export function exportExamJson(draft: DraftInput): string {
  const exported: ExportedExam = {
    format: 'mcq-projector-exam',
    schemaVersion: 1,
    exportedAt: Date.now(),
    draft,
  };
  return JSON.stringify(exported, null, 2);
}

export function importExamJson(json: string): { success: boolean; draft?: DraftInput; error?: string } {
  try {
    const parsed = JSON.parse(json);
    if (parsed.format !== 'mcq-projector-exam' || parsed.schemaVersion !== 1) {
      return { success: false, error: 'Invalid exam format' };
    }
    return { success: true, draft: parsed.draft };
  } catch (e) {
    return { success: false, error: 'Invalid JSON' };
  }
}

function answerLetterFor(exam: ExamDefinition, setIndex: number, questionIndex: number, q: Question): string {
  const perm = exam.sets[setIndex]?.optionOrder?.[questionIndex];
  if (!perm) return 'ABCD'[q.answer] ?? 'A';
  const permIndex = perm.indexOf(q.answer);
  return permIndex >= 0 ? ('ABCD'[permIndex] ?? 'A') : 'A';
}

function buildAnswerKeyCsv(exam: ExamDefinition): string {
  const rows: string[][] = [['Set', 'Question #', 'Question ID', 'Answer', 'Question Text']];

  exam.sets.forEach((set, setIndex) => {
    set.questionIds.forEach((qid, i) => {
      const q = exam.pool.find(p => p.id === qid);
      if (!q || q.answer === undefined) return;
      rows.push([
        set.letter,
        String(i + 1),
        qid,
        answerLetterFor(exam, setIndex, i, q),
        q.text.slice(0, 200),
      ]);
    });
  });

  return buildCsv(rows);
}

// ZipGrade's published "CSV Answer Key Import File Requirements" format:
// five columns (Key Letter, Question Number, Response/Mapping, Point Value,
// Tags) with a literal header row first — no comment or metadata line above
// it, because their importer expects the first field to start with "Key".
// One row per set per position, so a teacher can import every paper set at
// once. Deliberately no BOM: ZipGrade parses the header literally.
export function buildZipGradeAnswerKeyCsv(exam: ExamDefinition): string {
  const rows: string[][] = [
    ['Key Letter', 'Question Number', 'Response/Mapping', 'Point Value', 'Tags'],
  ];

  const maxQuestions = exam.sets.reduce((max, set) => Math.max(max, set.questionIds.length), 0);

  for (let i = 0; i < maxQuestions; i++) {
    exam.sets.forEach((set, setIndex) => {
      const qid = set.questionIds[i];
      if (qid === undefined) return;
      const q = exam.pool.find(p => p.id === qid);
      if (!q || q.answer === undefined) return;
      rows.push([set.letter, String(i + 1), answerLetterFor(exam, setIndex, i, q), String(q.marks ?? 1), '']);
    });
  }

  return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}

function buildSetHtml(exam: ExamDefinition, setIndex: number): string {
  const set = exam.sets[setIndex];
  if (!set) return '';

  const questionsHtml = set.questionIds.map((qid, i) => {
    const q = exam.pool.find(p => p.id === qid);
    if (!q) return '';
    const perm = set.optionOrder?.[i];
    const opts = perm ? q.options.map((_, j) => q.options[perm[j]!]) : q.options;

    return `
      <div class="question" style="page-break-inside: avoid; margin-bottom: 2rem;">
        <h3 style="margin-bottom: 0.5rem;">Q${i + 1}. ${escapeHtml(q.label || `Q${i + 1}`)}${q.groupStem ? `<br/><em>${escapeHtml(q.groupStem)}</em>` : ''}</h3>
        <p style="margin-bottom: 1rem;">${escapeHtml(q.text)}</p>
        <ol style="list-style: upper-alpha; padding-left: 1.5rem;">
          ${opts.map(opt => `<li style="margin-bottom: 0.5rem;">${escapeHtml(opt)}</li>`).join('')}
        </ol>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(exam.meta.examName)} — Set ${set.letter}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
    h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 1rem; }
    .meta { text-align: center; color: #666; margin-bottom: 2rem; }
  </style>
</head>
<body>
  <h1>${escapeHtml(exam.meta.examName)}</h1>
  <div class="meta">
    <p>${escapeHtml(exam.meta.subject)} — Set ${set.letter}</p>
    <p>${exam.meta.date}</p>
    <p style="font-family: ui-monospace, monospace; font-size: 0.85em;">Seed: ${escapeHtml(effectiveSeed(exam))}</p>
  </div>
  ${questionsHtml}
</body>
</html>`;
}

function buildPaperHtml(exam: ExamDefinition): string {
  const sectionBHtml = exam.sectionB.map(q => `
    <div class="question" style="page-break-inside: avoid; margin-bottom: 1.5rem;">
      <h3 style="margin-bottom: 0.5rem;">Q${q.number}. ${escapeHtml(q.text)} ${q.marks ? ` [${q.marks} marks]` : ''}</h3>
      <ol style="list-style: lower-roman; padding-left: 1.5rem;">
        ${q.parts.map(p => `<li style="margin-bottom: 0.25rem;">${escapeHtml(p.label)}. ${escapeHtml(p.text)} ${p.marks ? ` [${p.marks} marks]` : ''}</li>`).join('')}
      </ol>
    </div>
  `).join('');

  const sectionCHtml = exam.sectionC.map(q => `
    <div class="question" style="page-break-inside: avoid; margin-bottom: 1.5rem;">
      <h3 style="margin-bottom: 0.5rem;">Q${q.number}. ${escapeHtml(q.text)} ${q.marks ? ` [${q.marks} marks]` : ''}</h3>
      <ol style="list-style: lower-roman; padding-left: 1.5rem;">
        ${q.parts.map(p => `<li style="margin-bottom: 0.25rem;">${escapeHtml(p.label)}. ${escapeHtml(p.text)} ${p.marks ? ` [${p.marks} marks]` : ''}</li>`).join('')}
      </ol>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(exam.meta.examName)} — Sections B & C</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1000px; margin: 0 auto; padding: 2rem; }
    h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 1rem; }
    .meta { text-align: center; color: #666; margin-bottom: 2rem; }
    .section { margin-bottom: 3rem; }
    .section h2 { border-bottom: 1px solid #333; padding-bottom: 0.5rem; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
    @media print { .two-col { display: block; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(exam.meta.examName)}</h1>
  <div class="meta">
    <p>${escapeHtml(exam.meta.subject)} — Sections B & C</p>
    <p>${exam.meta.date}</p>
  </div>
  <div class="two-col">
    <div class="section">
      <h2>Section B</h2>
      ${sectionBHtml}
    </div>
    <div class="section">
      <h2>Section C</h2>
      ${sectionCHtml}
    </div>
  </div>
</body>
</html>`;
}

export async function buildZip(exam: ExamDefinition): Promise<Blob> {
  const files: Record<string, Uint8Array> = {};

  const answerKeyCsv = buildAnswerKeyCsv(exam);
  files['answer-key.csv'] = new TextEncoder().encode(answerKeyCsv);
  files['zipgrade-answer-key.csv'] = new TextEncoder().encode(buildZipGradeAnswerKeyCsv(exam));

  exam.sets.forEach((_, i) => {
    const set = exam.sets[i];
    if (!set) return;
    const html = buildSetHtml(exam, i);
    files[`set-${set.letter}.html`] = new TextEncoder().encode(html);
  });

  if (exam.sectionB.length > 0 || exam.sectionC.length > 0) {
    const paperHtml = buildPaperHtml(exam);
    files['sections-b-c.html'] = new TextEncoder().encode(paperHtml);
  }

  const manifest = {
    format: 'mcq-projector-exam',
    schemaVersion: 1,
    examId: exam.id,
    createdAt: exam.createdAt,
    examName: exam.meta.examName,
    subject: exam.meta.subject,
    date: exam.meta.date,
    // The seed is the single most important value in this bundle: it is the
    // only way to regenerate the exact same shuffles/option orders later.
    seed: effectiveSeed(exam),
    numSets: exam.config.numSets,
    questionsPerSet: exam.config.questionsPerSet,
    setStrategy: exam.config.setStrategy,
    shuffleOptions: exam.config.shuffleOptions,
    questionsPerSlide: exam.config.questionsPerSlide,
    sets: exam.sets.map(s => ({ letter: s.letter, questions: s.questionIds.length })),
    sectionB: exam.sectionB.length,
    sectionC: exam.sectionC.length,
    // Full config so the seed alone is enough to restore every relevant
    // setting (set count and strategy especially) — the teacher never has to
    // remember what went with the key.
    config: { ...exam.config, seed: effectiveSeed(exam) },
  };
  files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest, null, 2));

  // A dedicated, human-readable seed file. Deliberately separate from the
  // JSON so a teacher can open it on any machine and read the seed at a
  // glance — this is the value to re-enter in Setup → Advanced → Seed to get
  // the exact same scrambled sets back after a crash or power cut.
  const seed = effectiveSeed(exam);
  const strategyLabel = exam.config.setStrategy === 'reorderAll'
    ? 'Reorder all (same questions, new order)'
    : 'Sample subset';
  const seedText = [
    'MCQ Projector — Saved exam key',
    '',
    `Seed: ${seed}`,
    '',
    'These settings belong to the seed. Use "Restore saved exam" in the app',
    'and this file (or just the seed above) sets them for you automatically:',
    '',
    `  Number of sets : ${exam.config.numSets}`,
    `  Set strategy   : ${strategyLabel}`,
    `  Shuffle options: ${exam.config.shuffleOptions ? 'Yes' : 'No'}`,
    '',
    'How to reproduce this exact exam:',
    '  1. Paste the SAME question bank into Setup.',
    '  2. Use "Restore a saved exam" on Setup and choose this ZIP, or paste',
    '     the seed above. The set count and strategy are applied for you.',
    '  3. Build → Review. The scrambled sets will be identical to this run.',
    '',
    'The authoritative record of every set (question order and option order)',
    'is in locked-exam.json inside this ZIP — it reproduces this exam byte',
    'for byte even if you cannot rebuild from the seed.',
    '',
    `Exam : ${exam.meta.examName}`,
    `Subject: ${exam.meta.subject}`,
    `Date  : ${exam.meta.date}`,
    `Sets  : ${exam.sets.map(s => s.letter).join(', ')}`,
  ].join('\n');
  files['seed.txt'] = new TextEncoder().encode(seedText);

  // Full machine-readable snapshot: the locked pool, the exact per-set question
  // order and option permutations, and the seed. Re-importing this file (or
  // re-running the seed with the same pool) always reproduces this exam.
  const snapshot = {
    format: 'mcq-projector-locked-exam',
    schemaVersion: 1,
    exportedAt: Date.now(),
    seed: effectiveSeed(exam),
    meta: exam.meta,
    config: exam.config,
    pool: exam.pool,
    sets: exam.sets,
    sectionB: exam.sectionB,
    sectionC: exam.sectionC,
  };
  files['locked-exam.json'] = new TextEncoder().encode(JSON.stringify(snapshot, null, 2));

  return new Promise((resolve, reject) => {
    fflate.zip(files, (err, data) => {
      if (err) reject(err);
      else if (data) resolve(new Blob([data], { type: 'application/zip' }));
      else reject(new Error('No zip data returned'));
    });
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeFilename(filename);
  a.click();
  URL.revokeObjectURL(url);
}