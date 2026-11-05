import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppSettings, Profile, ReaderSettings } from '../model/types';
import { deleteProfile, getAppSettings, listProfiles, onExternalChange, putAppSettings, putProfile } from '../storage/repo';
import { BASE_SETTINGS, defaultAppSettings } from '../profiles/defaults';
import { newId } from '../model/text';

interface Store {
  ready: boolean;
  dbError: string | null;
  profiles: Profile[];
  app: AppSettings;
  activeProfile: Profile;
  updateApp(patch: Partial<AppSettings>): Promise<void>;
  saveProfile(p: Profile): Promise<void>;
  updateActiveSettings(patch: Partial<ReaderSettings>): Promise<void>;
  duplicateProfile(p: Profile): Promise<Profile>;
  removeProfile(id: string): Promise<void>;
}

const Ctx = createContext<Store | null>(null);

const FALLBACK_PROFILE: Profile = { id: 'fallback', name: 'Varsayılan', builtin: true, updatedAt: 0, settings: BASE_SETTINGS };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [app, setApp] = useState<AppSettings>(defaultAppSettings);
  const appRef = useRef(app);
  appRef.current = app;

  const load = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([listProfiles(), getAppSettings()]);
      setProfiles(p.sort((x, y) => x.name.localeCompare(y.name, 'tr')));
      setApp(a);
      setDbError(null);
    } catch (e) {
      setDbError(
        `Yerel veritabanı açılamadı (${e instanceof Error ? e.message : String(e)}). Gizli/özel pencere veya engellenmiş site verisi buna yol açabilir. Metinleriniz kaydedilemeyecek; normal pencerede açın veya site verisi iznini verin.`,
      );
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void load();
    return onExternalChange((m) => {
      if (m.kind !== 'script') void load();
    });
  }, [load]);

  const activeProfile = profiles.find((p) => p.id === app.activeProfileId) ?? profiles[0] ?? FALLBACK_PROFILE;

  const updateApp = useCallback(async (patch: Partial<AppSettings>) => {
    const next = { ...appRef.current, ...patch };
    appRef.current = next;
    setApp(next);
    await putAppSettings(next);
  }, []);

  const saveProfile = useCallback(async (p: Profile) => {
    setProfiles((cur) => {
      const has = cur.some((x) => x.id === p.id);
      return (has ? cur.map((x) => (x.id === p.id ? p : x)) : [...cur, p]).sort((x, y) => x.name.localeCompare(y.name, 'tr'));
    });
    await putProfile(p);
  }, []);

  const updateActiveSettings = useCallback(
    async (patch: Partial<ReaderSettings>) => {
      if (activeProfile.id === FALLBACK_PROFILE.id) return;
      await saveProfile({ ...activeProfile, settings: { ...activeProfile.settings, ...patch } });
    },
    [activeProfile, saveProfile],
  );

  const duplicateProfile = useCallback(
    async (p: Profile) => {
      const copy: Profile = { ...structuredClone(p), id: newId(), name: `${p.name} (kopya)`, builtin: false, updatedAt: Date.now() };
      await saveProfile(copy);
      return copy;
    },
    [saveProfile],
  );

  const removeProfile = useCallback(
    async (id: string) => {
      if (profiles.length <= 1) return;
      setProfiles((cur) => cur.filter((x) => x.id !== id));
      await deleteProfile(id);
      if (app.activeProfileId === id) {
        const other = profiles.find((x) => x.id !== id);
        if (other) await updateApp({ activeProfileId: other.id });
      }
    },
    [profiles, app.activeProfileId, updateApp],
  );

  const value = useMemo<Store>(
    () => ({ ready, dbError, profiles, app, activeProfile, updateApp, saveProfile, updateActiveSettings, duplicateProfile, removeProfile }),
    [ready, dbError, profiles, app, activeProfile, updateApp, saveProfile, updateActiveSettings, duplicateProfile, removeProfile],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider eksik');
  return s;
}

/* Basit hash yönlendirme: statik hosting'de sunucu ayarı gerektirmez. */
export type Route =
  | { name: 'home' }
  | { name: 'library' }
  | { name: 'import' }
  | { name: 'edit'; id: string }
  | { name: 'read'; id: string }
  | { name: 'settings' }
  | { name: 'readingView' }
  | { name: 'keys' }
  | { name: 'privacy' }
  | { name: 'backup' };

const SIMPLE: Record<string, Route['name']> = {
  texts: 'library',
  import: 'import',
  settings: 'settings',
  'reading-view': 'readingView',
  keys: 'keys',
  privacy: 'privacy',
  backup: 'backup',
};

export function parseRoute(hash: string): Route {
  const [, a, b] = hash.replace(/^#/, '').split('/');
  if (a === 'edit' && b) return { name: 'edit', id: decodeURIComponent(b) };
  if (a === 'read' && b) return { name: 'read', id: decodeURIComponent(b) };
  const n = a ? SIMPLE[a] : undefined;
  return n ? ({ name: n } as Route) : { name: 'home' };
}

export function routeHash(r: Route): string {
  switch (r.name) {
    case 'edit':
      return `#/edit/${encodeURIComponent(r.id)}`;
    case 'read':
      return `#/read/${encodeURIComponent(r.id)}`;
    case 'home':
      return '#/';
    default: {
      const key = Object.keys(SIMPLE).find((k) => SIMPLE[k] === r.name)!;
      return `#/${key}`;
    }
  }
}

export function navigate(r: Route): void {
  window.location.hash = routeHash(r);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const f = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return route;
}

/** Ekran okuyucu için seyrek duyurular (her karede değil). */
export function announce(msg: string): void {
  const el = document.getElementById('sr-announcer');
  if (el) {
    el.textContent = '';
    window.setTimeout(() => (el.textContent = msg), 30);
  }
}
