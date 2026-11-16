// Firestore data model for cloud-saved papers.
//
// Layout (everything below the signed-in teacher's uid):
//
//   users/{uid}                          profile + settings + last-used settings
//   users/{uid}/papers/{paperId}         paper metadata (small, listable)
//   users/{uid}/papers/{paperId}/chunks/{n}
//                                        payload split into <= ~700 KB pieces
//
// A Firestore document is capped at 1 MiB, so the question bank is chunked.
// Listing papers only reads the small metadata docs (cheap on Spark's 50k
// reads/day); the payload is fetched only when a paper is opened.

import type { CloudPaperMeta, CloudPaperPayload } from '@/types';

/** Target chunk size — comfortably under Firestore's 1 MiB document cap. */
export const CHUNK_BYTES = 700_000;

/** Hard cap on a single paper payload to protect the Spark free tier. */
export const MAX_PAPER_BYTES = 4_000_000;

export const USER_DOC_PATH = (uid: string) => `users/${uid}`;
export const PAPERS_COLLECTION = (uid: string) => `users/${uid}/papers`;
export const PAPER_DOC_PATH = (uid: string, paperId: string) => `users/${uid}/papers/${paperId}`;
export const CHUNKS_COLLECTION = (uid: string, paperId: string) =>
  `users/${uid}/papers/${paperId}/chunks`;

export function byteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
}

/** Serialize a payload and split into chunk strings under CHUNK_BYTES. */
export function chunkPayload(payload: CloudPaperPayload): { chunks: string[]; sizeBytes: number } {
  const json = JSON.stringify(payload);
  const sizeBytes = byteLength(json);
  if (sizeBytes > MAX_PAPER_BYTES) {
    throw new Error(
      `This paper is ${(sizeBytes / 1_000_000).toFixed(1)} MB, above the ${(MAX_PAPER_BYTES / 1_000_000).toFixed(0)} MB cloud limit. Export it as a ZIP instead.`,
    );
  }

  if (sizeBytes <= CHUNK_BYTES) {
    return { chunks: [json], sizeBytes };
  }

  // Split on UTF-16 code units but measure with the encoder; keep slices well
  // under the byte budget so multi-byte characters never overflow a chunk.
  const chunks: string[] = [];
  let cursor = 0;
  const step = Math.floor(CHUNK_BYTES / 3); // worst case ~3 bytes per code unit
  while (cursor < json.length) {
    let end = Math.min(json.length, cursor + step);
    let piece = json.slice(cursor, end);
    while (byteLength(piece) > CHUNK_BYTES && piece.length > 1) {
      end -= Math.max(1, Math.floor(piece.length * 0.05));
      piece = json.slice(cursor, end);
    }
    chunks.push(piece);
    cursor = end;
  }
  return { chunks, sizeBytes };
}

/** Reassemble and parse chunk strings back into a payload. */
export function reassemblePayload(chunks: string[]): CloudPaperPayload {
  const json = chunks.join('');
  return JSON.parse(json) as CloudPaperPayload;
}

export function buildPaperMeta(args: {
  id: string;
  ownerUid: string;
  title: string;
  subject: string;
  examName: string;
  quizNumber: number;
  chunkCount: number;
  sizeBytes: number;
  createdAt: number;
  updatedAt: number;
}): CloudPaperMeta {
  return {
    id: args.id,
    ownerUid: args.ownerUid,
    title: args.title,
    subject: args.subject,
    examName: args.examName,
    quizNumber: args.quizNumber,
    schemaVersion: 1,
    chunkCount: args.chunkCount,
    sizeBytes: args.sizeBytes,
    createdAt: args.createdAt,
    updatedAt: args.updatedAt,
  };
}

/** Basic client-side validation mirroring firestore.rules. */
export function isValidPaperMeta(value: unknown): value is CloudPaperMeta {
  if (!value || typeof value !== 'object') return false;
  const meta = value as Partial<CloudPaperMeta>;
  return (
    typeof meta.id === 'string' &&
    meta.id.length > 0 &&
    meta.id.length <= 128 &&
    typeof meta.ownerUid === 'string' &&
    meta.ownerUid.length > 0 &&
    typeof meta.title === 'string' &&
    meta.title.length <= 300 &&
    typeof meta.chunkCount === 'number' &&
    meta.chunkCount >= 1 &&
    meta.chunkCount <= 100 &&
    typeof meta.sizeBytes === 'number' &&
    meta.sizeBytes >= 0 &&
    meta.sizeBytes <= MAX_PAPER_BYTES
  );
}
