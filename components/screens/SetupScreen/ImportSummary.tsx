'use client';

import type { ExamConfig, Issue, PaperQuestion } from '@/types';
import { fmtHms } from '@/lib/time';
import { resolveMcqTiming } from '@/lib/timing';

interface ImportSummaryProps {
  sourceName: string;
  questionCount: number;
  totalMarks: number;
  sectionB: PaperQuestion[];
  sectionC: PaperQuestion[];
  config: ExamConfig;
  issues: Issue[];
  onBuild: () => void;
  onEdit: () => void;
  onReplace: () => void;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '0.9rem 1rem',
      }}
    >
      <div style={{ fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '0.15rem' }}>{value}</div>
      {hint && (
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{hint}</div>
      )}
    </div>
  );
}

export function ImportSummary({
  sourceName,
  questionCount,
  totalMarks,
  sectionB,
  sectionC,
  config,
  issues,
  onBuild,
  onEdit,
  onReplace,
}: ImportSummaryProps) {
  const errors = issues.filter(issue => issue.severity === 'error');
  const warnings = issues.filter(issue => issue.severity === 'warning');

  // Single source of truth for MCQ timing, shared with the store and the
  // setup preview so the summary can never disagree with the actual run.
  const timing = resolveMcqTiming(config, questionCount);

  const perQuestionSeconds = timing.even
    ? timing.minSeconds
    : questionCount > 0
      ? timing.totalSeconds / questionCount
      : 0;
  const timingHint = timing.even
    ? config.mcqTimingMode === 'total'
      ? 'shared evenly'
      : 'fixed per slide'
    : `${timing.minSeconds}–${timing.maxSeconds}s per slide`;

  const perSetCount = questionCount;
  const mcqTotalSeconds = timing.totalSeconds;
  const paperSeconds = sectionB.length + sectionC.length > 0 ? config.paperDurationMinutes * 60 : 0;
  const overallSeconds = mcqTotalSeconds + paperSeconds;
  const hasPaper = sectionB.length > 0 || sectionC.length > 0;

  const instructions = [
    `Each question is shown one at a time, with ${Math.round(perQuestionSeconds)} seconds on the clock.`,
    'Read the whole question and all four options before choosing an answer.',
    'Mark exactly one option per question on your answer sheet — never circle two.',
    'The countdown turns colour as time runs low; the last few seconds are urgent.',
    'Do not ask questions during the timer. Raise your hand and the invigilator will pause the exam.',
  ];

  return (
    <div className="card mb-4" style={{ borderColor: 'var(--success)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', marginBottom: '1.25rem' }}>
        <div
          aria-hidden="true"
          style={{
            width: '2.75rem',
            height: '2.75rem',
            borderRadius: '50%',
            background: 'var(--success)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          ✓
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.35rem' }}>
            {questionCount} {questionCount === 1 ? 'question' : 'questions'} uploaded successfully
          </h2>
          <p style={{ margin: '0.2rem 0 0', color: 'var(--muted)', fontSize: '0.875rem' }}>
            {sourceName}
            {hasPaper && ` · plus ${sectionB.length} + ${sectionC.length} written questions in Sections B & C`}
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.25rem',
        }}
      >
        <Stat label="MCQs" value={String(questionCount)} hint={totalMarks > 0 ? `${totalMarks} marks` : undefined} />
        <Stat
          label="Time per question"
          value={`${Math.round(perQuestionSeconds)}s`}
          hint={timingHint}
        />
        <Stat label="MCQ time" value={fmtHms(Math.round(mcqTotalSeconds))} />
        {hasPaper && <Stat label="Paper time" value={fmtHms(Math.round(paperSeconds))} />}
        <Stat label="Total allowed time" value={fmtHms(Math.round(overallSeconds))} />
        <Stat label="Sets" value={String(config.numSets)} hint={`${perSetCount} questions each`} />
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: '0.5rem' }}>
          Instructions for MCQs
        </h3>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'grid', gap: '0.35rem', fontSize: '0.9rem' }}>
          {instructions.map(text => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </div>

      {errors.length > 0 ? (
        <div
          style={{
            background: 'var(--option-incorrect)',
            border: '1px solid var(--danger)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            fontSize: '0.875rem',
          }}
        >
          <strong>{errors.length} problem{errors.length === 1 ? '' : 's'} must be fixed before building.</strong>{' '}
          Open the text to correct them.
        </div>
      ) : (
        warnings.length > 0 && (
          <div
            style={{
              background: 'var(--option-hover)',
              border: '1px solid var(--warning)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}
          >
            <strong>{warnings.length} warning{warnings.length === 1 ? '' : 's'}</strong> — the paper is still
            buildable. Open the text to review them.
          </div>
        )
      )}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={onBuild} disabled={errors.length > 0 || questionCount === 0} style={{ minWidth: '160px' }}>
          Build → Review
        </button>
        <button className="btn btn-ghost" onClick={onEdit}>
          Review imported text
        </button>
        <button className="btn btn-ghost" onClick={onReplace}>
          Replace paper
        </button>
      </div>
    </div>
  );
}

