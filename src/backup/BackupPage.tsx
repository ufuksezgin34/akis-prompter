import { useEffect, useRef, useState } from 'react';
import { applyBackup, backupFilename, buildBackup, downloadText, parseBackup, BackupError, MAX_BACKUP_BYTES, type ConflictPolicy, type ParsedBackup } from './backup';
import { requestPersistence, storageEstimate } from '../storage/repo';
import { useStore } from '../ui/store';
import { Toast } from '../ui/common';

function mb(n: number) {
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function BackupPage() {
  const { app, updateApp } = useStore();
  const [parsed, setParsed] = useState<ParsedBackup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [policy, setPolicy] = useState<ConflictPolicy>('copy');
  const [toast, setToast] = useState<string | null>(null);
  const [est, setEst] = useState<{ usage: number; quota: number } | null>(null);
  const [persist, setPersist] = useState<string>('');
  const [backedUpNow, setBackedUpNow] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void storageEstimate().then(setEst);
    void navigator.storage?.persisted?.().then((p) => setPersist(p ? 'Kalıcı depolama izni verildi.' : ''));
  }, []);

  const exportAll = async () => {
    try {
      const data = await buildBackup();
      await downloadText(backupFilename(), JSON.stringify(data, null, 2));
      setBackedUpNow(true);
      setToast(`${data.scripts.length} metin ve ${data.profiles.length} profil dışa aktarıldı.`);
    } catch (e) {
      setToast(`Yedek oluşturulamadı: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const onFile = async (f: File | undefined) => {
    setParsed(null);
    setError(null);
    if (!f) return;
    try {
      if (f.size > MAX_BACKUP_BYTES) throw new BackupError('Dosya 50 MB sınırını aşıyor.');
      setParsed(parseBackup(await f.text(), f.size));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const doImport = async () => {
    if (!parsed) return;
    try {
      const sum = await applyBackup(parsed.data, mode, policy);
      setParsed(null);
      setToast(`İçe aktarıldı: ${sum.added} yeni, ${sum.copied} kopya, ${sum.overwritten} üzerine yazıldı, ${sum.skipped} aynı/atlandı.`);
    } catch (e) {
      setError(`İçe aktarma tamamlanamadı; mevcut veriler değişmedi. (${e instanceof Error ? e.message : String(e)})`);
    }
  };

  return (
    <main className="page backup">
      <h1>Yedekleme ve aktarım</h1>

      <section className="panel">
        <h2>Tam yedek (JSON)</h2>
        <p>
          Kapsam: tüm metinler (bloklar, etiketler, yerel sürümler, son konum), okuma profilleri, çekim listeleri ve take notları.{' '}
          <strong>Video kayıtları dahil değildir</strong>; kayıtlar ayrıca dosya olarak indirilir.
        </p>
        <button className="btn primary" onClick={() => void exportAll()}>Yedeği indir</button>
        <p className="muted small">Başka cihaza aktarmak için bu dosyayı oraya gönderip aşağıdan içe alın. Otomatik eşitleme yoktur.</p>
      </section>

      <section className="panel">
        <h2>Yedekten geri yükle</h2>
        <input ref={fileRef} type="file" accept=".json,application/json" onChange={(e) => void onFile(e.target.files?.[0])} aria-label="Yedek dosyası seç" />
        {error && <p className="error" role="alert">{error}</p>}
        {parsed && (
          <div className="preview">
            <p>
              <strong>Önizleme:</strong> {parsed.data.scripts.length} metin, {parsed.data.profiles.length} profil, {parsed.data.setlists.length} çekim listesi,{' '}
              {parsed.data.takes.length} take kaydı. {parsed.data.exportedAt && `Oluşturma: ${new Date(parsed.data.exportedAt).toLocaleString('tr-TR')}.`}
            </p>
            {parsed.warnings.map((w) => (
              <p key={w} className="warn-text">{w}</p>
            ))}
            <ul className="preview-list">
              {parsed.data.scripts.slice(0, 10).map((s) => (
                <li key={s.id}>{s.title}{s.deletedAt ? ' (çöp kutusunda)' : ''}</li>
              ))}
              {parsed.data.scripts.length > 10 && <li className="muted">… ve {parsed.data.scripts.length - 10} metin daha</li>}
            </ul>
            <fieldset>
              <legend>Nasıl yüklensin?</legend>
              <label className="check">
                <input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Birleştir (mevcut metinler kalır)
              </label>
              <label className="check">
                <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Tümünü değiştir (bu cihazdaki tüm veriler silinir)
              </label>
            </fieldset>
            {mode === 'merge' && (
              <label className="field-inline">
                Aynı metnin farklı içeriği varsa
                <select value={policy} onChange={(e) => setPolicy(e.target.value as ConflictPolicy)}>
                  <option value="copy">Yedektekini kopya olarak ekle</option>
                  <option value="skip">Buradakini koru, yedektekini atla</option>
                  <option value="overwrite">Yedektekiyle üzerine yaz</option>
                </select>
              </label>
            )}
            {mode === 'replace' && !backedUpNow && (
              <p className="warn-text">
                Değiştirmeden önce mevcut verilerin yedeğini almanız önerilir.{' '}
                <button className="btn" onClick={() => void exportAll()}>Önce mevcut verileri yedekle</button>
              </p>
            )}
            <div className="row">
              <button className="btn" onClick={() => setParsed(null)}>Vazgeç</button>
              <button className={`btn ${mode === 'replace' ? 'danger' : 'primary'}`} onClick={() => void doImport()}>
                {mode === 'replace' ? 'Tümünü değiştir' : 'Birleştir'}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Depolama</h2>
        {est ? <p>Kullanılan: {mb(est.usage)} / tarayıcının bu site için ayırdığı yaklaşık alan: {mb(est.quota)}</p> : <p className="muted">Depolama bilgisi alınamadı.</p>}
        <p className="muted small">
          Tarayıcı verileri, özellikle uzun süre kullanılmayan sitelerde veya disk dolunca silinebilir. Kalıcı depolama izni bu riski azaltır ama garanti değildir; düzenli yedek alın.
        </p>
        <button
          className="btn"
          onClick={async () => {
            const r = await requestPersistence();
            await updateApp({ persistRequested: true });
            setPersist(
              r === 'granted'
                ? 'Kalıcı depolama izni verildi.'
                : r === 'denied'
                  ? 'Tarayıcı izni vermedi. Uygulamayı ana ekrana ekleyip sık kullanmak bazı tarayıcılarda izni kolaylaştırır.'
                  : 'Bu tarayıcı kalıcı depolama isteğini desteklemiyor.',
            );
          }}
        >
          Kalıcı depolama iste
        </button>
        {persist && <p role="status">{persist}</p>}
        {!persist && app.persistRequested && <p className="muted small">Daha önce istendi.</p>}
      </section>
      <Toast message={toast} onClose={() => setToast(null)} />
    </main>
  );
}
