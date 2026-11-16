// Firebase client initialisation.
//
// This project is a static export (`output: 'export'`), so there is no server
// runtime — every Firebase call here happens in the browser only. The module
// deliberately:
//   * returns null when the environment is not configured, so the app keeps
//     working fully offline without Firebase;
//   * is idempotent — repeated imports reuse the same app instance instead of
//     throwing "Firebase App named '[DEFAULT]' already exists".
//
// Web config values are not secrets (they are embedded in every Firebase web
// app), but they are still read from env vars so they stay out of the code.

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

export interface FirebaseClient {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** True when the minimum Firebase config is present. */
export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

let cached: FirebaseClient | null = null;

/**
 * Returns the shared Firebase client, or null when not configured.
 * Safe to call from any client component; never runs on the server.
 */
export function getFirebase(): FirebaseClient | null {
  if (typeof window === 'undefined') return null;
  if (!isFirebaseConfigured()) return null;
  if (cached) return cached;

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  cached = { app, auth, db };
  return cached;
}

/** Test-only: reset the memoised client between tests. */
export function __resetFirebaseForTests(): void {
  cached = null;
}
