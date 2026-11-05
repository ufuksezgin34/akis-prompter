import { useEffect, useState } from 'react';
import type { ActionId, KeyMap, Profile } from '../model/types';
import { useStore } from '../ui/store';
import { ACTION_LABELS, DEFAULT_KEYMAP, builtinProfiles } from './defaults';
import { ReaderSettingsPanel } from '../playback/ReaderSettingsPanel';
import { keyLabel, normalizeKey } from '../platform/keyboard';
import { Dialog } from '../ui/common';
import { isStandalone } from '../platform/wakeLock';

export function SettingsPage() {
  const { profiles, activeProfile, app, updateApp, saveProfile, duplicateProfile, removeProfile } = useStore();
  const [editing, setEditing] = useState<Profile | null>(null);
  const [renaming, setRenaming] = useState<Profile | null>(null);
  const [name, setName] = useState('');

  return (
    <main className="page settings">
      <h1>Ayarlar ve profiller</h1>

      <section className="panel">
        <h2>Okuma profilleri</h2>
        <p className="muted">Başlangıç profilleri yalnızca öneridir; tüm değerler düzenlenebilir. Okuma ekranındaki ayar değişiklikleri etkin profile kaydedilir.</p>
        <ul className="profile-list">
          {profiles.map((p) => (
            <li key={p.id} className={p.id === activeProfile.id ? 'active' : ''}>
              <label className="check">
                <input type="radio" name="active-profile" checked={p.id === activeProfile.id} onChange={() => void updateApp({ activeProfileId: p.id })} />
                <strong>{p.name}</strong>
                <span className="muted small">
                  {' '}
                  {p.settings.fontSize}px · {p.settings.speed} px/s{p.settings.mirrorX ? ' · aynalı' : ''}
                  {p.settings.measuredWpm ? ` · ${p.settings.measuredWpm} kelime/dk ölçülmüş` : ''}
                </span>
              </label>
              <div className="row">
                <button className="btn" onClick={() => setEditing(p)}>Düzenle</button>
                <button className="btn" onClick={() => { setRenaming(p); setName(p.name); }}>Yeniden adlandır</button>
                <button className="btn" onClick={() => void duplicateProfile(p)}>Çoğalt</button>
                <button className="btn danger" disabled={profiles.length <= 1} onClick={() => void removeProfile(p.id)}>Sil</button>
              </div>
            </li>
          ))}
        </ul>
        <button
          className="btn"
          onClick={() => {
            const existing = new Set(profiles.map((p) => p.id));
            builtinProfiles()
              .filter((p) => !existing.has(p.id))
              .forEach((p) => void saveProfile(p));
          }}
        >
          Silinen başlangıç profillerini geri ekle
        </button>
      </section>

      <KeymapSection />

      <section className="panel">
        <h2>Görünüm</h2>
        <label className="field-inline">
          Editör teması
          <select value={app.editorTheme} onChange={(e) => void updateApp({ editorTheme: e.target.value as 'system' | 'light' | 'dark' })}>
            <option value="system">Sistem</option>
            <option value="light">Açık</option>
            <option value="dark">Koyu</option>
          </select>
        </label>
        <p className="muted small">Okuma ekranı rengi profil ayarlarından gelir (varsayılan siyah zemin, açık metin).</p>
        <button className="btn" onClick={() => void updateApp({ onboardingDone: false })}>İlk kullanım rehberini tekrar göster</button>
      </section>

      <InstallSection />

      <Dialog open={!!editing} title={`Profil: ${editing?.name ?? ''}`} onClose={() => setEditing(null)} wide>
        {editing && (
          <ReaderSettingsPanel
            s={editing.settings}
            set={(patch) => {
              const next = { ...editing, settings: { ...editing.settings, ...patch } };
              setEditing(next);
              void saveProfile(next);
            }}
          />
        )}
      </Dialog>
      <Dialog
        open={!!renaming}
        title="Profili yeniden adlandır"
        onClose={() => setRenaming(null)}
        actions={
          <button
            className="btn primary"
            disabled={!name.trim()}
            onClick={() => {
              if (renaming) void saveProfile({ ...renaming, name: name.trim() });
              setRenaming(null);
            }}
          >
            Kaydet
          </button>
        }
      >
        <label className="field">
          Ad
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
      </Dialog>
    </main>
  );
}

function KeymapSection() {
  const { app, updateApp } = useStore();
  const [capturing, setCapturing] = useState<ActionId | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Tab') return;
      const k = normalizeKey(e.key);
      // Aynı tuş başka eylemdeyse oradan kaldır.
      const next = Object.fromEntries(
        Object.entries(app.keymap).map(([a, keys]) => [a, a === capturing ? [k] : keys.filter((x) => normalizeKey(x) !== k)]),
      ) as KeyMap;
      void updateApp({ keymap: next });
      setCapturing(null);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [capturing, app.keymap, updateApp]);

  return (
    <section className="panel">
      <h2>Klavye, kumanda ve pedal</h2>
      <p className="muted">
        Klavye gibi davranan Bluetooth sunum kumandaları ve ayak pedalları burada eşlenebilir. Her cihaz farklı tuş gönderir; tüm cihazların çalışacağı garanti edilemez. Aşağıdaki test alanında cihazınıza basıp hangi tuşu gönderdiğini görün.
      </p>
      <div
        className="key-test"
        tabIndex={0}
        role="textbox"
        aria-label="Tuş test alanı: odaklanıp kumandaya basın"
        onKeyDown={(e) => {
          e.preventDefault();
          setLastKey(e.key);
        }}
      >
        {lastKey ? <>Son tuş: <kbd>{keyLabel(lastKey)}</kbd> <span className="muted">({JSON.stringify(lastKey)})</span></> : 'Buraya tıklayıp kumandanın düğmesine basın'}
      </div>
      <table className="keymap">
        <tbody>
          {(Object.keys(ACTION_LABELS) as ActionId[]).map((a) => (
            <tr key={a}>
              <th scope="row">{ACTION_LABELS[a]}</th>
              <td>{(app.keymap[a] ?? []).map((k) => <kbd key={k}>{keyLabel(k)}</kbd>)}</td>
              <td>
                <button className="btn" onClick={() => setCapturing(a)} aria-pressed={capturing === a}>
                  {capturing === a ? 'Bir tuşa basın…' : 'Değiştir'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn" onClick={() => void updateApp({ keymap: structuredClone(DEFAULT_KEYMAP) })}>Varsayılan tuşlara dön</button>
      <p className="muted small">Metin yazılan alanlarda kısayollar devre dışıdır; editörde Boşluk tuşu oynatmayı başlatmaz.</p>
    </section>
  );
}

function InstallSection() {
  const [prompt, setPrompt] = useState<(Event & { prompt(): Promise<void> }) | null>(null);
  useEffect(() => {
    const f = (e: Event) => {
      e.preventDefault();
      setPrompt(e as Event & { prompt(): Promise<void> });
    };
    window.addEventListener('beforeinstallprompt', f);
    return () => window.removeEventListener('beforeinstallprompt', f);
  }, []);
  const standalone = isStandalone();
  return (
    <section className="panel">
      <h2>Uygulama olarak kur (çevrimdışı)</h2>
      {standalone ? (
        <p>Uygulama olarak açılmış durumda.</p>
      ) : (
        <>
          <p>
            <strong>iPhone/iPad (Safari):</strong> Paylaş düğmesi → “Ana Ekrana Ekle”. Açılan simgeden başlatınca tarayıcı çubukları görünmez.
          </p>
          <p>
            <strong>Chrome/Edge:</strong> adres çubuğundaki kur simgesi veya aşağıdaki düğme (tarayıcı sunarsa).
          </p>
          {prompt && <button className="btn primary" onClick={() => void prompt.prompt().then(() => setPrompt(null))}>Uygulamayı kur</button>}
        </>
      )}
      <p className="muted small">
        Çevrimdışı çalışma, sayfa en az bir kez internetle tamamen yüklendikten sonra mümkündür. Veriler bu tarayıcıda/cihazda saklanır; cihazlar arası otomatik eşitleme yoktur — Yedekleme sayfasından dosya ile aktarın.
      </p>
    </section>
  );
}
