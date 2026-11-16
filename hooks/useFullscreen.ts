import { useCallback, useRef, useEffect, useState } from 'react';

export function useFullscreen() {
  const elementRef = useRef<HTMLElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const enterFullscreen = useCallback(async (element?: HTMLElement) => {
    if (typeof document === 'undefined') return;
    const el = element || elementRef.current || document.documentElement;
    if (!document.fullscreenElement) {
      try {
        await el.requestFullscreen();
        setIsFullscreen(true);
      } catch (e) {
        console.warn('Fullscreen request failed:', e);
      }
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch (e) {
        console.warn('Exit fullscreen failed:', e);
      }
    }
  }, []);

  const toggleFullscreen = useCallback(async (element?: HTMLElement) => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      await exitFullscreen();
    } else {
      await enterFullscreen(element);
    }
  }, [enterFullscreen, exitFullscreen]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setIsFullscreen(document.fullscreenElement !== null);
    }
  }, []);

  return { enterFullscreen, exitFullscreen, toggleFullscreen, isFullscreen, elementRef };
}