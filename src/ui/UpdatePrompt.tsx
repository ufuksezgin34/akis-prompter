import { useEffect, useRef, useState } from 'react';
import { getReaderActivity, onReaderActivity } from './readerActivity';

/**
 * Service worker güncellemesi yalnızca kullanıcıya sunulur; sayfa asla kendiliğinden yenilenmez.
 * Okuma ekranı açıkken gösterilmez — çekim bitince, okuma dışındaki ekranda belirir.
 */
export function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [reading, setReading] = useState(getReaderActivity() !== false);
  const updateRef = useRef<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => onReaderActivity((a) => setReading(a !== false)), []);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
    let cancelled = false;
    void import('virtual:pwa-register').then(({ registerSW }) => {
      if (cancelled) return;
      updateRef.current = registerSW({
        immediate: true,
        onNeedRefresh: () => setNeedRefresh(true),
        onOfflineReady: () => setOfflineReady(true),
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (reading) return null;
  if (needRefresh)
    return (
      <div className="update-bar" role="status">
        Yeni sürüm hazır. Açık metinler kaydedildikten sonra yenileyin.
        <button className="btn primary" onClick={() => void updateRef.current?.(true)}>Şimdi güncelle</button>
        <button className="btn ghost" onClick={() => setNeedRefresh(false)}>Sonra</button>
      </div>
    );
  if (offlineReady)
    return (
      <div className="update-bar" role="status">
        Uygulama çevrimdışı kullanıma hazır.
        <button className="btn ghost" onClick={() => setOfflineReady(false)}>Tamam</button>
      </div>
    );
  return null;
}
