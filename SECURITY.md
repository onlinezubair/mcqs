# Security

## Scope

MCQ Projector is a classroom tool. **Students never sign in.** Only the teacher
signs in (optional) to keep their own question papers and settings online.

## What is stored, and where

| Data | Location | Who can read it |
|---|---|---|
| Exam questions, sets, answer keys | Browser (localStorage/IndexedDB) always | The teacher on that device |
| Question papers (optional cloud copy) | Firestore `users/{uid}/papers/**` | Only that signed-in teacher |
| Teacher settings (optional) | Firestore `users/{uid}` | Only that signed-in teacher |

No student personal data is collected or stored.

## Firestore rules

Deployed from `firestore.rules`:

- **Deny by default.** Anything not explicitly allowed is refused.
- A signed-in user may read/write **only** `users/{their-own-uid}/**`.
- Every document must carry `ownerUid` equal to the path uid.
- Field types and sizes are validated, and the payload is bounded
  (`chunkCount` 1–100, `sizeBytes` ≤ 4 MB, chunk strings ≤ 900 KB) so no write
  can exceed Firestore's 1 MiB document limit.

Verify after any change with `npm run deploy:rules`.

## Answer-key isolation

Answer keys live only in the teacher's local data and their own Firestore
subtree. The student-facing projector views render questions and options
without answers, and never load a cloud paper.

## Spark free-tier limits

The app is designed to stay free forever:

| Resource | Free daily/limits | How the app stays inside |
|---|---|---|
| Firestore stored | 1 GiB | Papers are small text; chunked, optional |
| Firestore reads | 50k/day | `getDoc`/`getDocs` only, no realtime listeners; list reads metadata only |
| Firestore writes | 20k/day | Debounced sync, batched writes |
| Firestore deletes | 20k/day | Batched deletes |
| Hosting storage | 10 GB | Static export, small bundle |
| Hosting transfer | ~360 MB/day | Cached static assets via service worker |

If a quota is reached, cloud operations surface a clear error and the app keeps
working from the local cache — running an exam is never blocked by the cloud.

## Secrets

No secrets are committed. Firebase web config values are public identifiers
embedded in every Firebase web app; they are still supplied via environment
variables. Service-account keys are used only as a GitHub Actions secret for
deployment and are never committed.

## Reporting

This is a self-hosted educational project. If you host your own copy, keep
`firestore.rules` deployed and restrict the browser API key in Google Cloud
Console to your hosting domains.
