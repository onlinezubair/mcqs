import { describe, it, expect, beforeEach, vi } from 'vitest';

// Real in-memory localStorage/IndexedDB stubs so the local adapter can be
// exercised end-to-end (the global test setup replaces localStorage with bare
// vi.fn() mocks, which do not persist values).

function installRealLocalStorage() {
  const store = new Map<string, string>();
  const localStorageMock = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  Object.defineProperty(window, 'localStorage', { writable: true, value: localStorageMock });
  Object.defineProperty(globalThis, 'localStorage', { writable: true, value: localStorageMock });
  return store;
}

// Minimal fake IndexedDB is not needed: safeSetItem only falls back to it when
// a value exceeds 500 KB, and our fixtures stay well under that.

import { LocalPersistenceAdapter } from './persistence';
import type { CloudPaperPayload } from '@/types';

function makePayload(examName = 'Quiz 1'): CloudPaperPayload {
  return {
    draft: {
      meta: {
        program: 'PharmD',
        semester: '1',
        subject: 'Biology',
        subjectCode: '310',
        subjectFullName: 'Biology I',
        subjectMode: 'Theory',
        examName,
        quizNumber: 1,
        date: '2026-01-01',
        dateManuallySet: false,
      },
      config: {
        numSets: 2,
        questionsPerSet: 5,
        setStrategy: 'reorderAll',
        shuffleOptions: true,
        seed: 'seed-abc',
        mcqTimingMode: 'perQuestion',
        slideDuration: 30,
        totalMcqMinutes: 10,
        examMode: 'mcq',
        paperDurationMinutes: 0,
        allowPaperPause: false,
        questionsPerSlide: 4,
      },
      rawMcq: '',
      rawB: '',
      rawC: '',
      rawUnified: '',
    },
    sectionB: [],
    sectionC: [],
    seed: 'seed-abc',
  };
}

describe('LocalPersistenceAdapter', () => {
  beforeEach(() => {
    installRealLocalStorage();
  });

  it('round-trips settings', async () => {
    const adapter = new LocalPersistenceAdapter();
    expect(await adapter.loadSettings()).toBeNull();
    await adapter.saveSettings({ meta: { subject: 'Bio' }, config: { numSets: 3 }, updatedAt: 123 });
    const loaded = await adapter.loadSettings();
    expect(loaded?.meta).toEqual({ subject: 'Bio' });
    expect(loaded?.config).toEqual({ numSets: 3 });
  });

  it('saves, lists, loads and deletes a paper', async () => {
    const adapter = new LocalPersistenceAdapter();
    const meta = await adapter.savePaper(makePayload('Test Paper'));
    expect(meta.title).toBe('Test Paper');
    expect(meta.ownerUid).toBe('local');

    const list = await adapter.listPapers();
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(meta.id);

    const loaded = await adapter.loadPaper(meta.id);
    expect(loaded?.draft.meta.examName).toBe('Test Paper');
    expect(loaded?.seed).toBe('seed-abc');

    await adapter.deletePaper(meta.id);
    expect(await adapter.listPapers()).toHaveLength(0);
    expect(await adapter.loadPaper(meta.id)).toBeNull();
  });

  it('replaces an existing paper without duplicating the index entry', async () => {
    const adapter = new LocalPersistenceAdapter();
    const first = await adapter.savePaper(makePayload('Paper A'));
    await adapter.savePaper(makePayload('Paper A updated'), first.id);
    const list = await adapter.listPapers();
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(first.id);
  });

  it('ignores corrupt index data instead of throwing', async () => {
    const adapter = new LocalPersistenceAdapter();
    localStorage.setItem('mcqPaperIndex', '{not json');
    expect(await adapter.listPapers()).toEqual([]);
  });
});
