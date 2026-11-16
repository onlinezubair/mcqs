'use client';

// Google sign-in via Firebase Auth.
//
// Teachers sign in; students never do. All calls are guarded so the app keeps
// working (local-only) when Firebase is not configured or the user is offline.

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { getFirebase } from './firebase';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export type SignInResult =
  | { ok: true; user: AuthUser }
  | { ok: false; reason: 'not-configured' | 'popup-blocked' | 'unauthorized-domain' | 'offline' | 'unknown'; message: string };

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

export async function signInWithGoogle(): Promise<SignInResult> {
  const client = getFirebase();
  if (!client) {
    return {
      ok: false,
      reason: 'not-configured',
      message: 'Cloud sign-in is not configured. The app still works offline.',
    };
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await signInWithPopup(client.auth, provider);
    return { ok: true, user: toAuthUser(result.user) };
  } catch (error) {
    const code = (error as { code?: string }).code ?? '';
    if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
      return { ok: false, reason: 'popup-blocked', message: 'The sign-in popup was blocked. Allow popups for this site and try again.' };
    }
    if (code === 'auth/unauthorized-domain') {
      return { ok: false, reason: 'unauthorized-domain', message: 'This domain is not authorised for sign-in in Firebase. Add it under Authentication → Settings → Authorized domains.' };
    }
    if (code === 'auth/network-request-failed' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return { ok: false, reason: 'offline', message: 'You appear to be offline. The app works offline; sign in later to sync.' };
    }
    return { ok: false, reason: 'unknown', message: (error as Error).message || 'Sign-in failed.' };
  }
}

export async function signOut(): Promise<void> {
  const client = getFirebase();
  if (!client) return;
  await fbSignOut(client.auth);
}

/** Subscribe to auth state. Returns an unsubscribe function, or null if unavailable. */
export function subscribeToAuth(callback: (user: AuthUser | null) => void): (() => void) | null {
  const client = getFirebase();
  if (!client) return null;
  return onAuthStateChanged(client.auth, (user) => callback(user ? toAuthUser(user) : null));
}

/** Current user synchronously, if any. */
export function currentUser(): AuthUser | null {
  const client = getFirebase();
  const user = client?.auth.currentUser;
  return user ? toAuthUser(user) : null;
}
