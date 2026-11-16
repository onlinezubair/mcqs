import { useEffect, useRef } from 'react';
import { useExamStore } from '@/store/examStore';

const HEARTBEAT_KEY = 'mcqProjector_hb';
const CHANNEL_NAME = 'mcq-projector';

export function useTabLock() {
  const { screen, progress, writeHeartbeat } = useExamStore();
  const channelRef = useRef<BroadcastChannel | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const myTabIdRef = useRef<string>('');

  useEffect(() => {
    const isActive = screen === 'exam' || screen === 'paperIntro' || screen === 'paper';

    if (isActive) {
      myTabIdRef.current = Math.random().toString(36).substring(2, 10);

      try {
        channelRef.current = new BroadcastChannel(CHANNEL_NAME);
        channelRef.current.onmessage = (event) => {
          if (event.data === 'takeover') {
            alert('Another window has taken control of this exam. This window will stop updating.');
            if (intervalRef.current) clearInterval(intervalRef.current);
          }
        };
      } catch {
        // BroadcastChannel not supported
      }

      writeHeartbeat();
      intervalRef.current = setInterval(() => writeHeartbeat(), 5000);

      const handleStorage = (e: StorageEvent) => {
        if (e.key === HEARTBEAT_KEY && e.newValue) {
          try {
            const { tabId, at } = JSON.parse(e.newValue);
            if (tabId !== myTabIdRef.current && Date.now() - at < 10000) {
              if (confirm('Another window is controlling this exam. Take over?')) {
                channelRef.current?.postMessage('takeover');
                writeHeartbeat();
              }
            }
          } catch {
            // ignore
          }
        }
      };

      window.addEventListener('storage', handleStorage);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        channelRef.current?.close();
        window.removeEventListener('storage', handleStorage);
      };
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      channelRef.current?.close();
    }
  }, [screen, writeHeartbeat]);
}