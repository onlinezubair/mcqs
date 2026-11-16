import { useEffect } from 'react';

export function useBeforeUnloadGuard(screen: string) {
  useEffect(() => {
    const isActive = screen === 'exam' || screen === 'paperIntro' || screen === 'paper';

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isActive) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [screen]);
}