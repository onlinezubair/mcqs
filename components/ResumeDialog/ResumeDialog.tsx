'use client';

import { useExamStore } from '@/store/examStore';
import { fmtHms } from '@/lib/time';
import { deadlineTimerRemaining } from '@/lib/deadlineTimer';

interface ResumeDialogProps {
  onDiscard: () => void;
  onDownload: () => void;
  onClose: () => void;
}

export function ResumeDialog({ onDiscard, onDownload, onClose }: ResumeDialogProps) {
  const screen = useExamStore(s => s.screen);
  const progress = useExamStore(s => s.progress);
  const savedAt = useExamStore(s => s.savedAt);
  const rehydrate = useExamStore(s => s.rehydrate);
  const transition = useExamStore(s => s.transition);

  const lastActive = savedAt ? new Date(savedAt).toLocaleTimeString() : 'unknown';
  const minutesAgo = savedAt ? Math.max(0, Math.round((Date.now() - savedAt) / 60000)) : 0;

  const remainingMs = progress?.slideTimer ? deadlineTimerRemaining(progress.slideTimer) : 0;
  const paperRemainingMs = progress?.paperTimer ? deadlineTimerRemaining(progress.paperTimer) : 0;

  const handleResume = () => {
    rehydrate();
    onClose();
  };

  const handleRealClock = () => {
    rehydrate();
    const state = useExamStore.getState();
    const st = state.progress?.slideTimer;
    if (st) {
      useExamStore.setState({
        progress: state.progress
          ? {
              ...state.progress,
              slideTimer: { ...st, endsAt: Date.now() + st.remainingMs, paused: false },
            }
          : null,
      });
    }
    if (screen) transition(screen);
    onClose();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="resume-title">
      <div className="modal" style={{ maxWidth: '500px' }}>
        <h2 id="resume-title" className="mb-4">Resume Exam?</h2>
        <p className="mb-4">An exam was in progress when you last closed this window.</p>
        <div className="card mb-4" style={{ padding: '1rem' }}>
          <p><strong>Screen:</strong> {screen}</p>
          <p><strong>Last active:</strong> {lastActive} ({minutesAgo} min ago)</p>
          {remainingMs > 0 && <p><strong>Time remaining (MCQ):</strong> {fmtHms(Math.ceil(remainingMs / 1000))}</p>}
          {paperRemainingMs > 0 && <p><strong>Time remaining (Paper):</strong> {fmtHms(Math.ceil(paperRemainingMs / 1000))}</p>}
        </div>
        <p className="mb-4 text-warning">
          By default, time lost while the app was closed is credited to students.
          Choose &quot;Use real clock&quot; to count actual elapsed time instead.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleResume}>Resume (paused)</button>
          <button className="btn" onClick={handleRealClock}>Use real clock</button>
          <button className="btn btn-ghost" onClick={onDownload}>Download backup JSON</button>
          <button className="btn btn-danger" onClick={onDiscard}>Discard &amp; start fresh</button>
        </div>
      </div>
    </div>
  );
}
