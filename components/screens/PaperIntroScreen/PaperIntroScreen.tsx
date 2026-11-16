'use client';

import { useEffect, useState } from 'react';
import { useExamStore } from '@/store/examStore';
import { fmtHms } from '@/lib/time';
import { useDeadlineTicker } from '@/hooks/useDeadlineTicker';

export function PaperIntroScreen() {
  const exam = useExamStore(s => s.exam);
  const progress = useExamStore(s => s.progress);
  const startPaper = useExamStore(s => s.startPaper);
  const [endTime, setEndTime] = useState<string>('');
  const paperTimer = progress?.paperTimer ?? null;
  const { remainingMs } = useDeadlineTicker(paperTimer, () => {});

  useEffect(() => {
    if (!paperTimer) return;
    const endAt = new Date(Date.now() + (paperTimer.paused ? paperTimer.remainingMs : remainingMs));
    setEndTime(endAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }, [paperTimer, remainingMs]);

  if (!exam || !paperTimer) return null;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '4rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', marginBottom: '1rem' }}>Section A Complete</h1>
      <p style={{ fontSize: 'clamp(1.125rem, 2.5vw, 1.5rem)', color: 'var(--muted)', marginBottom: '3rem' }}>
        Hand out Section B & C papers to students.
      </p>

      <div className="card" style={{ display: 'inline-block', textAlign: 'left', maxWidth: '500px', marginBottom: '2rem' }}>
        <h3 className="mb-4" style={{ textAlign: 'center' }}>Timing</h3>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Section A time:</span>
            <strong>{exam.config.totalMcqMinutes} min</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Section B & C time:</span>
            <strong>{exam.config.paperDurationMinutes} min</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Time remaining:</span>
            <strong className="timer-normal">{fmtHms(Math.ceil(remainingMs / 1000))}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Would end at:</span>
            <strong>{endTime}</strong>
          </div>
        </div>
      </div>

      <button className="btn btn-primary" onClick={startPaper} style={{ padding: '1rem 2rem', fontSize: '1.25rem', minWidth: '280px' }}>
        Start Section B & C →
        <span className="kbd-hint"><kbd>Enter</kbd></span>
      </button>

      <div>
        <button
          className="btn btn-ghost"
          onClick={() => useExamStore.getState().finishExam()}
          style={{ marginTop: '1.5rem' }}
        >
          ← End exam
        </button>
      </div>
    </div>
  );
}