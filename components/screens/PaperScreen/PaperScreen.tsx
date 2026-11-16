'use client';

import { useEffect, useState } from 'react';
import { useExamStore } from '@/store/examStore';
import { getTimerPhase } from '@/lib/timerTheme';
import { escapeHtml } from '@/lib/escape';
import { useDeadlineTicker } from '@/hooks/useDeadlineTicker';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useWakeLock } from '@/hooks/useWakeLock';
import { FloatingTimer } from '@/components/Countdown/FloatingTimer';

export function PaperScreen() {
  const exam = useExamStore(s => s.exam);
  const progress = useExamStore(s => s.progress);
  const config = useExamStore(s => s.draft.config);
  const pausePaper = useExamStore(s => s.pausePaper);
  const extendPaper = useExamStore(s => s.extendPaper);
  const finishExam = useExamStore(s => s.finishExam);
  const { requestWakeLock } = useWakeLock();
  const [focusMode, setFocusMode] = useState<'both' | 'B' | 'C'>('both');

  const paperTimer = progress?.paperTimer;

  useKeyboardShortcuts();
  const { remainingMs } = useDeadlineTicker(paperTimer, () => {
    finishExam();
  });

  useEffect(() => {
    requestWakeLock();
  }, [requestWakeLock]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.repeat) return;
      if (e.key === '1') {
        setFocusMode(m => (m === 'B' ? 'both' : 'B'));
      } else if (e.key === '2') {
        setFocusMode(m => (m === 'C' ? 'both' : 'C'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!exam || !paperTimer) return null;

  const endAt = new Date(Date.now() + remainingMs);

  const sectionBTotal = exam.sectionB.reduce((sum, q) => sum + (q.marks ?? 0), 0);
  const sectionCTotal = exam.sectionC.reduce((sum, q) => sum + (q.marks ?? 0), 0);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <FloatingTimer timer={paperTimer} kind="paper" label="Section B & C" />
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 2rem', borderBottom: '1px solid var(--border)', background: 'var(--card-bg)', minHeight: '56px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Ends at</span>
          <span style={{ fontSize: '1.05rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {endAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {config.allowPaperPause && (
            <button className="btn" onClick={pausePaper}>
              {paperTimer.paused ? 'Resume' : 'Pause'}
              <span className="kbd-hint"><kbd>Space</kbd></span>
            </button>
          )}
          <button className="btn" onClick={() => extendPaper(5)}>
            +5 min
            <span className="kbd-hint"><kbd>+</kbd></span>
          </button>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', padding: '1.5rem 2rem', overflow: 'auto', gap: '2rem' }}>
        {(focusMode === 'both' || focusMode === 'B') && (
          <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <header style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--accent)' }}>
              <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
                Section B
                <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--muted)' }}>
                  {exam.sectionB.length} questions · {sectionBTotal} marks
                </span>
              </h2>
            </header>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {exam.sectionB.map(q => (
                <div key={q.number} style={{ marginBottom: '1.5rem', pageBreakInside: 'avoid' }}>
                  <p style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '1.125rem' }}>
                    Q{q.number}. {escapeHtml(q.text)}{q.marks ? ` [${q.marks} marks]` : ''}
                  </p>
                  <ol style={{ listStyle: 'lower-roman', paddingLeft: '1.5rem', display: 'grid', gap: '0.5rem' }}>
                    {q.parts.map(p => (
                      <li key={p.label} style={{ fontSize: '1rem', lineHeight: 1.6 }}>
                        {escapeHtml(p.label)}. {escapeHtml(p.text)}{p.marks ? ` [${p.marks} marks]` : ''}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
              {exam.sectionB.length === 0 && (
                <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>No Section B questions</p>
              )}
            </div>
          </section>
        )}

        {(focusMode === 'both' || focusMode === 'C') && (
          <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <header style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--danger)' }}>
              <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
                Section C
                <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--muted)' }}>
                  {exam.sectionC.length} questions · {sectionCTotal} marks
                </span>
              </h2>
            </header>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {exam.sectionC.map(q => (
                <div key={q.number} style={{ marginBottom: '1.5rem', pageBreakInside: 'avoid' }}>
                  <p style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '1.125rem' }}>
                    Q{q.number}. {escapeHtml(q.text)}{q.marks ? ` [${q.marks} marks]` : ''}
                  </p>
                  <ol style={{ listStyle: 'lower-roman', paddingLeft: '1.5rem', display: 'grid', gap: '0.5rem' }}>
                    {q.parts.map(p => (
                      <li key={p.label} style={{ fontSize: '1rem', lineHeight: 1.6 }}>
                        {escapeHtml(p.label)}. {escapeHtml(p.text)}{p.marks ? ` [${p.marks} marks]` : ''}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
              {exam.sectionC.length === 0 && (
                <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>No Section C questions</p>
              )}
            </div>
          </section>
        )}
      </main>

      <footer style={{ padding: '0.6rem 2rem', borderTop: '1px solid var(--border)', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', fontSize: '0.8rem', color: 'var(--muted)', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span className="kbd-hint"><kbd>1</kbd> Focus B</span>
          <span className="kbd-hint"><kbd>2</kbd> Focus C</span>
          <span className="kbd-hint"><kbd>Space</kbd> Pause/Resume</span>
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost" onClick={() => useExamStore.getState().transition('paperIntro')}>
            ← Back
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirm('End exam?')) {
                finishExam();
              }
            }}
          >
            End Exam
            <span className="kbd-hint"><kbd>End</kbd></span>
          </button>
        </div>
      </footer>
    </div>
  );
}
