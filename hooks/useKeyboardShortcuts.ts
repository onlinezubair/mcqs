'use client';

import { useEffect } from 'react';
import { useExamStore } from '@/store/examStore';
import { useFullscreen } from './useFullscreen';
import { getSlideCount } from '@/lib/lockstep';

export function useKeyboardShortcuts() {
  const nextSlide = useExamStore(s => s.nextSlide);
  const prevSlide = useExamStore(s => s.prevSlide);
  const pauseResume = useExamStore(s => s.pauseResume);
  const finishExam = useExamStore(s => s.finishExam);
  const adjustPerSlide = useExamStore(s => s.adjustPerSlide);
  const startSlide = useExamStore(s => s.startSlide);
  const setFontScale = useExamStore(s => s.setFontScale);
  const { toggleFullscreen } = useFullscreen();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const activeElement = document.activeElement;
      const isInput = activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable);

      if (isInput) return;
      if (e.repeat) return;

      const state = useExamStore.getState();
      const { exam, progress, prefs } = state;
      if (!exam || !progress) return;

      switch (e.key) {
        case '?': {
          e.preventDefault();
          state.setShowShortcuts?.(true);
          break;
        }
        case 'b':
        case 'B': {
          e.preventDefault();
          state.toggleBlank?.();
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
          adjustPerSlide(1);
          break;
        }
        case '/': {
          e.preventDefault();
          adjustPerSlide(-1);
          break;
        }
        case ' ':
        case 'ArrowRight':
        case 'PageDown': {
          e.preventDefault();
          const slideCount = getSlideCount(exam, exam.config.questionsPerSlide ?? 4);
          if (progress.slideIndex + 1 >= slideCount) {
            finishExam();
          } else {
            nextSlide();
          }
          break;
        }
        case 'ArrowLeft':
        case 'PageUp': {
          e.preventDefault();
          if (progress.slideIndex > 0) {
            prevSlide();
          }
          break;
        }
        case 'p':
        case 'P': {
          e.preventDefault();
          pauseResume();
          break;
        }
        case '+':
        case '=': {
          e.preventDefault();
          const currentScale = prefs.fontScale;
          setFontScale(Math.min(1.5, Math.round((currentScale + 0.05) * 100) / 100));
          break;
        }
        case '-':
        case '_': {
          e.preventDefault();
          const currentScale = prefs.fontScale;
          setFontScale(Math.max(0.8, Math.round((currentScale - 0.05) * 100) / 100));
          break;
        }
        case 'Home':
        case 'End': {
          e.preventDefault();
          if (confirm('Jump to first/last slide? This cannot be undone.')) {
            if (e.key === 'Home') {
              startSlide(progress.activeSetIndex, 0);
            } else {
              const slideCount = getSlideCount(exam, exam.config.questionsPerSlide ?? 4);
              startSlide(progress.activeSetIndex, slideCount - 1);
            }
          }
          break;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide, pauseResume, finishExam, adjustPerSlide, startSlide, setFontScale, toggleFullscreen]);
}
