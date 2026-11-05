import { getDB, type SetList, type Take } from './db';
import type { AppSettings, Block, Profile, Script, ScriptVersion } from '../model/types';
import { newId } from '../model/text';
import { builtinProfiles, defaultAppSettings, DEFAULT_KEYMAP } from '../profiles/defaults';

export const MAX_VERSIONS = 15;
const CHANNEL = 'akis-prompter-data';

type ChangeMsg = { kind: 'script'; id: string; revision: number } | { kind: 'profiles' } | { kind: 'all' };

let channel: BroadcastChannel | null = null;
function bc(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  channel ??= new BroadcastChannel(CHANNEL);
  return channel;
}
export function notifyChange(msg: ChangeMsg): void {
  try {
    bc()?.postMessage(msg);
  } catch {
    /* başka sekme bildirimi en iyi çabadır */
  }
}
export function onExternalChange(fn: (m: ChangeMsg) => void): () => void {
  const c = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);
  if (!c) return () => {};
  c.onmessage = (e: MessageEvent<ChangeMsg>) => fn(e.data);
  return () => c.close();
}

export function createScript(title: string, blocks: Block[] = [], now = Date.now()): Script {
  return {
    id: newId(),
    title: title.trim() || 'Adsız metin',
    blocks,
    tags: [],
    folder: '',
    favorite: false,
    createdAt: now,
    updatedAt: now,
    revision: 0,
    deletedAt: null,
    lastPosition: null,
    versions: [],
  };
}

export async function listScripts(): Promise<Script[]> {
  const db = await getDB();
  return db.getAll('scripts');
}

export async function getScript(id: string): Promise<Script | undefined> {
  const db = await getDB();
  return db.get('scripts', id);
}

export type SaveResult = { ok: true; script: Script } | { ok: false; conflict: Script };

/**
 * Revizyon denetimli kayıt. `script.revision`, düzenlemenin başladığı revizyondur.
 * Veritabanındaki revizyon daha yeniyse yazılmaz; çağıran çakışmayı kullanıcıya sunar.
 */
export async function saveScript(script: Script, opts: { force?: boolean } = {}): Promise<SaveResult> {
  const db = await getDB();
  const tx = db.transaction('scripts', 'readwrite');
  const current = await tx.store.get(script.id);
  if (current && current.revision !== script.revision && !opts.force) {
    await tx.done;
    return { ok: false, conflict: current };
  }
  const next: Script = {
    ...script,
    // Okuma konumu içerik değildir; okuyucunun yazdığı son konum korunur.
    lastPosition: current?.lastPosition ?? script.lastPosition,
    revision: (current?.revision ?? script.revision) + 1,
    updatedAt: Date.now(),
  };
  await tx.store.put(next);
  await tx.done;
  notifyChange({ kind: 'script', id: next.id, revision: next.revision });
  return { ok: true, script: next };
}

/** Meta alanlar (favori, etiket, konum) için: içerik revizyonunu ezmeden alan günceller. */
export async function patchScript(id: string, patch: Partial<Pick<Script, 'favorite' | 'tags' | 'folder' | 'title' | 'deletedAt' | 'lastPosition'>>): Promise<Script | undefined> {
  const db = await getDB();
  const tx = db.transaction('scripts', 'readwrite');
  const cur = await tx.store.get(id);
  if (!cur) {
    await tx.done;
    return undefined;
  }
  const touchesContent = 'title' in patch;
  const onlyPosition = Object.keys(patch).every((k) => k === 'lastPosition');
  const next: Script = {
    ...cur,
    ...patch,
    // Yalnızca okuma konumu değiştiyse revizyon artmaz; açık editörlerde sahte çakışma oluşmaz.
    revision: onlyPosition ? cur.revision : cur.revision + 1,
    updatedAt: touchesContent || 'tags' in patch || 'folder' in patch ? Date.now() : cur.updatedAt,
  };
  await tx.store.put(next);
  await tx.done;
  notifyChange({ kind: 'script', id, revision: next.revision });
  return next;
}

export async function deleteScriptForever(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('scripts', id);
  notifyChange({ kind: 'all' });
}

export function withVersion(script: Script, reason: string): Script {
  const last = script.versions[script.versions.length - 1];
  const same = last && JSON.stringify(last.blocks) === JSON.stringify(script.blocks) && last.title === script.title;
  if (same) return script;
  const v: ScriptVersion = { at: Date.now(), reason, title: script.title, blocks: structuredClone(script.blocks) };
  return { ...script, versions: [...script.versions, v].slice(-MAX_VERSIONS) };
}

export function duplicateScript(s: Script): Script {
  const copy = createScript(`${s.title} (kopya)`, s.blocks.map((b) => ({ ...b, id: newId() })));
  return { ...copy, tags: [...s.tags], folder: s.folder };
}

/* Profiller */
export async function listProfiles(): Promise<Profile[]> {
  const db = await getDB();
  let all = await db.getAll('profiles');
  if (all.length === 0) {
    const tx = db.transaction('profiles', 'readwrite');
    for (const p of builtinProfiles()) await tx.store.put(p);
    await tx.done;
    all = await db.getAll('profiles');
  }
  return all;
}

export async function putProfile(p: Profile): Promise<void> {
  const db = await getDB();
  await db.put('profiles', { ...p, updatedAt: Date.now() });
  notifyChange({ kind: 'profiles' });
}

export async function deleteProfile(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('profiles', id);
  notifyChange({ kind: 'profiles' });
}

/* Uygulama ayarları */
export async function getAppSettings(): Promise<AppSettings> {
  const db = await getDB();
  const v = (await db.get('meta', 'app')) as Partial<AppSettings> | undefined;
  const d = defaultAppSettings();
  if (!v) return d;
  return { ...d, ...v, keymap: { ...DEFAULT_KEYMAP, ...(v.keymap ?? {}) } };
}

export async function putAppSettings(s: AppSettings): Promise<void> {
  const db = await getDB();
  await db.put('meta', s, 'app');
}

/* Çekim listeleri ve take kayıtları (Faz B) */
export async function listSetLists(): Promise<SetList[]> {
  return (await getDB()).getAll('setlists');
}
export async function putSetList(s: SetList): Promise<void> {
  await (await getDB()).put('setlists', { ...s, updatedAt: Date.now() });
}
export async function deleteSetList(id: string): Promise<void> {
  await (await getDB()).delete('setlists', id);
}
export async function listTakes(scriptId: string): Promise<Take[]> {
  return (await getDB()).getAllFromIndex('takes', 'scriptId', scriptId);
}
export async function putTake(t: Take): Promise<void> {
  await (await getDB()).put('takes', t);
}
export async function deleteTake(id: string): Promise<void> {
  await (await getDB()).delete('takes', id);
}

/* Kalıcı depolama */
export async function requestPersistence(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!navigator.storage?.persist) return 'unsupported';
  try {
    if (await navigator.storage.persisted()) return 'granted';
    return (await navigator.storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  try {
    const e = await navigator.storage.estimate();
    return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
  } catch {
    return null;
  }
}
