'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ConfirmDialogContext {
  confirm: (message: string, onConfirm: () => void, options?: { title?: string; confirmText?: string; cancelText?: string; variant?: 'danger' | 'primary' }) => void;
}

const ConfirmDialogContext = createContext<ConfirmDialogContext | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('Confirm');
  const [confirmText, setConfirmText] = useState('Confirm');
  const [cancelText, setCancelText] = useState('Cancel');
  const [variant, setVariant] = useState<'danger' | 'primary'>('primary');
  const [onConfirmFn, setOnConfirmFn] = useState<(() => void) | null>(null);

  const confirm = useCallback((
    msg: string,
    onConfirm: () => void,
    options?: { title?: string; confirmText?: string; cancelText?: string; variant?: 'danger' | 'primary' }
  ) => {
    setMessage(msg);
    setOnConfirmFn(() => onConfirm);
    setTitle(options?.title ?? 'Confirm');
    setConfirmText(options?.confirmText ?? 'Confirm');
    setCancelText(options?.cancelText ?? 'Cancel');
    setVariant(options?.variant ?? 'primary');
    setOpen(true);
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirmFn?.();
    setOpen(false);
    setOnConfirmFn(null);
  }, [onConfirmFn]);

  const handleCancel = useCallback(() => {
    setOpen(false);
    setOnConfirmFn(null);
  }, []);

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      {open && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="modal">
            <h2 id="confirm-title" className="mb-4">{title}</h2>
            <p className="mb-4">{message}</p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={handleCancel}>{cancelText}</button>
              <button className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`} onClick={handleConfirm}>
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmDialogContext);
  if (!context) throw new Error('useConfirm must be used within ConfirmDialogProvider');
  return context;
}

export function ConfirmDialog() {
  return null;
}