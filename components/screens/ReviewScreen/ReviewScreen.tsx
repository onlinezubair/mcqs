'use client';

import { useEffect, useState } from 'react';
import { useExamStore } from '@/store/examStore';
import { escapeHtml } from '@/lib/escape';
import { useConfirm } from '@/components/ConfirmDialog/ConfirmDialog';
import { useBeep } from '@/hooks/useBeep';
import { ExportsPanel } from '@/components/ExportsPanel/ExportsPanel';

const NEON_GREEN = '#39ff14';

export function ReviewScreen() {
  const { exam, draft, config, unlockToSetup, transition } = useExamStore();
  const { confirm } = useConfirm();
  const { playBackupCue } = useBeep();
  const [showAnswers, setShowAnswers] = useState(false);
  const [autoHideTimer, setAutoHideTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Arriving here means the sets were just locked and exist nowhere except
  // this tab until the ZIP is downloaded — announce that once.
  useEffect(() => {
    playBackupCue();
  }, [playBackupCue]);

  if (!exam) return null;

  const handleEdit = () => {
    confirm('Editing will rebuild all sets. Continue?', () => {
      unlockToSetup();
      transition('setup');
    }, { variant: 'danger', confirmText: 'Yes, edit' });
  };

  const handleStartCalibrate = () => {
    transition('calibrate');
  };

  const toggleAnswers = () => {
    const newShow = !showAnswers;
    setShowAnswers(newShow);
    if (autoHideTimer) clearTimeout(autoHideTimer);
    if (newShow) {
      setAutoHideTimer(setTimeout(() => setShowAnswers(false), 30000));
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Review Exam</h1>
          <span className="seed-badge" title="Re-running with this seed reproduces the exact same question and option order">
            Seed <code>{exam.config.seed}</code>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost" onClick={handleEdit}>
            Edit
            <span className="kbd-hint"><kbd>E</kbd></span>
          </button>
        </div>
      </header>

      <ExportsPanel exam={exam} emphasizeBackup />

      {exam.sectionB.length > 0 && (
        <div className="card mb-4">
          <h3 className="mb-2">Section B (Short Questions)</h3>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {exam.sectionB.map(q => (
              <div key={q.number} className="p-4" style={{ background: 'var(--bg)', borderRadius: '4px' }}>
                <p style={{ fontWeight: 600 }}>
                  Q{q.number}. {escapeHtml(q.text)}
                  {q.marks && <span style={{ color: NEON_GREEN, marginLeft: '0.5rem', fontWeight: 600 }}>[ {q.marks} marks ]</span>}
                </p>
                <ol style={{ listStyle: 'lower-roman', paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
                  {q.parts.map(p => (
                    <li key={p.label} style={{ marginBottom: '0.25rem' }}>
                      {escapeHtml(p.text)}
                      {p.marks && <span style={{ color: NEON_GREEN, marginLeft: '0.5rem', fontWeight: 600 }}>[ {p.marks} marks ]</span>}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      )}

      {exam.sectionC.length > 0 && (
        <div className="card mb-4">
          <h3 className="mb-2">Section C (Long Questions)</h3>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {exam.sectionC.map(q => (
              <div key={q.number} className="p-4" style={{ background: 'var(--bg)', borderRadius: '4px' }}>
                <p style={{ fontWeight: 600 }}>
                  Q{q.number}. {escapeHtml(q.text)}
                  {q.marks && <span style={{ color: NEON_GREEN, marginLeft: '0.5rem', fontWeight: 600 }}>[ {q.marks} marks ]</span>}
                </p>
                <ol style={{ listStyle: 'lower-roman', paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
                  {q.parts.map(p => (
                    <li key={p.label} style={{ marginBottom: '0.25rem' }}>
                      {escapeHtml(p.text)}
                      {p.marks && <span style={{ color: NEON_GREEN, marginLeft: '0.5rem', fontWeight: 600 }}>[ {p.marks} marks ]</span>}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAnswers && (
        <div className="card mb-4" style={{ borderColor: 'var(--danger)', background: 'rgba(255, 107, 107, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--danger)' }}>⚠️ Answer Key Revealed — Auto-hides in 30s</h3>
            <button className="btn btn-ghost" onClick={toggleAnswers}>Hide</button>
          </div>
          <p style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: '1rem' }}>
            Is your display mirrored? Answers are visible on screen.
          </p>
          {exam.sets.map(set => (
            <details key={set.letter} style={{ marginBottom: '1rem' }}>
              <summary style={{ fontWeight: 600, cursor: 'pointer' }}>Set {set.letter} Answers</summary>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Q#</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Question</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem' }}>Answer</th>
                  </tr>
                </thead>
                <tbody>
                  {set.questionIds.map((qid, i) => {
                    const q = exam.pool.find(p => p.id === qid);
                    if (!q) return null;
                    const perm = set.optionOrder?.[i];
                    const answerLetter = perm ? 'ABCD'[perm.indexOf(q.answer)] : 'ABCD'[q.answer];
                    return (
                      <tr key={qid} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.5rem' }}>{i + 1}</td>
                        <td style={{ padding: '0.5rem' }}>{escapeHtml(q.text).slice(0, 80)}...</td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700, fontSize: '1.25rem', color: 'var(--danger)' }}>{answerLetter}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </details>
          ))}
        </div>
      )}

      <div className="card mb-4">
        <h3 className="mb-2">Before you project</h3>
        <ul style={{ paddingLeft: '1.5rem', color: 'var(--muted)' }}>
          <li>The seed above rebuilds this exact shuffle on any future run.</li>
          <li>Options that depend on each other (&quot;all of the above&quot;) keep their original order.</li>
          <li>Run <strong>Calibrate</strong> next to check every question fits the room display.</li>
        </ul>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
        <button className="btn btn-ghost" onClick={handleEdit}>
          ← Edit
          <span className="kbd-hint"><kbd>E</kbd></span>
        </button>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost" onClick={toggleAnswers}>
            {showAnswers ? 'Hide Answers' : 'Reveal Answers'}
            <span className="kbd-hint"><kbd>A</kbd></span>
          </button>
          <button className="btn btn-primary" onClick={handleStartCalibrate} style={{ minWidth: '160px' }}>
            Calibrate →
            <span className="kbd-hint"><kbd>C</kbd></span>
          </button>
        </div>
      </div>
    </div>
  );
}