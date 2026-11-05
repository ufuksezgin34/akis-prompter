import { lazy, Suspense, useEffect, useState } from 'react';
import { StoreProvider, useRoute, useStore, navigate, type Route } from './ui/store';
import { Home } from './home/Home';
import { Library } from './library/Library';
import { Editor } from './editor/Editor';
import { Reader } from './playback/Reader';
import { Onboarding } from './ui/Onboarding';
import { UpdatePrompt } from './ui/UpdatePrompt';
import { Icon, type IconName } from './ui/Icon';

const ImportPage = lazy(() => import('./import/ImportPage').then((m) => ({ default: m.ImportPage })));
const settings = () => import('./profiles/SettingsPage');
const SettingsPage = lazy(() => settings().then((m) => ({ default: m.SettingsPage })));
const ReadingViewPage = lazy(() => settings().then((m) => ({ default: m.ReadingViewPage })));
const KeysPage = lazy(() => settings().then((m) => ({ default: m.KeysPage })));
const PrivacyPage = lazy(() => settings().then((m) => ({ default: m.PrivacyPage })));
const BackupPage = lazy(() => import('./backup/BackupPage').then((m) => ({ default: m.BackupPage })));

const TABS: { r: Route; label: string; icon: IconName; match: Route['name'][] }[] = [
  { r: { name: 'home' }, label: 'Ana sayfa', icon: 'home', match: ['home', 'import'] },
  { r: { name: 'library' }, label: 'Metinler', icon: 'file', match: ['library'] },
  { r: { name: 'settings' }, label: 'Ayarlar', icon: 'settings', match: ['settings', 'readingView', 'keys', 'privacy', 'backup'] },
];

function TabBar({ route }: { route: Route }) {
  return (
    <nav className="tabbar" aria-label="Ana menü">
      {TABS.map((t) => {
        const active = t.match.includes(route.name);
        return (
          <button key={t.label} aria-current={active ? 'page' : undefined} onClick={() => navigate(t.r)}>
            <Icon name={t.icon} size={26} />
            <span>{t.label}</span>
          </button>
        );
      })}
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
    document.documentElement.setAttribute('data-theme', app.editorTheme);
  }, [app.editorTheme]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.name]);

  if (!ready) return <div className="boot" aria-busy="true" />;
  if (route.name === 'read') return <Reader key={route.id} id={route.id} />;
  const showTabs = route.name !== 'edit' && route.name !== 'import' && route.name !== 'readingView';
  return (
    <div className={`shell${showTabs ? ' has-tabs' : ''}`}>
      {!online && <div className="offline-pill" role="status">Çevrimdışı — yerel veriler kullanılıyor</div>}
      <Suspense fallback={<main className="page" aria-busy="true" />}>
        {route.name === 'home' && <Home />}
        {route.name === 'library' && <Library />}
        {route.name === 'import' && <ImportPage />}
        {route.name === 'edit' && <Editor key={route.id} id={route.id} />}
        {route.name === 'settings' && <SettingsPage />}
        {route.name === 'readingView' && <ReadingViewPage />}
        {route.name === 'keys' && <KeysPage />}
        {route.name === 'privacy' && <PrivacyPage />}
        {route.name === 'backup' && <BackupPage />}
      </Suspense>
      {showTabs && <TabBar route={route} />}
      {!app.onboardingDone && route.name === 'home' && <Onboarding />}
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
