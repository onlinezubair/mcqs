'use client';

import { useEffect, useRef, useState } from 'react';
import { useExamStore } from '@/store/examStore';
import { MetaScreen } from '@/components/screens/MetaScreen/MetaScreen';
import { SetupScreen } from '@/components/screens/SetupScreen/SetupScreen';
import { ReviewScreen } from '@/components/screens/ReviewScreen/ReviewScreen';
import { CalibrateScreen } from '@/components/screens/CalibrateScreen/CalibrateScreen';
import { SlideshowScreen } from '@/components/screens/SlideshowScreen/SlideshowScreen';
import { PaperIntroScreen } from '@/components/screens/PaperIntroScreen/PaperIntroScreen';
import { PaperScreen } from '@/components/screens/PaperScreen/PaperScreen';
import { EndScreen } from '@/components/screens/EndScreen/EndScreen';
import { ResumeDialog } from '@/components/ResumeDialog/ResumeDialog';
import { ConfirmDialogProvider } from '@/components/ConfirmDialog/ConfirmDialog';
import { ToastProvider } from '@/components/Toast/Toast';
import { useBeforeUnloadGuard } from '@/hooks/useBeforeUnloadGuard';
import { useTabLock } from '@/hooks/useTabLock';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { useClockGuard } from '@/hooks/useClockGuard';
import { AuthGate } from '@/components/AuthGate/AuthGate';

const RESUMABLE_SCREENS = new Set(['exam', 'paperIntro', 'paper']);

// These screens are projected to students and must fill the viewport without
// the reading-width container used by the teacher's setup screens.
const FULLSCREEN_SCREENS = new Set(['exam', 'paper']);

function AppShell() {
  const screen = useExamStore(s => s.screen);
  const hydrate = useExamStore(s => s.hydrate);
  const resetStore = useExamStore(s => s.resetStore);
  const initCloud = useExamStore(s => s.initCloud);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const hydratedRef = useRef(false);

  useBeforeUnloadGuard(screen);
  useTabLock();
  useServiceWorker();
  useClockGuard();

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    let hadSavedExam = false;
    try {
      const raw = localStorage.getItem('mcq-projector-storage');
      if (raw) {
        const parsed = JSON.parse(raw);
        hadSavedExam = RESUMABLE_SCREENS.has(parsed?.state?.screen);
      }
    } catch {
      hadSavedExam = false;
    }

    hydrate();
    initCloud();
    if (hadSavedExam) setShowResumeDialog(true);
  }, [hydrate, initCloud]);

  const screens = {
    meta: <MetaScreen />,
    setup: <SetupScreen />,
    review: <ReviewScreen />,
    calibrate: <CalibrateScreen />,
    exam: <SlideshowScreen />,
    paperIntro: <PaperIntroScreen />,
    paper: <PaperScreen />,
    end: <EndScreen />,
  };

  return (
    <>
      {showResumeDialog && (
        <ResumeDialog
          onDiscard={() => {
            setShowResumeDialog(false);
            resetStore();
          }}
          onDownload={() => {}}
          onClose={() => setShowResumeDialog(false)}
        />
      )}
      <main
        className={FULLSCREEN_SCREENS.has(screen) ? 'container container--fullscreen' : 'container'}
        style={
          FULLSCREEN_SCREENS.has(screen)
            ? { minHeight: '100vh' }
            : { paddingTop: '1rem', paddingBottom: '2rem', minHeight: '100vh' }
        }
      >
        <AuthGate>{screens[screen] ?? null}</AuthGate>
      </main>
    </>
  );
}

export function ExamApp() {
  return (
    <ConfirmDialogProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </ConfirmDialogProvider>
  );
}
