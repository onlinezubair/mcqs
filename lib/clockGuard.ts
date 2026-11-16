let lastWallTime = 0;
let lastPerfTime = 0;
let guardCallback: ((driftMs: number) => void) | null = null;

function perfNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export function clockGuardStart(onDrift: (driftMs: number) => void): void {
  lastWallTime = Date.now();
  lastPerfTime = perfNow();
  guardCallback = onDrift;
}

export function clockGuardTick(): { driftMs: number; suspended: boolean } {
  const nowWall = Date.now();
  const nowPerf = perfNow();

  if (lastPerfTime === 0) {
    lastWallTime = nowWall;
    lastPerfTime = nowPerf;
    return { driftMs: 0, suspended: false };
  }

  const wallDelta = nowWall - lastWallTime;
  const perfDelta = nowPerf - lastPerfTime;

  const drift = Math.abs(wallDelta - perfDelta);
  const suspended = perfDelta > 2000 && wallDelta > perfDelta * 1.5;

  lastWallTime = nowWall;
  lastPerfTime = nowPerf;

  if (guardCallback && drift > 2000) {
    guardCallback(drift);
  }

  return { driftMs: drift, suspended };
}

export function clockGuardReset(): void {
  lastWallTime = Date.now();
  lastPerfTime = perfNow();
}
