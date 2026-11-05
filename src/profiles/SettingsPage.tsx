import { useEffect, useState } from 'react';
import type { ActionId, CountdownSeconds, KeyMap, Profile, ReaderSettings } from '../model/types';
import { useStore } from '../ui/store';
import { ACTION_LABELS, DEFAULT_KEYMAP, clampSettings } from './defaults';
import { navigate } from '../ui/store';
import { Icon, type IconName } from '../ui/Icon';
import { Brand, Group, PageHead, Row, Switch } from '../ui/kit';
import { ReaderSettingsPanel } from '../playback/ReaderSettingsPanel';
import { keyLabel, normalizeKey } from '../platform/keyboard';
import { Dialog } from '../ui/common';
import { isStandalone } from '../platform/wakeLock';
import { isNative } from '../platform/native';

export function SettingsPage() {
  const { profiles, activeProfile, app, updateApp, saveProfile, duplicateProfile, removeProfile } = useStore();
  const [renaming, setRenaming] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [nameEdit, setNameEdit] = useState(false);
  const [wsName, setWsName] = useState(app.workspaceName);
  const [profileMenu, setProfileMenu] = useState<Profile | null>(null);
  const st = activeProfile.settings;
  const setActive = (patch: Partial<ReaderSettings>) => void saveProfile({ ...activeProfile, settings: { ...st, ...patch } });
  const initial = app.workspaceName.trim().charAt(0).toLocaleUpperCase('tr');

  return (
    <main className="page settings">
      <Brand center />
      <PageHead title="Ayarlar" />

      <button className="profile-card" onClick={() => { setWsName(app.workspaceName); setNameEdit(true); }}>
        <span className="avatar big">{initial || <Icon name="profile" size={30} />}</span>
        <span className="profile-text">
          <strong>{app.workspaceName.trim() || 'Adını ekle'}</strong>
          <span>Kişisel çalışma alanı · yalnızca bu cihazda</span>
        </span>
        <Icon name="nextSentence" size={22} />
      </button>

      <Group title="Okuma ve çekim">
        <Row icon="monitor" label="Okuma görünümü" hint={activeProfile.name} onClick={() => navigate({ name: 'readingView' })} />
        <Row icon="gauge" label="Varsayılan kaydırma hızı" hint={`${st.wpm} kelime/dk`}>
          <span className="stepper">
            <button aria-label="Hızı azalt" onClick={() => setActive({ wpm: Math.max(40, st.wpm - 5) })}><Icon name="minus" size={18} /></button>
            <button aria-label="Hızı artır" onClick={() => setActive({ wpm: Math.min(300, st.wpm + 5) })}><Icon name="plus" size={18} /></button>
          </span>
        </Row>
        <Row icon="timer" label="Geri sayım">
          <select className="row-select" aria-label="Geri sayım" value={st.countdown} onChange={(e) => setActive({ countdown: Number(e.target.value) as CountdownSeconds })}>
            <option value={0}>Kapalı</option>
            <option value={3}>3 saniye</option>
            <option value={5}>5 saniye</option>
            <option value={10}>10 saniye</option>
          </select>
        </Row>
        <Row icon="phone" label="Ekranı açık tut" hint="Okurken ekran kararmasın">
          <Switch checked={app.keepAwake} onChange={(v) => void updateApp({ keepAwake: v })} label="Ekranı açık tut" />
        </Row>
        <Row icon="keyboard" label="Klavye, kumanda ve pedal" onClick={() => navigate({ name: 'keys' })} />
      </Group>

      <Group title="Profiller">
        {profiles.map((p) => (
          <div key={p.id} className={`list-row profile-row${p.id === activeProfile.id ? ' is-active' : ''}`}>
            <label className="profile-pick">
              <input type="radio" name="active-profile" checked={p.id === activeProfile.id} onChange={() => void updateApp({ activeProfileId: p.id })} />
              <span className="row-label">
                {p.name}
                <small>{p.settings.fontSize}px · {p.settings.wpm} kelime/dk{p.settings.mirrorX ? ' · aynalı' : ''}</small>
              </span>
            </label>
            <button className="icon-btn" aria-label={`${p.name} seçenekleri`} onClick={() => setProfileMenu(p)}><Icon name="more" /></button>
          </div>
        ))}
      </Group>

      <Group title="Veriler">
        <Row icon="upload" label="Yedek dışa aktar" onClick={() => navigate({ name: 'backup' })} />
        <Row icon="backup" label="Yedek içe aktar" onClick={() => navigate({ name: 'backup' })} />
      </Group>

      <Group title="Uygulama">
        <Row
          icon="monitor"
          label="Tema"
          value={undefined}
        >
          <select className="row-select" aria-label="Uygulama teması" value={app.editorTheme} onChange={(e) => void updateApp({ editorTheme: e.target.value as 'system' | 'light' | 'dark' })}>
            <option value="dark">Koyu</option>
            <option value="light">Açık</option>
            <option value="system">Sistem</option>
          </select>
        </Row>
        <Row icon="book" label="Kullanım rehberi" onClick={() => { void updateApp({ onboardingDone: false }); navigate({ name: 'home' }); }} />
        <Row icon="shield" label="Gizlilik" onClick={() => navigate({ name: 'privacy' })} />
      </Group>

      {!isNative() && <InstallSection />}
      <p className="foot-note">Metinlerin bu cihazda saklanır.</p>

      <Dialog
        open={nameEdit}
        title="Çalışma alanı adı"
        onClose={() => setNameEdit(false)}
        actions={<button className="btn primary" onClick={() => { void updateApp({ workspaceName: wsName.trim() }); setNameEdit(false); }}>Kaydet</button>}
      >
        <label className="field">
          Ad (isteğe bağlı)
          <input value={wsName} onChange={(e) => setWsName(e.target.value)} autoFocus maxLength={40} placeholder="ör. Stüdyo" />
        </label>
        <p className="muted small">Yalnızca bu cihazda görünür; hesap veya sunucu yoktur.</p>
      </Dialog>

      <Dialog open={!!profileMenu} title={profileMenu?.name ?? ''} onClose={() => setProfileMenu(null)}>
        {profileMenu && (
          <div className="menu-sheet">
            <button className="sheet-row" onClick={() => { void updateApp({ activeProfileId: profileMenu.id }); setProfileMenu(null); navigate({ name: 'readingView' }); }}>
              <Icon name="edit" /> Düzenle
            </button>
            <button className="sheet-row" onClick={() => { setRenaming(profileMenu); setName(profileMenu.name); setProfileMenu(null); }}>
              <Icon name="file" /> Yeniden adlandır
            </button>
            <button className="sheet-row" onClick={() => { void duplicateProfile(profileMenu); setProfileMenu(null); }}>
              <Icon name="copy" /> Çoğalt
            </button>
            <button className="sheet-row danger" disabled={profiles.length <= 1} onClick={() => { void removeProfile(profileMenu.id); setProfileMenu(null); }}>
              <Icon name="trash" /> Sil
            </button>
          </div>
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

const PREVIEW_TEXT = 'Kendi ritminde anlatmaya devam et.';

export function ReadingViewPage() {
  const { profiles, activeProfile, saveProfile, updateApp } = useStore();
  const [draft, setDraft] = useState<ReaderSettings>(activeProfile.settings);
  useEffect(() => {
    setDraft(activeProfile.settings);
  }, [activeProfile.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<ReaderSettings>) => setDraft((d) => clampSettings({ ...d, ...p }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(activeProfile.settings);
  const pfs = Math.min(draft.fontSize, 64);

  return (
    <main className="page reading-view">
      <PageHead title="Okuma görünümü" onBack={() => navigate({ name: 'settings' })} />
      <label className="field-inline">
        Profil
        <select value={activeProfile.id} onChange={(e) => void updateApp({ activeProfileId: e.target.value })}>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>

      <div
        className="rv-preview"
        style={{ background: draft.bgColor, color: draft.textColor, fontSize: pfs, lineHeight: draft.lineHeight, fontWeight: draft.fontWeight }}
        aria-label="Önizleme"
      >
        <div style={{ width: `${draft.columnWidth}%`, transform: draft.mirrorX ? 'scaleX(-1)' : undefined, textAlign: draft.align }}>
          {PREVIEW_TEXT.split(' ').map((w, i) => (
            <span key={i} className={i === 2 ? `rv-hot${draft.showReadingMarker ? ' with-marker' : ''}` : undefined}>{w} </span>
          ))}
        </div>
      </div>

      <div className="group-card sliders">
        <SliderRow icon="text" label="Yazı boyutu" value={draft.fontSize} min={18} max={160} onChange={(v) => set({ fontSize: v })} />
        <SliderRow icon="lines" label="Satır aralığı" value={draft.lineHeight} min={1.1} max={2.5} step={0.05} fmt={(v) => v.toFixed(2)} onChange={(v) => set({ lineHeight: v })} />
        <SliderRow icon="fullscreen" label="Metin genişliği" value={draft.columnWidth} min={20} max={100} fmt={(v) => `${v}%`} onChange={(v) => set({ columnWidth: v })} />
      </div>

      <div className="group-card">
        <Row icon="mirror" label="Ayna modu" hint="Prompter camı için yatay çevirir">
          <Switch checked={draft.mirrorX} onChange={(v) => set({ mirrorX: v })} label="Ayna modu" />
        </Row>
        <Row icon="lines" label="Okuma çizgisi">
          <Switch checked={draft.showReadingMarker} onChange={(v) => set({ showReadingMarker: v })} label="Okuma çizgisi" />
        </Row>
      </div>

      <div className="group-card">
        <ReaderSettingsPanel s={draft} set={set} compact />
      </div>

      <button
        className="btn primary big block sticky-cta"
        disabled={!dirty}
        onClick={async () => {
          await saveProfile({ ...activeProfile, settings: draft });
          navigate({ name: 'settings' });
        }}
      >
        {dirty ? 'Uygula' : 'Kaydedildi'}
      </button>
    </main>
  );
}

function SliderRow({ icon, label, value, min, max, step = 1, fmt = (v: number) => String(Math.round(v)), onChange }: { icon: IconName; label: string; value: number; min: number; max: number; step?: number; fmt?: (v: number) => string; onChange: (v: number) => void }) {
  const id = `sr-${label}`;
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider-row">
      <span className="row-icon"><Icon name={icon} /></span>
      <div className="slider-body">
        <label htmlFor={id}>
          {label} <output>{fmt(value)}</output>
        </label>
        <input id={id} className="range" type="range" min={min} max={max} step={step} value={value} style={{ '--pct': `${pct}%` } as React.CSSProperties} onChange={(e) => onChange(Number(e.target.value))} />
      </div>
    </div>
  );
}

export function KeysPage() {
  return (
    <main className="page">
      <PageHead title="Klavye ve kumanda" onBack={() => navigate({ name: 'settings' })} />
      <KeymapSection />
    </main>
  );
}

export function PrivacyPage() {
  return (
    <main className="page prose">
      <PageHead title="Gizlilik" onBack={() => navigate({ name: 'settings' })} />
      <div className="group-card pad">
        <p><strong>Verilerin cihazında kalır.</strong> Metinlerin, profillerin ve ayarların yalnızca bu cihazdaki uygulama deposunda saklanır. Hiçbir sunucuya gönderilmez.</p>
        <p><strong>Hesap, reklam ve takip yok.</strong> Uygulama hesap istemez, reklam göstermez, analiz veya izleme aracı kullanmaz.</p>
        <p><strong>İzinler.</strong> Temel okuma için kamera veya mikrofon izni gerekmez. Ekranı açık tutma yalnızca okuma ekranındayken kullanılır.</p>
        <p><strong>Yedekler.</strong> Yedek dosyasını sen oluşturur ve nereye kaydedeceğini sen seçersin. Uygulamayı silersen cihazdaki veriler de silinir; önce yedek al.</p>
      </div>
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
