export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function mulberry32(a: () => number) {
  return () => {
    const t = a();
    return t;
  };
}

export function createRng(seed: string) {
  const xmur = xmur3(seed);
  return mulberry32(xmur);
}

// Human-readable random seed used when the teacher leaves the Advanced
// "Seed" field blank. Stored on the exam so the exact shuffle can be
// reproduced and audited later.
export function generateSeed(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let seed = '';
  for (let i = 0; i < 10; i++) {
    seed += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return seed;
}

export function shuffleInPlace<T>(array: T[], rng: () => number): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    // Use temporary variable to avoid TS2322 with noUncheckedIndexedAccess
    const temp = array[i];
    array[i] = array[j]!;
    array[j] = temp!;
  }
  return array;
}