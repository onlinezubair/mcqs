'use client';

import { useEffect, useRef } from 'react';
import { useExamStore } from '@/store/examStore';
import { FloatingTimer } from '@/components/Countdown/FloatingTimer';
import { getTimerPhase, getSlideTheme, elapsedRatio, quarterMilestonesCrossed } from '@/lib/timerTheme';
import { getLockstepSlideColumns, getSlideCount, getLockstepCount } from '@/lib/lockstep';
import { escapeHtml } from '@/lib/escape';
import { useDeadlineTicker } from '@/hooks/useDeadlineTicker';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useBeep } from '@/hooks/useBeep';
import { FontScaleApplier } from '@/components/FontScaleApplier/FontScaleApplier';

export function SlideshowScreen() {
  const { exam, progress, nextSlide, prevSlide, finishExam, adjustPerSlide, blankScreen, showShortcuts } = useExamStore();
  const { playWarningBeep, playCriticalBeep, playAdvanceBeep, playQuarterBeep, playNewQuestionCue } = useBeep();
  const { requestWakeLock } = useWakeLock();
  const { toggleFullscreen } = useFullscreen();

  const lastPhaseRef = useRef<'normal' | 'warning' | 'danger' | 'critical'>('normal');
  const lastElapsedRef = useRef(0);
  const slideIdRef = useRef<string>('');

  const slideTimer = progress?.slideTimer;
  const questionsPerSlide = exam?.config.questionsPerSlide ?? 4;

  useKeyboardShortcuts();
  const { remainingMs } = useDeadlineTicker(slideTimer, () => {
    playAdvanceBeep();
    const slideCount = getSlideCount(exam!, questionsPerSlide);
    if (progress && progress.slideIndex + 1 >= slideCount) {
      finishExam();
    } else {
      nextSlide();
    }
  });

  useEffect(() => {
    requestWakeLock();
  }, [requestWakeLock]);

  const phase = slideTimer ? getTimerPhase(remainingMs, slideTimer.totalMs, 'slide') : { phase: 'normal' as const, isPulse: false };
  const slideTheme = slideTimer
    ? getSlideTheme(remainingMs, slideTimer.totalMs)
    : getSlideTheme(1, 1);

  useEffect(() => {
    if (phase.phase === 'warning' && lastPhaseRef.current === 'normal') {
      playWarningBeep();
    } else if (phase.phase === 'danger' && lastPhaseRef.current !== 'danger') {
      playCriticalBeep();
    }
    lastPhaseRef.current = phase.phase;
  }, [phase.phase, playWarningBeep, playCriticalBeep]);

  const slideId = progress ? `${progress.activeSetIndex}:${progress.slideIndex}` : '';
  useEffect(() => {
    if (!slideId || slideId === slideIdRef.current) return;
    slideIdRef.current = slideId;
    lastElapsedRef.current = 0;
    playNewQuestionCue();
  }, [slideId, playNewQuestionCue]);

  useEffect(() => {
    if (!slideTimer || slideTimer.paused) return;
    const ratio = elapsedRatio(remainingMs, slideTimer.totalMs);
    const crossed = quarterMilestonesCrossed(lastElapsedRef.current, ratio);
    lastElapsedRef.current = Math.max(lastElapsedRef.current, ratio);
    for (const milestone of crossed) {
      playQuarterBeep(milestone);
    }
  }, [remainingMs, slideTimer, playQuarterBeep]);

  if (!exam || !progress || !slideTimer) return null;
  const positionCount = getLockstepCount(exam);
  if (positionCount === 0) return null;
  const slideCount = getSlideCount(exam, questionsPerSlide);
  const slideColumns = getLockstepSlideColumns(exam, progress.slideIndex, questionsPerSlide);
  if (slideColumns.every(col => col.questions.every(q => !q))) return null;

  const startQ = progress.slideIndex * questionsPerSlide + 1;
  const endQ = Math.min(startQ + questionsPerSlide - 1, positionCount);

  return (
    <>
      <FontScaleApplier />
      <div
        data-quarter={slideTheme.quarter}
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: slideTheme.background,
          color: slideTheme.ink,
          transition: 'background-color 0.8s ease, color 0.4s ease',
          ['--bg' as string]: slideTheme.background,
          ['--fg' as string]: slideTheme.ink,
          ['--muted' as string]: slideTheme.muted,
          ['--border' as string]: slideTheme.border,
          ['--card-bg' as string]: slideTheme.surface,
          ['--option-bg' as string]: slideTheme.surface,
          ['--option-hover' as string]: slideTheme.background,
          ['--timer-normal' as string]: slideTheme.timerNormal,
          ['--timer-warning' as string]: slideTheme.timerWarning,
          ['--timer-danger' as string]: slideTheme.timerDanger,
          ['--timer-critical' as string]: slideTheme.timerCritical,
        }}
      >
        <div style={{ height: '8px', background: slideTheme.border, position: 'relative', overflow: 'hidden' }}>
          <div
            className={`progress-bar-fill ${phase.phase}`}
            style={{ width: `${slideTimer.totalMs > 0 ? (1 - remainingMs / slideTimer.totalMs) * 100 : 0}%` }}
          />
        </div>

        {blankScreen && (
          <div className="blank-screen-overlay">
            <span>Screen Blanked — Press B to restore</span>
          </div>
        )}

        {!blankScreen && <FloatingTimer timer={slideTimer} label="Time remaining" />}

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0.75rem 1.5rem 0.5rem', margin: '0 auto', width: '100%', minHeight: 0, overflow: 'hidden' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
              <strong style={{ fontSize: '0.9rem' }}>
                Questions {startQ}–{endQ} of {positionCount} (Slide {progress.slideIndex + 1} of {slideCount})
              </strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                {exam.sets.length} {exam.sets.length === 1 ? 'set' : 'sets'} · {questionsPerSlide}/slide · Set {exam.sets.map(s => s.letter).join(' / ')}
              </span>
              <span className="seed-badge" title="Re-running with this seed reproduces the exact same question and option order">
                Seed <code>{exam.config.seed}</code>
              </span>
            </div>
            <button
              className="btn btn-ghost"
              onClick={() => finishExam()}
              style={{ fontSize: '0.8rem' }}
            >
              End Exam →
            </button>
          </header>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: `repeat(${exam.sets.length}, minmax(0, 1fr))`,
              gap: '1.25rem',
              overflow: 'auto',
              alignItems: 'flex-start',
            }}
          >
            {slideColumns.map(({ set, questions, optionsList, displayNumbers }) => (
              <section
                key={set.letter}
                style={{
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  borderLeft: '1px dashed var(--border)',
                  paddingLeft: '1rem',
                }}
              >
                <div
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                    marginBottom: '0.5rem',
                  }}
                >
                  Set {set.letter}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {questions.map((question, qIdx) => {
                    const options = optionsList[qIdx];
                    const displayNumber = displayNumbers[qIdx];
                    return question && options ? (
                      <article key={displayNumber} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <p style={{ fontSize: 'calc(clamp(0.9rem, 1.8vw, 1.3rem) * var(--font-scale))', fontWeight: 600, lineHeight: 1.35, margin: 0 }}>
                          <span style={{ marginRight: '0.4rem' }}>{displayNumber}.</span>
                          {question.groupStem && (
                            <em style={{ display: 'block', fontWeight: 400, fontSize: '0.85em', color: 'var(--muted)', marginBottom: '0.2rem' }}>
                              {escapeHtml(question.groupStem)}
                            </em>
                          )}
                          {escapeHtml(question.text)}
                        </p>

                        <ol style={{ listStyle: 'none', paddingLeft: 0, display: 'grid', gap: '0.3rem', margin: 0 }}>
                          {options.map((opt, i) => (
                            <li
                              key={i}
                              style={{
                                fontSize: 'calc(clamp(0.8rem, 1.5vw, 1.1rem) * var(--font-scale))',
                                lineHeight: 1.35,
                                padding: '0.4rem 0.5rem',
                                background: 'var(--option-bg)',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                              }}
                            >
                              <strong style={{ marginRight: '0.35rem' }}>{'ABCD'[i]})</strong>
                              {escapeHtml(opt)}
                            </li>
                          ))}
                        </ol>
                      </article>
                    ) : (
                      <p key={displayNumber} style={{ color: 'var(--muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                        Question {displayNumber}: No more questions in this set.
                      </p>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border)', fontSize: '0.72rem', color: 'var(--muted)', flexShrink: 0, flexWrap: 'wrap' }}>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              P / Space: Pause | ←/→: Prev/Next | +: Font up | -: Font down | *: More/slide | /: Fewer/slide | F: Fullscreen | B: Blank | ?: Help
            </span>
            <span style={{ whiteSpace: 'nowrap' }}>Drag the timer to move it</span>
          </footer>
        </main>

        {showShortcuts && (
          <div className="modal-overlay" onClick={() => useExamStore.getState().setShowShortcuts(false)}>
            <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
              <h2 className="mb-4">Keyboard Shortcuts</h2>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 2 }}>
{`Space / → / PageDown: Next slide
← / PageUp: Previous slide
P: Pause / Resume
+ / =: Increase font scale
- / _: Decrease font scale
*: Increase questions per slide
/: Decrease questions per slide
F: Toggle fullscreen
B: Blank screen
Home / End: Jump to first/last (with confirmation)
?: Show this help`}
              </pre>
              <button className="btn btn-primary mt-4" onClick={() => useExamStore.getState().setShowShortcuts(false)}>Close</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}