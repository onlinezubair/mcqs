'use client';

import { useExamStore } from '@/store/examStore';
import { useToast } from '@/components/Toast/Toast';

/**
 * Compact cloud account status + paper library for the teacher.
 * Shows a sync indicator; hidden entirely when Firebase is not configured.
 */
export function CloudAccount() {
  const cloudConfigured = useExamStore(s => s.cloudConfigured);
  const cloudUser = useExamStore(s => s.cloudUser);
  const cloudStatus = useExamStore(s => s.cloudStatus);
  const cloudError = useExamStore(s => s.cloudError);
  const cloudPapers = useExamStore(s => s.cloudPapers);
  const signIn = useExamStore(s => s.signIn);
  const signOut = useExamStore(s => s.signOut);
  const syncSettings = useExamStore(s => s.syncSettings);
  const savePaper = useExamStore(s => s.savePaper);
  const loadPaper = useExamStore(s => s.loadPaper);
  const deletePaper = useExamStore(s => s.deletePaper);
  const { toast } = useToast();

  if (!cloudConfigured) return null;

  const busy = cloudStatus === 'syncing';
  const statusLabel =
    cloudStatus === 'syncing' ? 'Syncing…' :
    cloudStatus === 'error' ? 'Sync error' :
    cloudUser ? 'Synced' : 'Local only';
  const statusColor =
    cloudStatus === 'error' ? 'var(--danger)' :
    cloudStatus === 'syncing' ? 'var(--warning)' :
    cloudUser ? 'var(--success)' : 'var(--muted)';

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, display: 'inline-block' }}
          />
          <strong style={{ fontSize: '0.9rem' }}>Cloud</strong>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{statusLabel}</span>
          {cloudUser?.email && (
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              · {cloudUser.email}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {cloudUser ? (
            <>
              <button className="btn btn-sm" disabled={busy} onClick={() => void syncSettings().then(() => toast('Settings synced', 'success'))}>
                Sync settings
              </button>
              <button className="btn btn-sm" disabled={busy} onClick={() => void savePaper().then(() => toast('Paper saved to cloud', 'success')).catch((e: Error) => toast(e.message, 'error'))}>
                Save paper
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => void signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => void signIn()}>
              Sign in
            </button>
          )}
        </div>
      </div>

      {cloudStatus === 'error' && cloudError && (
        <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.5rem', marginBottom: 0 }} role="alert">
          {cloudError}
        </p>
      )}

      {cloudUser && cloudPapers.length > 0 && (
        <details style={{ marginTop: '0.75rem' }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.85rem' }}>Cloud papers ({cloudPapers.length})</summary>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0', display: 'grid', gap: '0.375rem' }}>
            {cloudPapers.map(p => (
              <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.title} <span style={{ color: 'var(--muted)' }}>· {p.subject || 'No subject'}</span>
                </span>
                <span style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                  <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => void loadPaper(p.id)}>Open</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => void deletePaper(p.id)}>Delete</button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
