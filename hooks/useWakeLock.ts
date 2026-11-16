import { useState, useCallback, useEffect, useRef } from 'react';

export function useWakeLock() {
  const [supported, setSupported] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    setSupported('wakeLock' in navigator);
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (!supported) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      wakeLockRef.current.addEventListener('release', () => {
        wakeLockRef.current = null;
      });
    } catch (e) {
      console.warn('Wake lock failed:', e);
    }
  }, [supported]);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [requestWakeLock]);

  return { requestWakeLock, releaseWakeLock, supported };
}