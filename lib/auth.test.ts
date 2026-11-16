import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSignInWithPopup = vi.fn();
const mockSignOut = vi.fn();

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {
    setCustomParameters() {}
  },
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  onAuthStateChanged: vi.fn(),
}));

const mockGetFirebase = vi.fn();
vi.mock('./firebase', () => ({
  getFirebase: () => mockGetFirebase(),
}));

import { signInWithGoogle, signOut } from './auth';

describe('auth helpers', () => {
  beforeEach(() => {
    mockSignInWithPopup.mockReset();
    mockSignOut.mockReset();
    mockGetFirebase.mockReset();
  });

  it('returns not-configured when Firebase is unavailable', async () => {
    mockGetFirebase.mockReturnValue(null);
    const result = await signInWithGoogle();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('not-configured');
  });

  it('returns the signed-in user on success', async () => {
    mockGetFirebase.mockReturnValue({ auth: {}, db: {}, app: {} });
    mockSignInWithPopup.mockResolvedValue({
      user: { uid: 'u1', email: 't@example.com', displayName: 'Teacher', photoURL: null },
    });
    const result = await signInWithGoogle();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user.uid).toBe('u1');
    expect(result.user.email).toBe('t@example.com');
  });

  it('maps a blocked popup to a helpful message', async () => {
    mockGetFirebase.mockReturnValue({ auth: {}, db: {}, app: {} });
    mockSignInWithPopup.mockRejectedValue({ code: 'auth/popup-blocked' });
    const result = await signInWithGoogle();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('popup-blocked');
    expect(result.message).toMatch(/popup/i);
  });

  it('maps an unauthorised domain to a helpful message', async () => {
    mockGetFirebase.mockReturnValue({ auth: {}, db: {}, app: {} });
    mockSignInWithPopup.mockRejectedValue({ code: 'auth/unauthorized-domain' });
    const result = await signInWithGoogle();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('unauthorized-domain');
  });

  it('signOut is a no-op when Firebase is unavailable', async () => {
    mockGetFirebase.mockReturnValue(null);
    await expect(signOut()).resolves.toBeUndefined();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
