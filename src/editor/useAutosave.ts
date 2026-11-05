import { useCallback, useEffect, useRef, useState } from 'react';
import type { Script } from '../model/types';
import { saveScript } from '../storage/repo';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

const DEBOUNCE_MS = 600;

/**
 * Kısa debounce ile otomatik kayıt. Görünürlük kaybolduğunda ve sayfa kapanırken bekleyen kaydı
 * hemen başlatır (beforeunload'a tek başına güvenilmez). Hata olursa metin bellekte kalır.
 */
export function useAutosave(onSaved: (s: Script) => void) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Script | null>(null);
  const pending = useRef<Script | null>(null);
  const timer = useRef<number | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  const flush = useCallback(async (): Promise<void> => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inflight.current) await inflight.current;
    const s = pending.current;
    if (!s) return;
    pending.current = null;
    setStatus('saving');
    let blocked = false;
    const p = (async () => {
      try {
        const r = await saveScript(s);
        if (r.ok) {
          setError(null);
          // Kayıt sırasında yeni değişiklik geldiyse onu yeni revizyona taşı.
          if (pending.current) pending.current = { ...pending.current, revision: r.script.revision };
          onSavedRef.current(r.script);
          setStatus(pending.current ? 'saving' : 'saved');
        } else {
          pending.current = s;
          blocked = true;
          setConflict(r.conflict);
          setStatus('conflict');
        }
      } catch (e) {
        pending.current = pending.current ?? s;
        blocked = true;
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    })();
    inflight.current = p;
    await p;
    inflight.current = null;
    if (pending.current && !blocked) schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const schedule = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), DEBOUNCE_MS);
  }, [flush]);

  const queue = useCallback(
    (s: Script) => {
      pending.current = s;
      setStatus('saving');
      schedule();
    },
    [schedule],
  );

  const resolveConflict = useCallback(() => {
    setConflict(null);
    setStatus(pending.current ? 'saving' : 'saved');
  }, []);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    const onPageHide = () => void flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      void flush();
    };
  }, [flush]);

  return { status, error, conflict, queue, flush, resolveConflict, hasPending: () => pending.current !== null || timer.current !== null };
}
