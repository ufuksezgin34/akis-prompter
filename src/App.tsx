import { lazy, Suspense, useEffect, useState } from 'react';
import { StoreProvider, useRoute, useStore, navigate, type Route } from './ui/store';
import { Library } from './library/Library';
import { Editor } from './editor/Editor';
import { Reader } from './playback/Reader';
import { Onboarding } from './ui/Onboarding';
import { UpdatePrompt } from './ui/UpdatePrompt';
import { Icon, type IconName } from './ui/Icon';

const SettingsPage = lazy(() => import('./profiles/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const BackupPage = lazy(() => import('./backup/BackupPage').then((m) => ({ default: m.BackupPage })));

function Nav({ route }: { route: Route }) {
  const items: { r: Route; label: string; icon: IconName }[] = [
    { r: { name: 'library' }, label: 'Metinlerim', icon: 'library' },
    { r: { name: 'settings' }, label: 'Ayarlar', icon: 'settings' },
    { r: { name: 'backup' }, label: 'Yedekleme', icon: 'backup' },
  ];
  return (
    <nav className="app-nav" aria-label="Ana menü">
      <span className="brand" aria-hidden="true">
        <span className="brand-mark" />
        Teleprompter
      </span>
      {items.map((i) => (
        <button key={i.r.name} aria-current={route.name === i.r.name ? 'page' : undefined} onClick={() => navigate(i.r)}>
          <Icon name={i.icon} /> <span>{i.label}</span>
        </button>
      ))}
    </nav>
  );
}

function Shell() {
  const route = useRoute();
  const { app, ready } = useStore();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', app.editorTheme);
  }, [app.editorTheme]);

  if (!ready) return <div className="boot" aria-busy="true" />;
  if (route.name === 'read') return <Reader key={route.id} id={route.id} />;
  return (
    <div className="shell">
      {route.name !== 'edit' && <Nav route={route} />}
      {!online && <div className="offline-pill" role="status">Çevrimdışı — yerel veriler kullanılıyor</div>}
      <Suspense fallback={<main className="page" aria-busy="true" />}>
        {route.name === 'library' && <Library />}
        {route.name === 'edit' && <Editor key={route.id} id={route.id} />}
        {route.name === 'settings' && <SettingsPage />}
        {route.name === 'backup' && <BackupPage />}
      </Suspense>
      {!app.onboardingDone && <Onboarding />}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
      <UpdatePrompt />
      <div id="sr-announcer" className="sr-only" aria-live="polite" />
    </StoreProvider>
  );
}
