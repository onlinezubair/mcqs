import { describe, it, expect } from 'vitest';
import {
  chunkPayload,
  reassemblePayload,
  buildPaperMeta,
  isValidPaperMeta,
  CHUNK_BYTES,
  MAX_PAPER_BYTES,
} from './cloudModel';
import type { CloudPaperPayload } from '@/types';

function makePayloadWithQuestions(count: number): CloudPaperPayload {
  return {
    draft: {
      meta: {
        program: '', semester: '', subject: 'Biology', subjectCode: '', subjectFullName: '',
        subjectMode: 'Theory', examName: 'Big Paper', quizNumber: 1, date: '2026-01-01', dateManuallySet: false,
      },
      config: {
        numSets: 2, questionsPerSet: count, setStrategy: 'reorderAll', shuffleOptions: true,
        seed: 'seed', mcqTimingMode: 'perQuestion', slideDuration: 30, totalMcqMinutes: 10,
        examMode: 'mcq', paperDurationMinutes: 0, allowPaperPause: false, questionsPerSlide: 4,
      },
      rawMcq: 'x'.repeat(200 * count),
      rawB: '', rawC: '', rawUnified: '',
    },
    sectionB: [],
    sectionC: [],
    seed: 'seed',
  };
}

describe('cloudModel chunking', () => {
  it('keeps a small payload in a single chunk', () => {
    const { chunks, sizeBytes } = chunkPayload(makePayloadWithQuestions(2));
    expect(chunks).toHaveLength(1);
    expect(sizeBytes).toBeLessThan(CHUNK_BYTES);
  });

  it('splits a large payload into multiple chunks, each under the limit', () => {
    const { chunks } = chunkPayload(makePayloadWithQuestions(4000));
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      const bytes = new TextEncoder().encode(chunk).length;
      expect(bytes).toBeLessThanOrEqual(CHUNK_BYTES);
    }
  });

  it('reassembles the exact original payload', () => {
    const payload = makePayloadWithQuestions(4000);
    const { chunks } = chunkPayload(payload);
    const restored = reassemblePayload(chunks);
    expect(restored.draft.rawMcq).toBe(payload.draft.rawMcq);
    expect(restored.seed).toBe('seed');
  });

  it('refuses a payload above the hard cloud limit', () => {
    expect(() => chunkPayload(makePayloadWithQuestions(20000))).toThrow(/above the .* MB cloud limit/i);
    expect(MAX_PAPER_BYTES).toBeGreaterThan(CHUNK_BYTES);
  });
});

describe('cloud paper metadata validation', () => {
  const valid = buildPaperMeta({
    id: 'p1', ownerUid: 'uid1', title: 'T', subject: 'S', examName: 'Q', quizNumber: 1,
    chunkCount: 1, sizeBytes: 100, createdAt: 1, updatedAt: 2,
  });

  it('accepts a well-formed meta', () => {
    expect(isValidPaperMeta(valid)).toBe(true);
  });

  it('rejects a missing owner, empty id, or bad sizes', () => {
    expect(isValidPaperMeta({ ...valid, ownerUid: '' })).toBe(false);
    expect(isValidPaperMeta({ ...valid, id: '' })).toBe(false);
    expect(isValidPaperMeta({ ...valid, chunkCount: 0 })).toBe(false);
    expect(isValidPaperMeta({ ...valid, sizeBytes: MAX_PAPER_BYTES + 1 })).toBe(false);
    expect(isValidPaperMeta(null)).toBe(false);
  });
});
