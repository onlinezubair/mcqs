import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn();
const mockBatch = vi.fn();
const mockDeleteDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, path: string) => ({ path }),
  collection: (_db: unknown, path: string) => ({ path }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  writeBatch: () => {
    const ops: Array<{ kind: string; path: string; value?: unknown }> = [];
    const batch = {
      set: (ref: { path: string }, value: unknown) => ops.push({ kind: 'set', path: ref.path, value }),
      delete: (ref: { path: string }) => ops.push({ kind: 'delete', path: ref.path }),
      commit: () => { mockBatch(ops); return Promise.resolve(); },
    };
    return batch;
  },
  query: (ref: unknown) => ref,
  orderBy: () => ({}),
  limit: () => ({}),
}));

vi.mock('./firebase', () => ({
  getFirebase: () => ({ db: {}, auth: {}, app: {} }),
}));

import { FirestorePersistenceAdapter } from './persistence';
import type { CloudPaperPayload } from '@/types';

function makePayload(examName = 'Cloud Quiz'): CloudPaperPayload {
  return {
    draft: {
      meta: {
        program: '', semester: '', subject: 'S', subjectCode: '', subjectFullName: '',
        subjectMode: 'Theory', examName, quizNumber: 1, date: '2026-01-01', dateManuallySet: false,
      },
      config: {
        numSets: 2, questionsPerSet: 5, setStrategy: 'reorderAll', shuffleOptions: true,
        seed: 'cloud-seed', mcqTimingMode: 'perQuestion', slideDuration: 30, totalMcqMinutes: 10,
        examMode: 'mcq', paperDurationMinutes: 0, allowPaperPause: false, questionsPerSlide: 4,
      },
      rawMcq: '', rawB: '', rawC: '', rawUnified: '',
    },
    sectionB: [],
    sectionC: [],
    seed: 'cloud-seed',
  };
}

describe('FirestorePersistenceAdapter', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockGetDocs.mockReset();
    mockSetDoc.mockReset();
    mockBatch.mockReset();
  });

  it('saves a paper under the signed-in uid with ownerUid set', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
    const adapter = new FirestorePersistenceAdapter('teacher-uid');
    const meta = await adapter.savePaper(makePayload('Cloud Quiz'));
    expect(meta.ownerUid).toBe('teacher-uid');
    expect(meta.title).toBe('Cloud Quiz');
    const ops = mockBatch.mock.calls[0]![0] as Array<{ kind: string; path: string }>;
    expect(ops.some(o => o.path === `users/teacher-uid/papers/${meta.id}`)).toBe(true);
    expect(ops.some(o => o.path.startsWith(`users/teacher-uid/papers/${meta.id}/chunks/`))).toBe(true);
  });

  it('loads a paper by reassembling chunk documents', async () => {
    const payload = makePayload('Loaded Paper');
    const json = JSON.stringify(payload);
    mockGetDoc.mockImplementation((ref: { path: string }) => {
      if (ref.path.endsWith('/chunks/c0')) {
        return Promise.resolve({ exists: () => true, data: () => ({ index: 0, data: json }) });
      }
      return Promise.resolve({ exists: () => true, data: () => ({ chunkCount: 1 }) });
    });
    const adapter = new FirestorePersistenceAdapter('uid-1');
    const loaded = await adapter.loadPaper('paper-1');
    expect(loaded?.draft.meta.examName).toBe('Loaded Paper');
  });

  it('lists only valid paper metadata for the uid', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { data: () => ({ id: 'a', ownerUid: 'uid-1', title: 'A', subject: 'S', examName: 'Quiz', quizNumber: 1, schemaVersion: 1, chunkCount: 1, sizeBytes: 100, createdAt: 1, updatedAt: 2 }) },
        { data: () => ({ id: '', ownerUid: '' }) },
      ],
    });
    const adapter = new FirestorePersistenceAdapter('uid-1');
    const papers = await adapter.listPapers();
    expect(papers).toHaveLength(1);
    expect(papers[0]!.id).toBe('a');
  });

  it('deletes metadata and every chunk', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ chunkCount: 2 }) });
    const adapter = new FirestorePersistenceAdapter('uid-1');
    await adapter.deletePaper('paper-1');
    const ops = mockBatch.mock.calls[0]![0] as Array<{ kind: string; path: string }>;
    expect(ops.filter(o => o.kind === 'delete')).toHaveLength(3);
  });
});
