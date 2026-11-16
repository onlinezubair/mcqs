'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeadlineTimer } from '@/types';
import { deadlineTimerRemaining } from '@/lib/deadlineTimer';
import { getTimerPhase } from '@/lib/timerTheme';
import { fmtHms } from '@/lib/time';

const POSITION_KEY = 'mcqProjector_timerPos_v1';
const MARGIN = 12;
const DRAG_THRESHOLD = 3;

interface Point {
  x: number;
  y: number;
}

interface FloatingTimerProps {
  timer: DeadlineTimer | null | undefined;
  label?: string;
  kind?: 'slide' | 'paper';
}

function readStoredPosition(): Point | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Point>;
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null;
    if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return null;
    return { x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
}

function persistPosition(point: Point): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(POSITION_KEY, JSON.stringify(point));
  } catch {
    // Position is a convenience only — never break the exam over it.
  }
}

function clampToViewport(point: Point, width: number, height: number): Point {
  const maxX = Math.max(MARGIN, window.innerWidth - width - MARGIN);
  const maxY = Math.max(MARGIN, window.innerHeight - height - MARGIN);
  return {
    x: Math.min(Math.max(MARGIN, point.x), maxX),
    y: Math.min(Math.max(MARGIN, point.y), maxY),
  };
}

export function FloatingTimer({ timer, label = 'Time remaining', kind = 'slide' }: FloatingTimerProps) {
  const [remainingMs, setRemainingMs] = useState(() => (timer ? deadlineTimerRemaining(timer) : 0));
  const [position, setPosition] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);

  const boxRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef<Point>({ x: 0, y: 0 });
  const startPoint = useRef<Point>({ x: 0, y: 0 });
  const moved = useRef(false);

  // Keep the clock ticking off the deadline, so a throttled tab still shows
  // the real remaining time when it wakes up.
  useEffect(() => {
    if (!timer) {
      setRemainingMs(0);
      return;
    }
    setRemainingMs(deadlineTimerRemaining(timer));
    if (timer.paused) return;
    const id = setInterval(() => setRemainingMs(deadlineTimerRemaining(timer)), 250);
    return () => clearInterval(id);
  }, [timer, timer?.paused, timer?.endsAt, timer?.remainingMs]);

  // Default to the top-right corner; a stored position wins so the teacher's
  // chosen spot survives a refresh mid-exam.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const stored = readStoredPosition();
    const next = stored
      ? clampToViewport(stored, rect.width, rect.height)
      : { x: window.innerWidth - rect.width - MARGIN * 2, y: MARGIN * 2 };
    setPosition(next);
  }, []);

  // A resized window can leave the timer off-screen; pull it back in.
  useEffect(() => {
    const handleResize = () => {
      const box = boxRef.current;
      if (!box) return;
      const rect = box.getBoundingClientRect();
      setPosition(current => (current ? clampToViewport(current, rect.width, rect.height) : current));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    startPoint.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
    setDragging(true);
    // Capture so the drag keeps working when the pointer leaves the box.
    box.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      const box = boxRef.current;
      if (!box) return;
      const dx = e.clientX - startPoint.current.x;
      const dy = e.clientY - startPoint.current.y;
      if (!moved.current && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      moved.current = true;
      const rect = box.getBoundingClientRect();
      setPosition(clampToViewport({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y }, rect.width, rect.height));
    },
    [dragging],
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      setDragging(false);
      const box = boxRef.current;
      if (box?.hasPointerCapture(e.pointerId)) box.releasePointerCapture(e.pointerId);
      if (moved.current) {
        const rect = box?.getBoundingClientRect();
        if (rect) persistPosition(clampToViewport({ x: rect.left, y: rect.top }, rect.width, rect.height));
      }
    },
    [dragging],
  );

  // Keyboard nudging keeps the control usable without a mouse.
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 40 : 12;
    const deltas: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const delta = deltas[e.key];
    if (!delta) return;
    e.preventDefault();
    e.stopPropagation();
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    setPosition(current => {
      if (!current) return current;
      const next = clampToViewport({ x: current.x + delta.x, y: current.y + delta.y }, rect.width, rect.height);
      persistPosition(next);
      return next;
    });
  }, []);

  const phase = timer
    ? getTimerPhase(remainingMs, timer.totalMs, kind)
    : { phase: 'normal' as const, isPulse: false };
  const display = fmtHms(Math.ceil(remainingMs / 1000));

  return (
    <div
      ref={boxRef}
      className={`floating-timer timer-${phase.phase}${phase.isPulse ? ' animate-pulse' : ''}${dragging ? ' is-dragging' : ''}`}
      role="timer"
      aria-label={`${label}: ${display}${timer?.paused ? ', paused' : ''}`}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      style={{
        left: position ? `${position.x}px` : undefined,
        top: position ? `${position.y}px` : undefined,
        // Hide until measured so it never flashes in the top-left corner.
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      <div className="floating-timer-value">{display}</div>
      <div className="floating-timer-meta">
        <span className="floating-timer-label">{timer?.paused ? 'Paused' : label}</span>
        <span className="floating-timer-grip" aria-hidden="true">⠿</span>
      </div>
    </div>
  );
}

