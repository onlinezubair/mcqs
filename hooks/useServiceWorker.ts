'use client';

import { useEffect, useRef } from 'react';
import { useExamStore } from '@/store/examStore';
import { useToast } from '@/components/Toast/Toast';

const RESUMABLE = new Set(['exam', 'paperIntro', 'paper']);

export function useServiceWorker() {
  const { toast } = useToast();
  const screen = useExamStore(s => s.screen);
  const waitingRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const swUrl = `${basePath}/sw.js`;

    let cancelled = false;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register(swUrl, { scope: `${basePath}/` });

        if (reg.waiting) {
          waitingRef.current = reg.waiting;
          toast('Update ready — restart when the exam is not running', 'info', 0);
        }

        reg.addEventListener('updatefound', () => {
          const incoming = reg.installing;
          if (!incoming) return;
          incoming.addEventListener('statechange', () => {
            if (incoming.state === 'installed' && navigator.serviceWorker.controller && !cancelled) {
              waitingRef.current = incoming;
              toast('Update ready — restart when the exam is not running', 'info', 0);
            }
          });
        });
      } catch (err) {
        console.warn('Service worker registration failed:', err);
      }
    };

    void register();

    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    const waiting = waitingRef.current;
    if (!waiting) return;
    if (RESUMABLE.has(screen)) return;
    waiting.postMessage('skipWaiting');
    waitingRef.current = null;
  }, [screen]);
}
