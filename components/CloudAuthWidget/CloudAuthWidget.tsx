'use client';

import { useExamStore } from '@/store/examStore';
import { useToast } from '@/components/Toast/Toast';

export function CloudAuthWidget() {
  const { toast } = useToast();
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) return null;

  return (
    <div className="card" style={{ maxWidth: '400px' }}>
      <h3 className="mb-4">Google Drive Sync</h3>
      <p className="help-text mb-4">
        Sign in to back up exam settings and papers to your Google Drive.
        Papers include answer keys and are stored in your private Drive folder.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" disabled>
          Sign in with Google
        </button>
        <button className="btn btn-ghost" disabled>
          Sync Settings
        </button>
      </div>
    </div>
  );
}