// "Restore a saved exam" — the teacher-friendly recovery path.
//
// A teacher who suffers a crash or power cut should not have to remember which
// settings went with a seed. This module accepts EITHER:
//
//   1. the ZIP downloaded from Review / Exam Complete (it contains
//      seed.txt + locked-exam.json + manifest.json), or
//   2. a bare seed string typed or pasted from seed.txt,
//
// and returns the exact config to apply. The seed file records the set count
// and set strategy, so those travel WITH the seed and are applied
// automatically instead of being asked for again.

import { unzipSync, strFromU8 } from 'fflate';
import type { ExamConfig, ExamDefinition, ExamMeta, Question } from '@/types';
import { sanitizeExamConfig, sanitizeExamMeta } from './validate';

export interface RestoredExam {
  kind: 'locked' | 'seed';
  seed: string;
  /** Config reconstructed from the bundle. Always present. */
  config: ExamConfig;
  /** Present when a full locked-exam.json snapshot was restored. */
  exam?: ExamDefinition;
  meta?: ExamMeta;
  pool?: Question[];
}

export interface RestoreFailure {
  kind: 'error';
  message: string;
}

export type RestoreResult = RestoredExam | RestoreFailure;

export function isRestoreSuccess(value: RestoreResult): value is RestoredExam {
  return value.kind === 'locked' || value.kind === 'seed';
}

export function isRestoreFailure(value: RestoreResult): value is RestoreFailure {
  return value.kind === 'error';
}

function isZip(bytes: Uint8Array): boolean {
  // ZIP local file header: "PK\x03\x04"
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function configFromAny(raw: unknown, fallback: ExamConfig): ExamConfig {
  return sanitizeExamConfig(raw, fallback);
}

function seedFromSeedText(text: string): string | null {
  // Matches the first "Seed: <value>" line written by buildZip().
  const match = /^\s*seed\s*:\s*(\S+)\s*$/im.exec(text);
  return match?.[1] ?? null;
}

export interface RestoreOptions {
  fallbackConfig: ExamConfig;
  fallbackMeta: ExamMeta;
}

/** Restore from a ZIP (ArrayBuffer), a bare seed, or a pasted seed text. */
export function restoreSavedExam(input: ArrayBuffer | string, options: RestoreOptions): RestoreResult {
  const { fallbackConfig, fallbackMeta } = options;

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return { kind: 'error', message: 'Paste a seed or choose the ZIP file you saved.' };
    }
    // Pasted seed.txt block or a bare seed key.
    const seed = seedFromSeedText(trimmed) ?? trimmed.split(/\s+/)[0] ?? null;
    if (!seed) {
      return { kind: 'error', message: 'Could not find a seed in that text.' };
    }
    return {
      kind: 'seed',
      seed,
      config: { ...fallbackConfig, seed },
    };
  }

  const bytes = new Uint8Array(input);
  if (!isZip(bytes)) {
    // Some browsers hand us the seed.txt as bytes; decode and retry as text.
    try {
      return restoreSavedExam(new TextDecoder().decode(bytes), options);
    } catch {
      return { kind: 'error', message: 'That file is not a saved exam ZIP or seed text file.' };
    }
  }

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return { kind: 'error', message: 'That ZIP could not be opened. Try downloading the backup again.' };
  }

  const lockedText = files['locked-exam.json'] ? strFromU8(files['locked-exam.json']!) : null;
  const manifestText = files['manifest.json'] ? strFromU8(files['manifest.json']!) : null;

  if (lockedText) {
    const snapshot = tryParseJson(lockedText) as Partial<ExamDefinition> & { seed?: string } | null;
    if (snapshot && snapshot.config) {
      const config = configFromAny(snapshot.config, fallbackConfig);
      const seed = config.seed || snapshot.seed || '';
      const meta = sanitizeExamMeta(snapshot.meta, fallbackMeta);
      const pool = Array.isArray(snapshot.pool) ? (snapshot.pool as Question[]) : [];
      const sets = Array.isArray(snapshot.sets) ? snapshot.sets : [];

      if (seed && pool.length > 0 && sets.length > 0) {
        const exam: ExamDefinition = {
          id: typeof snapshot.id === 'string' ? snapshot.id : `restored-${Date.now()}`,
          createdAt: typeof snapshot.createdAt === 'number' ? snapshot.createdAt : Date.now(),
          meta,
          config: { ...config, seed },
          pool,
          sets,
          sectionB: Array.isArray(snapshot.sectionB) ? snapshot.sectionB : [],
          sectionC: Array.isArray(snapshot.sectionC) ? snapshot.sectionC : [],
        };
        return { kind: 'locked', seed, config: exam.config, exam, meta, pool };
      }
    }
  }

  if (manifestText) {
    const manifest = tryParseJson(manifestText) as { seed?: string; config?: unknown } | null;
    if (manifest?.seed) {
      return {
        kind: 'seed',
        seed: manifest.seed,
        config: { ...configFromAny(manifest.config, fallbackConfig), seed: manifest.seed },
      };
    }
  }

  return {
    kind: 'error',
    message: 'This ZIP does not contain a saved exam (no locked-exam.json or seed found).',
  };
}

/** Extract the set-count/strategy line from a seed.txt for display. */
export function describeRestoredConfig(config: ExamConfig): string {
  const strategy = config.setStrategy === 'reorderAll' ? 'Reorder all (same questions, new order)' : 'Sample subset';
  return `${config.numSets} sets · ${strategy} · seed “${config.seed}”`;
}
