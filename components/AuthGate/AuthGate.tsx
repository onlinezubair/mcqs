'use client';

import { useEffect, useState } from 'react';
import { useExamStore } from '@/store/examStore';

const OFFLINE_KEY = 'mcqProjector_continueOffline';

/**
 * Sign-in gate for the teacher's exam builder.
 *
 * Only shown when Firebase is configured. A teacher can always choose
 * "Continue without signing in" so a classroom emergency (no internet, power
 * cut) never blocks running an exam — cloud saving is just unavailable then.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const cloudUser = useExamStore(s => s.cloudUser);
  const cloudConfigured = useExamStore(s => s.cloudConfigured);
  const cloudStatus = useExamStore(s => s.cloudStatus);
  const cloudError = useExamStore(s => s.cloudError);
  const signIn = useExamStore(s => s.signIn);

  const [checked, setChecked] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    try {
      setOffline(localStorage.getItem(OFFLINE_KEY) === '1');
    } catch {
      setOffline(false);
    }
    setChecked(true);
  }, []);

  const continueOffline = () => {
    try {
      localStorage.setItem(OFFLINE_KEY, '1');
    } catch {
      // ignore
    }
    setOffline(true);
  };

  if (!checked) return null;
  if (!cloudConfigured) return <>{children}</>;
  if (cloudUser || offline) return <>{children}</>;

  const busy = cloudStatus === 'syncing';

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', paddingTop: '4rem', textAlign: 'center' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>MCQ Projector</h1>
      <p className="text-muted" style={{ marginBottom: '2rem' }}>
        Sign in to keep your question papers and settings online, or continue offline for a one-off exam.
      </p>

      <div className="card">
        <button
          className="btn btn-primary"
          onClick={() => void signIn()}
          disabled={busy}
          style={{ width: '100%', marginBottom: '0.75rem', padding: '0.75rem' }}
        >
          {busy ? 'Signing in…' : 'Sign in with Google'}
        </button>

        <button className="btn btn-ghost" onClick={continueOffline} style={{ width: '100%' }}>
          Continue without signing in
        </button>

        {cloudStatus === 'error' && cloudError && (
          <p style={{ color: 'var(--danger)', marginTop: '0.75rem', fontSize: '0.875rem' }} role="alert">
            {cloudError}
          </p>
        )}
        <p className="help-text mt-4" style={{ marginBottom: 0 }}>
          Students never sign in. Only the teacher's papers are stored, and only the signed-in account can read them.
        </p>
      </div>
    </div>
  );
}
