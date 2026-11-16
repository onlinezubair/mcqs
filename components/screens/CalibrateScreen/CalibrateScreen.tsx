'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useExamStore } from '@/store/examStore';
import { getLockstepSlideColumns, getSlideCount, getLockstepCount } from '@/lib/lockstep';
import { getSlideTheme } from '@/lib/timerTheme';
import { escapeHtml } from '@/lib/escape';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useBeep } from '@/hooks/useBeep';
import { demoQuestions } from '@/lib/demoQuestions';
import { buildSets } from '@/lib/shuffle';
import { FontScaleApplier } from '@/components/FontScaleApplier/FontScaleApplier';

export function CalibrateScreen() {
  const { prefs, setFontScale, setConfig, config, transition } = useExamStore();
  const { toggleFullscreen } = useFullscreen();
  const { playAdvanceBeep } = useBeep();

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [blankScreen, setBlankScreen] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [questionsPerSlide, setQuestionsPerSlide] = useState(config.questionsPerSlide ?? 4);

  const measureRef = useRef<HTMLDivElement>(null);

  const buildMockExam = useCallback(() => {
    const sets = buildSets(demoQuestions, { ...config, questionsPerSlide, numSets: config.numSets, questionsPerSet: demoQuestions.length });
    return {
      id: 'calibrate-mock',
      createdAt: Date.now(),
      meta: {
        program: 'Demo',
        semester: '1',
        subject: 'Calibration',
        subjectCode: 'CAL',
        subjectFullName: 'Calibration Subject',
        subjectMode: 'Theory',
        examName: 'Calibration',
        quizNumber: 1,
        date: new Date().toISOString().split('T')[0],
        dateManuallySet: false,
      },
      config: { ...config, questionsPerSlide },
      pool: demoQuestions,
      sets,
      sectionB: [],
      sectionC: [],
    } as const;
  }, [config, questionsPerSlide]);

  const exam = buildMockExam();
  const positionCount = getLockstepCount(exam);
  const slideCount = getSlideCount(exam, questionsPerSlide);
  const slideColumns = getLockstepSlideColumns(exam, slideIndex, questionsPerSlide);
  const startQ = slideIndex * questionsPerSlide + 1;
  const endQ = Math.min(startQ + questionsPerSlide - 1, positionCount);

  // Calibration uses the same projected palette as the real exam (the first
  // quarter theme), so what the teacher previews is exactly what students see.
  const slideTheme = getSlideTheme(1, 1);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const activeElement = document.activeElement;
      const isInput = activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable);

      if (isInput) return;
      if (e.repeat) return;

      switch (e.key) {
        case '?': {
          e.preventDefault();
          setShowShortcuts(true);
          break;
        }
        case 'b':
        case 'B': {
          e.preventDefault();
          setBlankScreen(b => !b);
          break;
        }
        case 'f':
        case 'F': {
          e.preventDefault();
          toggleFullscreen();
          break;
        }
        case '*': {
          e.preventDefault();
          setQuestionsPerSlide(q => Math.min(6, q + 1));
          break;
        }
        case '/': {
          e.preventDefault();
          setQuestionsPerSlide(q => Math.max(2, q - 1));
          break;
        }
        case '+':
        case '=': {
          e.preventDefault();
          const current = useExamStore.getState().prefs.fontScale;
          setFontScale(Math.min(1.5, Math.round((current + 0.05) * 100) / 100));
          break;
        }
        case '-':
        case '_': {
          e.preventDefault();
          const current = useExamStore.getState().prefs.fontScale;
          setFontScale(Math.max(0.8, Math.round((current - 0.05) * 100) / 100));
          break;
        }
        case 'Escape': {
          e.preventDefault();
          transition('review');
          break;
        }
        case 'ArrowRight':
        case 'PageDown':
        case ' ': {
          e.preventDefault();
          setSlideIndex(i => Math.min(slideCount - 1, i + 1));
          break;
        }
        case 'ArrowLeft':
        case 'PageUp': {
          e.preventDefault();
          setSlideIndex(i => Math.max(0, i - 1));
          break;
        }
        case 'Home': {
          e.preventDefault();
          setSlideIndex(0);
          break;
        }
        case 'End': {
          e.preventDefault();
          setSlideIndex(slideCount - 1);
          break;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFullscreen, slideCount, setFontScale, setQuestionsPerSlide, transition]);

  const handleStartExam = () => {
    playAdvanceBeep();
    setConfig({ questionsPerSlide });
    // The exam was locked earlier with the original questions-per-slide, so
    // push the calibration choice onto the locked exam before starting.
    useExamStore.setState(state =>
      state.exam
        ? { exam: { ...state.exam, config: { ...state.exam.config, questionsPerSlide } } }
        : {}
    );
    transition('exam');
  };

  const handleBack = () => {
    transition('review');
  };

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
            className="progress-bar-fill normal"
            style={{ width: `${slideCount > 0 ? ((slideIndex + 1) / slideCount) * 100 : 0}%` }}
          />
        </div>

        {blankScreen && (
          <div className="blank-screen-overlay">
            <span>Screen Blanked — Press B to restore</span>
          </div>
        )}

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0.75rem 1.5rem 0.5rem', margin: '0 auto', width: '100%', minHeight: 0, overflow: 'hidden' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
              <strong style={{ fontSize: '0.9rem' }}>
                Calibration Preview — Questions {startQ}–{endQ} of {positionCount} (Slide {slideIndex + 1} of {slideCount})
              </strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                {exam.sets.length} {exam.sets.length === 1 ? 'set' : 'sets'} · {questionsPerSlide}/slide · Font: {Math.round(prefs.fontScale * 100)}%
              </span>
              <span className="seed-badge" title="Re-running with this seed reproduces the exact same question and option order">
                Seed <code>{exam.config.seed}</code>
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button className="btn btn-ghost" onClick={handleBack} style={{ fontSize: '0.8rem' }}>
                ← Back
              </button>
              <button className="btn btn-ghost" onClick={() => setShowShortcuts(true)} style={{ fontSize: '0.8rem' }}>
                ? Shortcuts
                <span className="kbd-hint"><kbd>?</kbd></span>
              </button>
              <button className="btn btn-primary" onClick={handleStartExam} style={{ minWidth: '160px' }}>
                Start Exam →
              </button>
            </div>
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
            ref={measureRef}
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
              Space/→: Next | ←: Prev | +: Font up | -: Font down | *: More/slide | /: Fewer/slide | F: Fullscreen | B: Blank | ?: Help | Esc: Back
            </span>
            <span style={{ whiteSpace: 'nowrap' }}>Calibration mode — settings apply on Start Exam</span>
          </footer>
        </main>

        {showShortcuts && (
          <div className="modal-overlay" onClick={() => setShowShortcuts(false)}>
            <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
              <h2 className="mb-4">Keyboard Shortcuts</h2>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 2 }}>
{`Space / → / PageDown: Next slide
← / PageUp: Previous slide
Home / End: First / Last slide
+ / =: Increase font scale
- / _: Decrease font scale
*: Increase questions per slide
/: Decrease questions per slide
F: Toggle fullscreen
B: Blank screen
Esc: Back to review
?: Show this help`}
              </pre>
              <button className="btn btn-primary mt-4" onClick={() => setShowShortcuts(false)}>Close</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
