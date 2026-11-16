'use client';

import { useEffect } from 'react';
import { useExamStore } from '@/store/examStore';

export function FontScaleApplier() {
  const fontScale = useExamStore(s => s.prefs.fontScale);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(fontScale));
  }, [fontScale]);

  return null;
}