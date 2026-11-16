# Handoff

Plain-language guide for a non-technical reader. Everything below is either
already done or is a short manual step.

## Current status

| Item | Status |
|---|---|
| Code in a public GitHub repo with MIT licence | ✅ Done |
| App builds, lints, and all tests pass | ✅ Done |
| Google sign-in + per-teacher cloud storage code | ✅ Done (needs Firebase keys to switch on) |
| Security rules written | ✅ Done (needs deploying) |
| CI pipeline (test on every push, deploy on `main`) | ✅ Done (needs 2 GitHub settings) |
| Firebase CLI sign-in | ⏳ Needs you (browser step) |
| Firestore database + web app keys | ⏳ Needs you (console) |
| Rules + site deployed and live | ⏳ After the two steps above |

## Repo and URLs

- GitHub: https://github.com/onlinezubair/mcqs (public, MIT)
- Live site (after deploy): https://mcqs-exam.web.app and https://mcqs-exam.firebaseapp.com
- Firebase project: `mcqs-exam` (Spark / free plan — never add billing)

## What you must do (short list)

### 1. Sign the Firebase command-line tool in to your Google account
PowerShell, in the project folder:

```powershell
cd "D:\Exam App V3"
firebase login --reauth
```

A browser window opens. Choose **onlinedrzubair@gmail.com** (the account that
owns the Firebase project), click **Allow**. You should see in the terminal:
`✔ Success! Logged in as onlinedrzubair@gmail.com`.

### 2. Turn on Google sign-in and the database (Firebase console)
Open https://console.firebase.google.com/project/mcqs-exam/overview and:

1. Left menu **Build → Authentication → Get started**.
2. **Sign-in method** tab → click **Google** → toggle **Enable** → pick a
   **support email** → **Save**.
3. **Settings** tab → **Authorized domains**: make sure these three are listed
   (add any missing with **Add domain**): `localhost`, `mcqs-exam.web.app`,
   `mcqs-exam.firebaseapp.com`.
4. Left menu **Build → Firestore Database → Create database** → choose
   **Native mode** → location **asia-south1 (Mumbai)** → **Create**.
   (Location cannot be changed later.)
5. Click the **gear icon → Project settings → Your apps**. If there is no web
   app, click **</>** (Web), nickname it `mcqs`, **Register app**. Copy the
   `firebaseConfig` values shown.

### 3. Paste the keys into the app
Create a file named `.env.local` in `D:\Exam App V3` with these six lines
(values come from step 2.5; this file is private and never uploaded):

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=mcqs-exam.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=mcqs-exam
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### 4. Deploy (one command)
```powershell
npm run deploy
```
This builds the app and uploads the site + security rules. When it finishes it
prints `Hosting URL: https://mcqs-exam.web.app`.

### 5. (Optional) Let GitHub deploy automatically
In GitHub → repo **mcqs** → **Settings → Secrets and variables → Actions**:

- **Variables** tab: add each `NEXT_PUBLIC_FIREBASE_*` name with the same values
  as `.env.local` (six variables).
- **Secrets** tab: add `FIREBASE_SERVICE_ACCOUNT_MCQS_EXAM` — ask me and I will
  generate a minimal-permission service account JSON for you to paste there.

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
- **Exam must run but there is no internet** → on the sign-in screen choose
  **Continue without signing in**; everything works offline.

## Developer commands

```bash
npm run dev          # local development
npm run verify       # typecheck + lint + tests + build
npm run deploy:rules # deploy Firestore security rules
npm run deploy:hosting
npm run deploy       # both
```
