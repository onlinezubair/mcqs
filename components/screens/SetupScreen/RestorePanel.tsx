'use client';

import { useRef, useState } from 'react';
import { useExamStore } from '@/store/examStore';
import { useToast } from '@/components/Toast/Toast';
import {
  restoreSavedExam,
  isRestoreSuccess,
  describeRestoredConfig,
  type RestoredExam,
} from '@/lib/restore';

/**
 * Teacher-facing recovery: pick the ZIP saved earlier, or paste the seed from
 * seed.txt. Whatever they choose, the set count and strategy come along with
 * it, so nothing extra needs to be remembered after a crash.
 */
export function RestorePanel({ onRestored }: { onRestored?: (result: RestoredExam) => void }) {
  const config = useExamStore(s => s.config);
  const draft = useExamStore(s => s.draft);
  const applyRestoredSeed = useExamStore(s => s.applyRestoredSeed);
  const restoreLockedExam = useExamStore(s => s.restoreLockedExam);
  const transition = useExamStore(s => s.transition);
  const { toast } = useToast();

  const fileRef = useRef<HTMLInputElement>(null);
  const [seedInput, setSeedInput] = useState('');
  const [result, setResult] = useState<RestoredExam | null>(null);

  const finish = (restored: RestoredExam) => {
    if (restored.exam) {
      restoreLockedExam(restored.exam);
      toast('Saved exam restored — every set and answer key is back', 'success');
      transition('review');
      return;
    }
    applyRestoredSeed({
      seed: restored.seed,
      numSets: restored.config.numSets,
      setStrategy: restored.config.setStrategy,
      shuffleOptions: restored.config.shuffleOptions,
    });
    setResult(restored);
    toast('Seed restored — paste the same questions, then Build', 'success');
    onRestored?.(restored);
  };

  const handleRestore = (input: ArrayBuffer | string) => {
    const restored = restoreSavedExam(input, {
      fallbackConfig: config,
      fallbackMeta: draft.meta,
    });
    if (!isRestoreSuccess(restored)) {
      toast(restored.message, 'error');
      return;
    }
    finish(restored);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      if (/\.zip$/i.test(file.name)) {
        handleRestore(await file.arrayBuffer());
      } else {
        handleRestore(await file.text());
      }
    } catch {
      toast('Could not read that file.', 'error');
    }
  };

  return (
    <div className="card mb-4" data-testid="restore-panel">
      <h3 className="mb-2">Restore a saved exam</h3>
      <p className="help-text" style={{ marginTop: 0, marginBottom: '0.75rem' }}>
        Power cut or computer trouble? Choose the <strong>.zip</strong> you downloaded earlier, or paste the
        <strong> seed</strong> from <code>seed.txt</code>. The number of sets and set strategy are restored
        automatically — you do not need to remember them.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          ref={fileRef}
          type="file"
          accept=".zip,.txt,application/zip,text/plain"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()}>
          Choose backup ZIP / seed.txt
        </button>

        <input
          className="input"
          style={{ flex: '1 1 180px', minWidth: '160px' }}
          placeholder="…or paste the seed"
          value={seedInput}
          onChange={e => setSeedInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && seedInput.trim()) handleRestore(seedInput);
          }}
        />
        <button
          type="button"
          className="btn"
          disabled={!seedInput.trim()}
          onClick={() => handleRestore(seedInput)}
        >
          Restore seed
        </button>
      </div>

      {result && (
        <p className="help-text mt-2" style={{ marginBottom: 0, color: 'var(--success)' }}>
          Restored: {describeRestoredConfig(result.config)}. Check your question bank below, then Build.
        </p>
      )}
    </div>
  );
}
