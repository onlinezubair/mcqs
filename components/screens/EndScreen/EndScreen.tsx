'use client';

import { useState } from 'react';
import { useExamStore } from '@/store/examStore';
import { fmtHms } from '@/lib/time';
import { escapeHtml } from '@/lib/escape';
import { useConfirm } from '@/components/ConfirmDialog/ConfirmDialog';
import { ExportsPanel } from '@/components/ExportsPanel/ExportsPanel';

export function EndScreen() {
  const { exam, progress, runAnotherSet, resetStore } = useExamStore();
  const { confirm } = useConfirm();
  const [showAnswerReview, setShowAnswerReview] = useState(false);
  const [reviewSetIndex, setReviewSetIndex] = useState(0);
  const [reviewQuestionIndex, setReviewQuestionIndex] = useState(0);

  if (!exam || !progress) return null;

  const completedSets = progress.completedSetIndexes.length;
  const totalSets = exam.sets.length;
  const slideTimer = progress.slideTimer;
  const paperTimer = progress.paperTimer;

  const totalSlideMs = slideTimer.totalMs - slideTimer.remainingMs;
  const totalPaperMs = paperTimer ? paperTimer.totalMs - paperTimer.remainingMs : 0;
  const totalTimeMs = totalSlideMs + totalPaperMs;

  const pauses = slideTimer.pausedLog.length + (paperTimer?.pausedLog.length ?? 0);
  const extensions = slideTimer.extraMs > 0 || (paperTimer?.extraMs ?? 0) > 0;

  const handleRunAnotherSet = () => {
    runAnotherSet();
  };

  const handleNewExam = () => {
    confirm('Reset exam and return to start? This clears all data.', () => {
      resetStore();
    }, { variant: 'danger', confirmText: 'Yes, reset' });
  };

  if (showAnswerReview && exam) {
    const reviewSet = exam.sets[reviewSetIndex];
    const qid = reviewSet?.questionIds[reviewQuestionIndex];
    const question = qid !== undefined ? exam.pool.find(q => q.id === qid) : undefined;
    if (!reviewSet || !question) return null;
    const perm = reviewSet.optionOrder?.[reviewQuestionIndex];
    const options = perm ? question.options.map((_, i) => question.options[perm[i]!]) : question.options;
    const answerIdx = question.answer ?? 0;
    const answerLetter = perm ? 'ABCD'[perm.indexOf(answerIdx)] : 'ABCD'[answerIdx];

    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
          <h1>Answer Review Mode</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn" onClick={() => setReviewQuestionIndex(Math.max(0, reviewQuestionIndex - 1))} disabled={reviewQuestionIndex === 0}>← Previous</button>
            <button className="btn" onClick={() => setReviewQuestionIndex(Math.min(reviewSet.questionIds.length - 1, reviewQuestionIndex + 1))} disabled={reviewQuestionIndex >= reviewSet.questionIds.length - 1}>Next →</button>
            <button className="btn btn-ghost" onClick={() => setShowAnswerReview(false)}>Exit Review</button>
          </div>
        </header>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--muted)' }}>
          <span>Set {reviewSet.letter} — Question {reviewQuestionIndex + 1} of {reviewSet.questionIds.length}</span>
          <span>Correct: <strong style={{ color: 'var(--success)', fontSize: '1.5rem' }}>{answerLetter}</strong></span>
        </div>

        {question && (
          <div className="card" style={{ maxWidth: '700px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '1rem' }}>
              {question.label ? escapeHtml(question.label) : `Q${reviewQuestionIndex + 1}`}
              {question.groupStem && (
                <>
                  <br />
                  <em style={{ fontWeight: 400, color: 'var(--muted)' }}>{escapeHtml(question.groupStem)}</em>
                </>
              )}
            </h2>
            <p style={{ fontSize: '1.125rem', marginBottom: '1.5rem' }}>{escapeHtml(question.text)}</p>
            <ol style={{ listStyle: 'upper-alpha', paddingLeft: '1.5rem', display: 'grid', gap: '0.75rem' }}>
              {options?.map((opt, i) => (
                <li key={i} style={{
                  padding: '1rem',
                  background: i === (perm ? perm.indexOf(answerIdx) : answerIdx) ? 'var(--option-correct)' : 'var(--option-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontWeight: i === (perm ? perm.indexOf(answerIdx) : answerIdx) ? 600 : 400,
                }}>
                  <strong style={{ marginRight: '0.5rem' }}>{'ABCD'[i]})</strong>
                  {escapeHtml(opt)}
                  {i === (perm ? perm.indexOf(answerIdx) : answerIdx) && <span style={{ marginLeft: '0.5rem', color: 'var(--success)' }}>✓ Correct</span>}
                </li>
              ))}
            </ol>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem' }}>
          {exam.sets.map((s, i) => (
            <button key={s.letter} className={`btn ${i === reviewSetIndex ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setReviewSetIndex(i); setReviewQuestionIndex(0); }} style={{ textTransform: 'uppercase' }}>
              Set {s.letter}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', paddingTop: '2rem' }}>
      <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>Exam Complete</h1>
        <p className="text-muted">{exam.meta.examName} — {exam.meta.subject}</p>
      </header>

      <div className="card mb-4">
        <h3 className="mb-4" style={{ textAlign: 'center' }}>Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{completedSets} / {totalSets}</div>
            <div className="text-muted">Sets Run</div>
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>
              {exam.sets[progress.activeSetIndex]?.questionIds.length ?? 0}
            </div>
            <div className="text-muted">Questions in Last Set</div>
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{fmtHms(Math.ceil(totalTimeMs / 1000))}</div>
            <div className="text-muted">Total Time Used</div>
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{pauses}</div>
            <div className="text-muted">Pauses</div>
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{extensions ? 'Yes' : 'No'}</div>
            <div className="text-muted">Time Extensions</div>
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{slideTimer.pausedLog.filter(p => p.reason === 'recovery').length + (paperTimer?.pausedLog.filter(p => p.reason === 'recovery').length ?? 0)}</div>
            <div className="text-muted">Recovery Events</div>
          </div>
        </div>
      </div>

      {slideTimer.pausedLog.length > 0 && (
        <div className="card mb-4">
          <h3 className="mb-2">MCQ Pauses</h3>
          <ul style={{ paddingLeft: '1.5rem', display: 'grid', gap: '0.5rem' }}>
            {slideTimer.pausedLog.map((p, i) => (
              <li key={i}>
                {new Date(p.at).toLocaleTimeString()} — {p.reason === 'recovery' ? 'Recovery' : 'Manual'}
                {p.resumedAt && ` (resumed ${new Date(p.resumedAt).toLocaleTimeString()})`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {paperTimer?.pausedLog.length && (
        <div className="card mb-4">
          <h3 className="mb-2">Paper Pauses</h3>
          <ul style={{ paddingLeft: '1.5rem', display: 'grid', gap: '0.5rem' }}>
            {paperTimer.pausedLog.map((p, i) => (
              <li key={i}>
                {new Date(p.at).toLocaleTimeString()} — {p.reason === 'recovery' ? 'Recovery' : 'Manual'}
                {p.resumedAt && ` (resumed ${new Date(p.resumedAt).toLocaleTimeString()})`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ExportsPanel exam={exam} onAnswerReview={() => setShowAnswerReview(true)} />

      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        {completedSets < totalSets && (
          <button className="btn btn-primary" onClick={handleRunAnotherSet} style={{ minWidth: '180px' }}>
            Run Another Set →
            <span className="kbd-hint"><kbd>N</kbd></span>
          </button>
        )}
        <button className="btn btn-ghost" onClick={handleNewExam} style={{ minWidth: '160px' }}>
          New Exam
          <span className="kbd-hint"><kbd>Esc</kbd></span>
        </button>
      </div>
    </div>
  );
}