import { useEffect, useRef, type ReactNode } from 'react';

export function Dialog({
  open,
  title,
  onClose,
  children,
  actions,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`dialog${wide ? ' dialog-wide' : ''}`}
      aria-labelledby="dlg-title"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {open && (
        <>
          <header className="dialog-head">
            <h2 id="dlg-title">{title}</h2>
            <button type="button" className="icon-btn" aria-label="Kapat" onClick={onClose}>
              ✕
            </button>
          </header>
          <div className="dialog-body">{children}</div>
          {actions && <footer className="dialog-actions">{actions}</footer>}
        </>
      )}
    </dialog>
  );
}

export function Toast({ message, onClose, action }: { message: string | null; onClose: () => void; action?: ReactNode }) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div className="toast" role="status">
      <span>{message}</span>
      {action}
      <button type="button" className="icon-btn" aria-label="Bildirimi kapat" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
}

export function readFileText(file: File, maxBytes: number): Promise<string> {
  if (file.size > maxBytes) return Promise.reject(new Error(`Dosya çok büyük (${Math.round(file.size / 1024 / 1024)} MB). Sınır ${Math.round(maxBytes / 1024 / 1024)} MB.`));
  return file.text();
}

/** Metin dosyası mı? Uzantıya tek başına güvenmeden ilk baytlarda NUL karakteri arar. */
export async function looksLikeText(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  return !head.includes(0);
}
