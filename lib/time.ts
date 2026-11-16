export function fmtHms(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function fmtClock(date: Date = new Date()): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  const hmsMatch = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (hmsMatch && hmsMatch[1] && hmsMatch[2]) {
    const h = parseInt(hmsMatch[1], 10);
    const m = parseInt(hmsMatch[2], 10);
    const sec = hmsMatch[3] ? parseInt(hmsMatch[3], 10) : 0;
    return hmsMatch[3] !== undefined ? h * 3600 + m * 60 + sec : h * 60 + m;
  }

  const hourMatch = s.match(/(\d+(?:\.\d+)?)\s*h/);
  const minMatch = s.match(/(\d+(?:\.\d+)?)\s*m/);
  if (hourMatch || minMatch) {
    const hours = hourMatch && hourMatch[1] ? parseFloat(hourMatch[1]) : 0;
    const minutes = minMatch && minMatch[1] ? parseFloat(minMatch[1]) : 0;
    return Math.round((hours * 60 + minutes) * 60);
  }

  const minutesOnly = s.match(/^(\d+(?:\.\d+)?)\s*minutes?$/);
  if (minutesOnly && minutesOnly[1]) {
    return Math.round(parseFloat(minutesOnly[1]) * 60);
  }

  const hoursOnly = s.match(/^(\d+(?:\.\d+)?)\s*hours?$/);
  if (hoursOnly && hoursOnly[1]) {
    return Math.round(parseFloat(hoursOnly[1]) * 3600);
  }

  const pureNumber = s.match(/^(\d+(?:\.\d+)?)$/);
  if (pureNumber && pureNumber[1]) {
    return Math.round(parseFloat(pureNumber[1]) * 60);
  }

  return null;
}