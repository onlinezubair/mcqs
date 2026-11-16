// Persistence abstraction: one interface, two adapters.
//
//   localAdapter     — always available, browser-only (deck of keys in
//                      localStorage/IndexedDB). This is what makes the app work
//                      offline and without an account.
//   firestoreAdapter — per-teacher cloud storage. Every call is a plain
//                      getDoc/getDocs/batched write (never a realtime listener)
//                      to stay inside the Spark free tier.
//
// The store talks only to this interface, so Milestone 7 behaviour (autosave,
// resume, last settings) is identical with or without a signed-in teacher.

import type { CloudPaperMeta, CloudPaperPayload } from '@/types';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  collection,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { getFirebase } from './firebase';
import {
  CHUNKS_COLLECTION,
  PAPER_DOC_PATH,
  PAPERS_COLLECTION,
  USER_DOC_PATH,
  buildPaperMeta,
  chunkPayload,
  isValidPaperMeta,
  reassemblePayload,
} from './cloudModel';
import { safeGetItem, safeSetItem, safeRemoveItem } from './storage';

export interface SettingsPayload {
  meta: unknown;
  config: unknown;
  updatedAt: number;
}

export interface PersistenceAdapter {
  readonly kind: 'local' | 'cloud';
  saveSettings(settings: SettingsPayload): Promise<void>;
  loadSettings(): Promise<SettingsPayload | null>;
  savePaper(paper: CloudPaperPayload, existingId?: string): Promise<CloudPaperMeta>;
  listPapers(): Promise<CloudPaperMeta[]>;
  loadPaper(paperId: string): Promise<CloudPaperPayload | null>;
  deletePaper(paperId: string): Promise<void>;
}

const SETTINGS_KEY = 'mcqProjector_cloudSettings';
const LAST_SETTINGS_KEY = 'mcqProjector_lastSettings';

/* ------------------------------------------------------------------ local */

export class LocalPersistenceAdapter implements PersistenceAdapter {
  readonly kind = 'local' as const;

  async saveSettings(settings: SettingsPayload): Promise<void> {
    await safeSetItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  async loadSettings(): Promise<SettingsPayload | null> {
    const raw = await safeGetItem(SETTINGS_KEY);
    if (!raw) return this.loadLastSettings();
    try {
      return JSON.parse(raw) as SettingsPayload;
    } catch {
      return null;
    }
  }

  /** "Last used settings" survives even when cloud sync was never enabled. */
  async loadLastSettings(): Promise<SettingsPayload | null> {
    const raw = await safeGetItem(LAST_SETTINGS_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SettingsPayload;
    } catch {
      return null;
    }
  }

  // Local adapter keeps papers in localStorage under a list, so offline paper
  // management still works without Firestore.
  async savePaper(paper: CloudPaperPayload, existingId?: string): Promise<CloudPaperMeta> {
    const id = existingId ?? `local-${Date.now().toString(36)}`;
    const now = Date.now();
    const json = JSON.stringify(paper);
    await safeSetItem(`mcqPaper_${id}`, json);
    const meta = buildPaperMeta({
      id,
      ownerUid: 'local',
      title: paper.draft.meta.examName || 'Untitled paper',
      subject: paper.draft.meta.subject,
      examName: paper.draft.meta.examName,
      quizNumber: paper.draft.meta.quizNumber,
      chunkCount: 1,
      sizeBytes: json.length,
      createdAt: now,
      updatedAt: now,
    });
    const index = await this.readIndex();
    await safeSetItem('mcqPaperIndex', JSON.stringify([meta, ...index.filter(m => m.id !== id)]));
    return meta;
  }

  async listPapers(): Promise<CloudPaperMeta[]> {
    return this.readIndex();
  }

  async loadPaper(paperId: string): Promise<CloudPaperPayload | null> {
    const raw = await safeGetItem(`mcqPaper_${paperId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CloudPaperPayload;
    } catch {
      return null;
    }
  }

  async deletePaper(paperId: string): Promise<void> {
    await safeRemoveItem(`mcqPaper_${paperId}`);
    const index = await this.readIndex();
    await safeSetItem('mcqPaperIndex', JSON.stringify(index.filter(m => m.id !== paperId)));
  }

  private async readIndex(): Promise<CloudPaperMeta[]> {
    const raw = await safeGetItem('mcqPaperIndex');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter(isValidPaperMeta) : [];
    } catch {
      return [];
    }
  }
}

/* ------------------------------------------------------------------ cloud */

export class FirestorePersistenceAdapter implements PersistenceAdapter {
  readonly kind = 'cloud' as const;

  constructor(private readonly uid: string) {}

  async saveSettings(settings: SettingsPayload): Promise<void> {
    const client = getFirebase();
    if (!client) throw new Error('Cloud storage is not configured.');
    await setDoc(
      doc(client.db, USER_DOC_PATH(this.uid)),
      { settings: JSON.parse(JSON.stringify(settings)), updatedAt: Date.now() },
      { merge: true },
    );
  }

  async loadSettings(): Promise<SettingsPayload | null> {
    const client = getFirebase();
    if (!client) return null;
    const snap = await getDoc(doc(client.db, USER_DOC_PATH(this.uid)));
    if (!snap.exists()) return null;
    const data = snap.data() as { settings?: SettingsPayload };
    return data.settings ?? null;
  }

  async savePaper(paper: CloudPaperPayload, existingId?: string): Promise<CloudPaperMeta> {
    const client = getFirebase();
    if (!client) throw new Error('Cloud storage is not configured.');

    const paperId = existingId ?? `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const { chunks, sizeBytes } = chunkPayload(paper);
    const now = Date.now();

    const existing = await getDoc(doc(client.db, PAPER_DOC_PATH(this.uid, paperId)));
    const createdAt = existing.exists() ? (existing.data().createdAt as number) ?? now : now;

    const meta = buildPaperMeta({
      id: paperId,
      ownerUid: this.uid,
      title: paper.draft.meta.examName || 'Untitled paper',
      subject: paper.draft.meta.subject,
      examName: paper.draft.meta.examName,
      quizNumber: paper.draft.meta.quizNumber,
      chunkCount: chunks.length,
      sizeBytes,
      createdAt,
      updatedAt: now,
    });

    // One batch keeps the metadata + all chunks atomic (max 500 writes/batch).
    const batch = writeBatch(client.db);
    batch.set(doc(client.db, PAPER_DOC_PATH(this.uid, paperId)), meta);
    const chunkCol = CHUNKS_COLLECTION(this.uid, paperId);
    chunks.forEach((chunk, index) => {
      batch.set(doc(client.db, `${chunkCol}/c${index}`), { index, data: chunk });
    });
    // Remove stale chunks if the paper shrank.
    if (existing.exists()) {
      const previous = (existing.data().chunkCount as number) ?? 0;
      for (let i = chunks.length; i < previous; i++) {
        batch.delete(doc(client.db, `${chunkCol}/c${i}`));
      }
    }
    await batch.commit();
    return meta;
  }

  async listPapers(): Promise<CloudPaperMeta[]> {
    const client = getFirebase();
    if (!client) return [];
    const snap = await getDocs(
      query(collection(client.db, PAPERS_COLLECTION(this.uid)), orderBy('updatedAt', 'desc'), limit(200)),
    );
    return snap.docs
      .map(d => d.data())
      .filter(isValidPaperMeta);
  }

  async loadPaper(paperId: string): Promise<CloudPaperPayload | null> {
    const client = getFirebase();
    if (!client) return null;
    const metaSnap = await getDoc(doc(client.db, PAPER_DOC_PATH(this.uid, paperId)));
    if (!metaSnap.exists()) return null;
    const meta = metaSnap.data();
    const count = (meta.chunkCount as number) ?? 0;
    if (count <= 0) return null;

    // Fetch chunks individually in index order (getDoc, not a listener).
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const chunkSnap = await getDoc(doc(client.db, `${CHUNKS_COLLECTION(this.uid, paperId)}/c${i}`));
      if (!chunkSnap.exists()) return null;
      parts.push((chunkSnap.data() as { data: string }).data);
    }
    return reassemblePayload(parts);
  }

  async deletePaper(paperId: string): Promise<void> {
    const client = getFirebase();
    if (!client) return;
    const metaSnap = await getDoc(doc(client.db, PAPER_DOC_PATH(this.uid, paperId)));
    const count = metaSnap.exists() ? ((metaSnap.data().chunkCount as number) ?? 0) : 0;

    const batch = writeBatch(client.db);
    for (let i = 0; i < count; i++) {
      batch.delete(doc(client.db, `${CHUNKS_COLLECTION(this.uid, paperId)}/c${i}`));
    }
    batch.delete(doc(client.db, PAPER_DOC_PATH(this.uid, paperId)));
    await batch.commit();
  }
}

export const localAdapter = new LocalPersistenceAdapter();

/** Pick the cloud adapter when signed in with Firebase configured, else local. */
export function getAdapter(uid: string | null): PersistenceAdapter {
  if (uid && getFirebase()) return new FirestorePersistenceAdapter(uid);
  return localAdapter;
}
