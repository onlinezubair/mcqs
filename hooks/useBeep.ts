import { useRef, useCallback } from 'react';
import { useExamStore } from '@/store/examStore';

export function useBeep() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const { prefs } = useExamStore();

  const ensureAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  // Schedules one tone relative to the audio clock, so a multi-beep cue stays
  // rhythmically exact even if the main thread is busy rendering slides.
  const scheduleTone = useCallback(
    (ctx: AudioContext, frequency: number, duration: number, delay: number, volume: number) => {
      const startAt = ctx.currentTime + delay;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;

      // Short fade in/out removes the click otherwise heard at both ends.
      const fade = Math.min(0.015, duration / 1000 / 2);
      gainNode.gain.setValueAtTime(0, startAt);
      gainNode.gain.linearRampToValueAtTime(volume, startAt + fade);
      gainNode.gain.setValueAtTime(volume, startAt + duration / 1000 - fade);
      gainNode.gain.linearRampToValueAtTime(0, startAt + duration / 1000);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(startAt);
      oscillator.stop(startAt + duration / 1000 + 0.01);
    },
    [],
  );

  const playTone = useCallback((frequency: number, duration: number, volume = 0.3) => {
    if (!prefs.soundEnabled) return;
    const ctx = ensureAudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    scheduleTone(ctx, frequency, duration, 0, volume);
  }, [ensureAudioContext, prefs.soundEnabled, scheduleTone]);

  // 1 / 2 / 3 short blips at a rising pitch, marking 25 / 50 / 75 % of the
  // question's time having elapsed.
  const playQuarterBeep = useCallback((count: 1 | 2 | 3) => {
    if (!prefs.soundEnabled) return;
    const ctx = ensureAudioContext();
    if (ctx.state === 'suspended') void ctx.resume();

    const frequency = count === 1 ? 740 : count === 2 ? 830 : 920;
    const gap = 0.18;
    for (let i = 0; i < count; i++) {
      scheduleTone(ctx, frequency, 110, i * gap, 0.35);
    }
  }, [ensureAudioContext, prefs.soundEnabled, scheduleTone]);

  // Gentle two-note "here is the next question" chime.
  const playNewQuestionCue = useCallback(() => {
    if (!prefs.soundEnabled) return;
    const ctx = ensureAudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    scheduleTone(ctx, 587.33, 130, 0, 0.28);
    scheduleTone(ctx, 880, 180, 0.14, 0.28);
  }, [ensureAudioContext, prefs.soundEnabled, scheduleTone]);

  const playWarningBeep = useCallback(() => playTone(880, 200, 0.4), [playTone]);
  const playCriticalBeep = useCallback(() => playTone(1320, 150, 0.5), [playTone]);
  const playAdvanceBeep = useCallback(() => playTone(660, 100, 0.3), [playTone]);

  // Insistent rising three-note chime that draws attention to an unrecoverable
  // action (e.g. "download the locked exam before it can be lost").
  const playBackupCue = useCallback(() => {
    if (!prefs.soundEnabled) return;
    const ctx = ensureAudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    scheduleTone(ctx, 523.25, 140, 0, 0.32);
    scheduleTone(ctx, 659.25, 140, 0.18, 0.32);
    scheduleTone(ctx, 783.99, 220, 0.36, 0.32);
  }, [ensureAudioContext, prefs.soundEnabled, scheduleTone]);

  return {
    playWarningBeep,
    playCriticalBeep,
    playAdvanceBeep,
    playQuarterBeep,
    playNewQuestionCue,
    playBackupCue,
  };
}
