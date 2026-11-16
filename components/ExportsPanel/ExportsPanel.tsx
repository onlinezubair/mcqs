'use client';

import { useEffect, useState } from 'react';
import type { ExamDefinition } from '@/types';
import { buildZip, downloadBlob } from '@/lib/exporters';
import { buildMetaFileBase } from '@/lib/meta';
import { useToast } from '@/components/Toast/Toast';
import { PrintArea } from '@/components/PrintArea/PrintArea';

type PrintMode = 'set' | 'paper' | 'answerKey';

interface ExportsPanelProps {
  exam: ExamDefinition;
  /**
   * When true the ZIP button gets the loud neon treatment and the seed badge
   * is shown prominently. Used on Review, where the locked shuffle exists but
   * has not been saved anywhere yet — losing it means it cannot be recovered
   * except by re-running the same seed.
   */
  emphasizeBackup?: boolean;
  onAnswerReview?: () => void;
}

export function ExportsPanel({ exam, emphasizeBackup = false, onAnswerReview }: ExportsPanelProps) {
  const { toast } = useToast();
  const [generatingZip, setGeneratingZip] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode | null>(null);

  const hasPaper = exam.sectionB.length > 0 || exam.sectionC.length > 0;

  const handleDownloadZip = async () => {
    setGeneratingZip(true);
    try {
      const zipBlob = await buildZip(exam);
      downloadBlob(zipBlob, `${buildMetaFileBase(exam.meta)}.zip`);
      setDownloaded(true);
      toast('ZIP downloaded — seed and locked sets saved', 'success');
    } catch {
      toast('Failed to generate ZIP', 'error');
    } finally {
      setGeneratingZip(false);
    }
  };

  const handlePrint = (mode: PrintMode) => {
    setPrintMode(mode);
    requestAnimationFrame(() => {
      window.print();
      setTimeout(() => setPrintMode(null), 500);
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable)) return;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'z') { e.preventDefault(); void handleDownloadZip(); }
      else if (key === 'p' && e.shiftKey) { e.preventDefault(); if (hasPaper) handlePrint('paper'); }
      else if (key === 'p') { e.preventDefault(); handlePrint('set'); }
      else if (key === 'a') { e.preventDefault(); handlePrint('answerKey'); }
      else if (key === 'r' && onAnswerReview) { e.preventDefault(); onAnswerReview(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasPaper, onAnswerReview]);

  return (
    <div className="card mb-4">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>Exports</h3>
        <span className="seed-badge" title="Re-running with this seed reproduces the exact same question and option order">
          Seed <code>{exam.config.seed}</code>
        </span>
      </div>

      {emphasizeBackup && (
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: 0, marginBottom: '1rem' }}>
          <strong style={{ color: '#39ff14' }}>Download the ZIP now.</strong> These shuffled sets are locked in — if
          you lose this tab or change settings, the only way to get this exact paper back is the ZIP (it stores the
          seed and every set&apos;s order).
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        <button
          className={`btn ${emphasizeBackup && !downloaded ? 'btn-neon' : 'btn-primary'}`}
          onClick={handleDownloadZip}
          disabled={generatingZip}
          style={{ minWidth: '180px' }}
        >
          {generatingZip ? 'Generating…' : downloaded ? 'Download ZIP again' : 'Download ZIP'}
          <span className="kbd-hint"><kbd>Z</kbd></span>
        </button>
        <button className="btn" onClick={() => handlePrint('set')} style={{ minWidth: '160px' }}>
          Print Question Paper
          <span className="kbd-hint"><kbd>P</kbd></span>
        </button>
        {hasPaper && (
          <button className="btn" onClick={() => handlePrint('paper')} style={{ minWidth: '160px' }}>
            Print Sections B &amp; C
            <span className="kbd-hint"><kbd>Shift+P</kbd></span>
          </button>
        )}
        <button className="btn" onClick={() => handlePrint('answerKey')} style={{ minWidth: '160px' }}>
          Print Answer Key
          <span className="kbd-hint"><kbd>A</kbd></span>
        </button>
        {onAnswerReview && (
          <button className="btn" onClick={onAnswerReview} style={{ minWidth: '180px' }}>
            Answer Review Mode
            <span className="kbd-hint"><kbd>R</kbd></span>
          </button>
        )}
      </div>

      {printMode && <PrintArea exam={exam} mode={printMode} />}
    </div>
  );
}
