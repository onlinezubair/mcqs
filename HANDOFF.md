# Handoff

Plain-language guide for a non-technical reader. Everything below is either
already done or is a short manual step.

## Current status

| Item | Status |
|---|---|
| Code in a public GitHub repo with MIT licence | ✅ Done |
| App builds, lints, and all tests pass | ✅ Done |
| Google sign-in + per-teacher cloud storage code | ✅ Done |
| Firebase project, Web App, Firestore database (asia-south1) | ✅ Done |
| Security rules deployed | ✅ Done |
| Site deployed live | ✅ https://mcqs-exam.web.app |
| CI pipeline (test on every push, deploy on `main`) | ✅ Done (needs 2 GitHub settings) |
| Google sign-in provider enabled | ⏳ Needs one console click (step 1) |

## Repo and URLs

- GitHub: https://github.com/onlinezubair/mcqs (public, MIT)
- Live site: https://mcqs-exam.web.app and https://mcqs-exam.firebaseapp.com
- Firebase project: `mcqs-exam` (Spark / free plan — never add billing)

## What you must do (one short step)

### 1. Turn on Google sign-in (Firebase console, one-time)

Open https://console.firebase.google.com/project/mcqs-exam/authentication and:

1. Click **Get started** (this initialises the free Authentication service).
2. On the **Sign-in method** tab, click **Google**.
3. Toggle **Enable**, choose a **support email**, click **Save**.
4. Open the **Settings** tab → **Authorized domains** and confirm these are
   listed (add any missing with **Add domain**): `localhost`,
   `mcqs-exam.web.app`, `mcqs-exam.firebaseapp.com`.

That is the only remaining manual step. Everything else is deployed.

After that, open https://mcqs-exam.web.app — you will see **Sign in with Google**
and **Continue without signing in**.

## What the app does

- Teachers paste or drop a question paper, build shuffled sets, calibrate on the
  room projector, then run timed MCQ slides and (optionally) a Section B & C
  paper timer.
- **Students never sign in.** Only the teacher can optionally sign in to keep
  their papers and settings online.
- The shuffle **seed** is saved and exported in the ZIP so any interrupted exam
  can be reproduced exactly; Setup → **Restore a saved exam** accepts the ZIP or
  just the seed.

## How data is stored

- **Always local:** everything is saved in the browser on that computer and
  works offline.
- **Cloud (optional, signed-in teacher only):** papers and settings go to
  Firestore under that teacher's private area. Only that account can read them.
  Answer keys are never shown to students and never loaded by projector views.

## Free-tier safety

The app is built to stay on the free Spark plan: no functions, no storage
buckets, small reads/writes, and cloud is optional. If a daily limit is ever
hit, the app shows a message and keeps working from the local copy. Never add a
billing account.

## If something goes wrong

- **"Permission denied" when deploying** → run `firebase login --reauth` and
  choose the account that owns `mcqs-exam`.
- **Sign-in popup says "unauthorized domain"** → add the site's domain under
  Authentication → Settings → Authorized domains.
- **App shows "Cloud" as "Local only"** → the `.env.local` keys are missing or
  the site was built before they were added; run `npm run deploy` again.
- **Sign-in button does nothing / "operation-not-allowed"** → the Google
  provider is not enabled yet; do step 1 above.
- **Exam must run but there is no internet** → on the sign-in screen choose
  **Continue without signing in**; everything works offline.

## Developer commands

```bash
npm run dev            # local development
npm run verify         # typecheck + lint + tests + build
npm run deploy:rules   # deploy Firestore security rules
npm run deploy:hosting # build + deploy the site
npm run deploy         # both
```

## Notes

- The Firebase web config lives in `.env.local` (private, git-ignored). It is
  already filled in on this machine.
- Firestore rules and the live site are already deployed. Re-run
  `npm run deploy` after any code change.
- CI auto-deploy (optional): in GitHub → repo **Settings → Secrets and
  variables → Actions**, add the six `NEXT_PUBLIC_FIREBASE_*` values as
  **Variables** and a `FIREBASE_SERVICE_ACCOUNT_MCQS_EXAM` **Secret**. Ask me to
  generate that service account JSON when you want it.

