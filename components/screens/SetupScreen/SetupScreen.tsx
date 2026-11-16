'use client';

import { useState, useRef } from 'react';
import { useExamStore } from '@/store/examStore';
import { parseMcq } from '@/lib/parser';
import { parseUnifiedExam } from '@/lib/examParser';
import { parsePaperSections } from '@/lib/paperSections';
import { buildAiPromptText } from '@/lib/aiPrompt';
import { exportExamJson, importExamJson } from '@/lib/exporters';
import { demoQuestions, SAMPLE_COMBINED_TEXT } from '@/lib/demoQuestions';
import { resolveMcqTiming } from '@/lib/timing';
import { generateSeed } from '@/lib/rng';
import { fmtHms } from '@/lib/time';
import { useToast } from '@/components/Toast/Toast';
import { useConfirm } from '@/components/ConfirmDialog/ConfirmDialog';
import { NumberInput } from '@/components/NumberInput/NumberInput';
import { ImportSummary } from '@/components/screens/SetupScreen/ImportSummary';
import { RestorePanel } from '@/components/screens/SetupScreen/RestorePanel';
import { CloudAccount } from '@/components/CloudAccount/CloudAccount';
import {
  ACCEPTED_QUESTION_FILE_TYPES,
  FileImportError,
  extractQuestionsText,
} from '@/lib/fileImport';

export function SetupScreen() {
  const { draft, setMeta, setConfig, setRawInput, config, transition, lockExam } = useExamStore();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewIssues, setPreviewIssues] = useState<import('@/types').Issue[]>([]);
  const [parsedQuestions, setParsedQuestions] = useState<import('@/types').Question[]>([]);
  const [sectionB, setSectionB] = useState<import('@/types').PaperQuestion[]>([]);
  const [sectionC, setSectionC] = useState<import('@/types').PaperQuestion[]>([]);
  const [activeTab, setActiveTab] = useState<'unified' | 'separate'>('unified');
  const importRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const browseBtnRef = useRef<HTMLButtonElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  // Set only when a paper arrived via the drop zone / file picker, so the
  // screen can show the "uploaded" summary instead of dumping the parsed
  // questions back into the paste box.
  const [importSource, setImportSource] = useState<string | null>(null);
  const [showPasteBox, setShowPasteBox] = useState(true);
  // Track if we have ever loaded a file, to control initial empty state
  const [hasLoadedFile, setHasLoadedFile] = useState(false);

  const hasErrors = previewIssues.some(i => i.severity === 'error');
  const totalQuestions = parsedQuestions.length;
  const totalMarks = parsedQuestions.reduce((sum, q) => sum + (q.marks ?? 1), 0);
  const mcqTiming = resolveMcqTiming(config, totalQuestions);

  const handleParse = (unifiedOverride?: string) => {
    let questions: import('@/types').Question[] = [];
    let issues: import('@/types').Issue[] = [];
    let b: import('@/types').PaperQuestion[] = [];
    let c: import('@/types').PaperQuestion[] = [];

    if (activeTab === 'unified' && (unifiedOverride ?? draft.rawUnified).trim()) {
      const unifiedText = unifiedOverride ?? draft.rawUnified;
      const result = parseUnifiedExam(unifiedText);
      questions = result.sectionA;
      issues = result.issues;
      b = result.sectionB;
      c = result.sectionC;

      // A paper imported from Word/PDF usually has no "=== SECTION A ==="
      // header, so the unified parser would treat every line as metadata.
      // Fall back to parsing the whole text as a plain MCQ block in that case.
      if (questions.length === 0 && !/^=+\s*SECTION/i.test(unifiedText.trim())) {
        const mcqOnly = parseMcq(unifiedText);
        if (mcqOnly.questions.length > 0) {
          questions = mcqOnly.questions;
          issues = mcqOnly.issues;
          setRawInput('rawMcq', unifiedText);
          setParsedQuestions(questions);
          setPreviewIssues(issues);
          setSectionB([]);
          setSectionC([]);
          return;
        }
      }

      setRawInput('rawMcq', result.sectionAText);
      setRawInput('rawB', result.sectionBText);
      setRawInput('rawC', result.sectionCText);

      if (Object.keys(result.meta).length > 0) {
        setMeta(result.meta);
      }

      const metaKeys = new Set(Object.keys(result.meta).map(k => k.toLowerCase()));
      const hasMcqTime = metaKeys.has('section a time') || metaKeys.has('section a minutes');
      const hasPaperTime = metaKeys.has('section b & c time') || metaKeys.has('section b and c time') || metaKeys.has('section b&c time');
      const configUpdate: import('@/types').ExamConfig extends infer T ? Partial<T> : never = {};
      if (result.durations.totalMcqMinutes > 0) {
        (configUpdate as Record<string, unknown>).totalMcqMinutes = Math.round(result.durations.totalMcqMinutes);
      }
      if (result.durations.paperDurationMinutes > 0 && (b.length > 0 || c.length > 0)) {
        (configUpdate as Record<string, unknown>).paperDurationMinutes = Math.round(result.durations.paperDurationMinutes);
      }
      if (b.length > 0 || c.length > 0) {
        (configUpdate as Record<string, unknown>).examMode = 'combined';
      }
      if (Object.keys(configUpdate).length > 0) {
        setConfig(configUpdate);
      }
      if (config.examMode === 'combined' && hasMcqTime && hasPaperTime && result.durations.totalMinutes > 0) {
        const expected = result.durations.totalMcqMinutes + result.durations.paperDurationMinutes;
        if (Math.abs(expected - result.durations.totalMinutes) > 1) {
          toast('Section times do not add up to total time', 'warning');
        }
      }
    } else if (activeTab === 'separate') {
      if (draft.rawMcq.trim()) {
        const result = parseMcq(draft.rawMcq);
        questions = result.questions;
        issues = result.issues;
      }
      if (config.examMode === 'combined' && (draft.rawB.trim() || draft.rawC.trim())) {
        const paper = parsePaperSections(draft.rawB, draft.rawC);
        b = paper.sectionB;
        c = paper.sectionC;
        issues = [...issues, ...paper.issues];
      }
    }

    setParsedQuestions(questions);
    setPreviewIssues(issues);
    setSectionB(b);
    setSectionC(c);
  };

  const handleBuild = () => {
    if (hasErrors) {
      toast('Fix errors before building', 'error');
      return;
    }
    if (parsedQuestions.length === 0) {
      toast('No questions parsed', 'error');
      return;
    }
    if (config.examMode === 'combined' && (config.paperDurationMinutes <= 0)) {
      toast('Paper duration must be > 0 for combined mode', 'error');
      return;
    }

    lockExam(parsedQuestions, { sectionB, sectionC });
    transition('review');
  };

  const handleExportJson = () => {
    const json = exportExamJson(draft);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exam-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = importExamJson(event.target?.result as string);
        if (result.success) {
          // Would update draft here
          toast('Exam imported successfully', 'success');
        } else {
          toast('Invalid exam file', 'error');
        }
      } catch {
        toast('Failed to parse JSON', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setLoadedFileName(null);
    setImportSource(null);
    setShowPasteBox(true);
    setRawInput('rawUnified', SAMPLE_COMBINED_TEXT);
    setActiveTab('unified');
    handleParse(SAMPLE_COMBINED_TEXT);
  };

  // Extracts each file to plain text (Word/ODT/XLSX/CSV/RTF/PDF/plain text)
  // and parses it. The text is kept in the store so build/export works, but
  // the paste box is replaced with a summary card so the canvas stays clean.
  const loadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const parts: string[] = [];
    const names: string[] = [];

    for (const file of list) {
      try {
        const text = await extractQuestionsText(file);
        if (text.trim()) {
          parts.push(text.trim());
          names.push(file.name);
        }
      } catch (error) {
        setLoadedFileName(null);
        toast(
          error instanceof FileImportError
            ? error.message
            : `Could not read "${file.name}". Try saving it as .docx, .pdf, .csv or .txt.`,
          'error',
        );
        return;
      }
    }

    const merged = parts.join('\n\n');
    if (!merged.trim()) {
      setLoadedFileName(null);
      toast('No readable text found in that file.', 'error');
      return;
    }

    setRawInput('rawUnified', merged);
    setActiveTab('unified');
    handleParse(merged);
    const label = names.join(', ');
    setLoadedFileName(label);
    setImportSource(label);
    setHasLoadedFile(true);
    setShowPasteBox(true);
    toast(`Loaded ${label}`, 'success');
  };

  const handleReplacePaper = () => {
    setImportSource(null);
    setLoadedFileName(null);
    setShowPasteBox(true);
  };

  const handleFileBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) void loadFiles(files);
    // Reset so choosing the same file again still fires onChange.
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      void loadFiles(e.dataTransfer.files);
      return;
    }
    const text = e.dataTransfer.getData('text/plain');
    if (text.trim()) {
      setLoadedFileName(null);
      setImportSource(null);
      setShowPasteBox(true);
      setRawInput('rawUnified', text);
    }
  };

  const handleExportAiPrompt = () => {
    const prompt = buildAiPromptText(config.examMode);
    const blob = new Blob([prompt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = config.examMode === 'combined' ? 'mcq-projector-exam.txt' : 'mcq-projector-section-a.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1>Setup Exam</h1>
          <p className="text-muted">Paste your exam content, configure settings, then build</p>
        </div>
        <button className="btn btn-ghost" onClick={() => transition('meta')}>
          Exam details
        </button>
</header>

      <RestorePanel />
      <CloudAccount />

{showPasteBox && (
      <div className="card mb-4">
        <div className="tab-group" role="tablist" aria-label="Input method">
          <button
            role="tab"
            aria-selected={activeTab === 'unified'}
            className={`tab-btn ${activeTab === 'unified' ? 'active' : ''}`}
            onClick={() => setActiveTab('unified')}
          >
            Unified Paste
            <span className="kbd-hint"><kbd>1</kbd></span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'separate'}
            className={`tab-btn ${activeTab === 'separate' ? 'active' : ''}`}
            onClick={() => setActiveTab('separate')}
          >
            Separate Sections
            <span className="kbd-hint"><kbd>2</kbd></span>
          </button>
        </div>

        {activeTab === 'unified' && (
          <div>
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              tabIndex={0}
              role="button"
              aria-label="Drop zone for question paper files"
              className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
              style={{
                borderRadius: '10px',
                padding: '1.25rem 1.5rem',
                marginBottom: '1rem',
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
              }}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 600, marginBottom: '0.2rem', fontSize: '0.9375rem' }}>
                  {loadedFileName ? `Loaded: ${loadedFileName}` : 'Drop a question paper here'}
                </div>
                <div className="help-text" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span>.docx, .pdf, .odt, .rtf, .xlsx, .csv, .tsv, .txt or .md</span>
                  <span style={{ color: 'var(--muted)' }}>·</span>
                  <span>Everything stays on this computer</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_QUESTION_FILE_TYPES}
                  onChange={handleFileBrowse}
                  style={{ display: 'none' }}
                  id="import-paper"
                  onClick={e => e.stopPropagation()}
                />
                <button
                  ref={browseBtnRef}
                  className="btn btn-primary"
                  onClick={() => fileRef.current?.click()}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
                  autoFocus
                >
                  Browse files…
                  <span className="kbd-hint"><kbd>Enter</kbd></span>
                </button>
              </div>
            </div>

            {importSource && !hasErrors ? (
              <ImportSummary
                sourceName={importSource}
                questionCount={totalQuestions}
                totalMarks={totalMarks}
                sectionB={sectionB}
                sectionC={sectionC}
                config={config}
                issues={previewIssues}
                onBuild={handleBuild}
                onEdit={() => {
                  // "Review imported text" brings the paste editor back so the
                  // teacher can inspect/edit the parsed text.
                  setShowPasteBox(true);
                  setImportSource(null);
                }}
                onReplace={handleReplacePaper}
              />
            ) : (
              <>
                <label className="label">Paste full exam (metadata + Section A + B + C)</label>
                <textarea
                  className="input"
                  style={{ minHeight: '300px', fontFamily: 'monospace', fontSize: '0.875rem' }}
                  value={draft.rawUnified}
                  onChange={e => setRawInput('rawUnified', e.target.value)}
                />
              </>
            )}
          </div>
        )}

        {activeTab === 'separate' && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label className="label">Section A: MCQs</label>
              <textarea
                className="input"
                style={{ minHeight: '200px', fontFamily: 'monospace', fontSize: '0.875rem' }}
                value={draft.rawMcq}
                onChange={e => setRawInput('rawMcq', e.target.value)}
              />
            </div>
            {config.examMode === 'combined' && (
              <>
                <div>
                  <label className="label">Section B: Descriptive</label>
                  <textarea
                    className="input"
                    style={{ minHeight: '150px', fontFamily: 'monospace', fontSize: '0.875rem' }}
                    value={draft.rawB}
                    onChange={e => setRawInput('rawB', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Section C: Case Study</label>
                  <textarea
                    className="input"
                    style={{ minHeight: '150px', fontFamily: 'monospace', fontSize: '0.875rem' }}
                    value={draft.rawC}
                    onChange={e => setRawInput('rawC', e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
<button
            className="btn btn-primary"
            onClick={() => handleParse()}
            disabled={!draft.rawUnified.trim() && !draft.rawMcq.trim()}
          >
            Parse & Preview
            <span className="kbd-hint"><kbd>P</kbd></span>
          </button>
          <button className="btn btn-ghost" onClick={handleLoadSample}>
            Load Sample
          </button>
          <button className="btn btn-ghost" onClick={handleExportAiPrompt}>
            Export AI Prompt
          </button>
          <button className="btn btn-ghost" onClick={handleExportJson}>
            Export JSON
          </button>
          <input
            type="file"
            accept=".json"
            onChange={handleImportJson}
            style={{ display: 'none' }}
            id="import-json"
            ref={importRef}
          />
          <button className="btn btn-ghost" onClick={() => importRef.current?.click()}>
            Import JSON
          </button>
        </div>
      </div>
      )}

      {previewIssues.length > 0 && !importSource && (
        <div className="card mb-4">
          <h3 className="mb-2">Issues ({previewIssues.filter(i => i.severity === 'error').length} errors, {previewIssues.filter(i => i.severity === 'warning').length} warnings)</h3>
          <div style={{ maxHeight: '200px', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Line</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Severity</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Code</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Message</th>
                </tr>
              </thead>
              <tbody>
                {previewIssues.map((issue, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.5rem' }}>{issue.line}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <span style={{ color: issue.severity === 'error' ? 'var(--danger)' : 'var(--warning)', textTransform: 'capitalize' }}>
                        {issue.severity}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>{issue.code}</td>
                    <td style={{ padding: '0.5rem' }}>{issue.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card mb-4">
        <h3 className="mb-4">Configuration</h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label className="label">Mode</label>
            <select className="input" value={config.examMode} onChange={e => setConfig({ examMode: e.target.value as 'mcq' | 'combined' })}>
              <option value="mcq">MCQ Only</option>
              <option value="combined">Combined (A → B&C)</option>
            </select>
          </div>

          <div>
            <label className="label">Number of Sets</label>
            <NumberInput className="input" min={1} max={26} value={config.numSets} onChange={numSets => setConfig({ numSets })} />
            <p className="help-text mt-2">Every set gets all {totalQuestions || '…'} questions, shuffled.</p>
          </div>

          <div>
            <label className="label">Questions per Slide</label>
            <NumberInput className="input" min={2} max={6} value={config.questionsPerSlide ?? 4} onChange={questionsPerSlide => setConfig({ questionsPerSlide })} />
            <p className="help-text mt-2">How many questions shown at once per slide (2–6). Default: 4.</p>
          </div>

          <div>
            <label className="label">
              <input type="checkbox" checked={config.shuffleOptions} onChange={e => setConfig({ shuffleOptions: e.target.checked })} style={{ marginRight: '0.5rem' }} />
              Shuffle Options
            </label>
          </div>

          <div>
            <label className="label">
              <input type="checkbox" checked={config.allowPaperPause} onChange={e => setConfig({ allowPaperPause: e.target.checked })} style={{ marginRight: '0.5rem' }} />
              Allow Paper Pause
            </label>
          </div>
        </div>

        <div
          style={{
            borderTop: '1px solid var(--border)',
            paddingTop: '1.25rem',
          }}
        >
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>MCQ timing</h4>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn ${config.mcqTimingMode === 'perQuestion' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setConfig({ mcqTimingMode: 'perQuestion' })}
            >
              Same time per question
            </button>
            <button
              type="button"
              className={`btn ${config.mcqTimingMode === 'total' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setConfig({ mcqTimingMode: 'total' })}
            >
              Fixed total time
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'start' }}>
            {config.mcqTimingMode === 'perQuestion' ? (
              <div>
                <label className="label">Time per question (seconds)</label>
                <NumberInput className="input" min={5} value={config.slideDuration} onChange={slideDuration => setConfig({ slideDuration })} />
                <p className="help-text mt-2">
                  {totalQuestions > 0
                    ? `${totalQuestions} × ${config.slideDuration}s = ${fmtHms(totalQuestions * config.slideDuration)} total`
                    : 'Total time is calculated once questions are loaded.'}
                </p>
              </div>
            ) : (
              <div>
                <label className="label">Total MCQ time (minutes)</label>
                <NumberInput className="input" min={1} value={config.totalMcqMinutes} onChange={totalMcqMinutes => setConfig({ totalMcqMinutes })} />
                <p className="help-text mt-2">
                  {totalQuestions > 0
                    ? `Split evenly: ${fmtHms(Math.round(mcqTiming.totalSeconds))} ÷ ${totalQuestions} ≈ ${mcqTiming.minSeconds === mcqTiming.maxSeconds ? `${mcqTiming.minSeconds}s` : `${mcqTiming.minSeconds}–${mcqTiming.maxSeconds}s`} each`
                    : 'Each question gets an equal share once questions are loaded.'}
                </p>
              </div>
            )}

            {config.examMode === 'combined' && (
              <div>
                <label className="label">Paper Duration (minutes)</label>
                <NumberInput className="input" min={1} value={config.paperDurationMinutes} onChange={paperDurationMinutes => setConfig({ paperDurationMinutes })} />
                <p className="help-text mt-2">Sections B &amp; C, after the MCQs finish.</p>
              </div>
            )}
          </div>
        </div>

        <details className={showAdvanced ? 'open' : ''} style={{ marginTop: '1rem' }}>
          <summary className="label" style={{ cursor: 'pointer' }}>Advanced</summary>
          <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label className="label">Seed</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  className="input"
                  value={config.seed}
                  placeholder="auto-generated if blank"
                  onChange={e => setConfig({ seed: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setConfig({ seed: generateSeed() })}
                  title="Generate a new random seed"
                >
                  Regenerate
                </button>
              </div>
              <p className="help-text mt-2">Same seed + same questions = same shuffled sets every run. Locked and exported with the ZIP.</p>
            </div>
          </div>
        </details>
      </div>

      {!importSource && (
        <div className="card mb-4" data-testid="setup-preview">
          <h3 className="mb-2">Preview</h3>
          <p>Questions parsed: <strong>{totalQuestions}</strong></p>
          <p>Questions per slide: <strong>{config.questionsPerSlide ?? 4}</strong></p>
          {config.mcqTimingMode === 'perQuestion' ? (
            <p>Time per question: <strong>{config.slideDuration}s</strong></p>
          ) : (
            <p>Total MCQ time: <strong>{config.totalMcqMinutes} min</strong></p>
          )}
          {totalQuestions > 0 && <p>Estimated MCQ run: <strong>{fmtHms(Math.round(mcqTiming.totalSeconds))}</strong></p>}
          {config.examMode === 'combined' && (
            <p>Paper (B&C) time: <strong>{config.paperDurationMinutes} min</strong></p>
          )}
        </div>
      )}

      {!importSource && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            className="btn btn-primary"
            onClick={handleBuild}
            disabled={hasErrors || totalQuestions === 0}
            style={{ minWidth: '160px' }}
          >
            Build → Review
            <span className="kbd-hint"><kbd>B</kbd></span>
          </button>
        </div>
      )}
    </div>
  );
}