import type { Block, BlockType, Profile, Script } from '../model/types';
import { getDB, type SetList, type Take } from '../storage/db';
import { newId } from '../model/text';
import { clampSettings, BASE_SETTINGS } from '../profiles/defaults';
import { notifyChange } from '../storage/repo';

export const BACKUP_SCHEMA_VERSION = 1;
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

/**
 * Yedek kapsamı: metinler (bloklar, etiketler, sürümler, son konum), profiller, çekim listeleri,
 * take notları. Video kayıtları yedeğe DAHİL DEĞİLDİR; ayrı dosya olarak dışa aktarılır.
 */
export interface BackupFile {
  app: 'akis-prompter';
  schemaVersion: number;
  exportedAt: string;
  scripts: Script[];
  profiles: Profile[];
  setlists: SetList[];
  takes: Take[];
}

export async function buildBackup(): Promise<BackupFile> {
  const db = await getDB();
  const tx = db.transaction(['scripts', 'profiles', 'setlists', 'takes'], 'readonly');
  const [scripts, profiles, setlists, takes] = await Promise.all([
    tx.objectStore('scripts').getAll(),
    tx.objectStore('profiles').getAll(),
    tx.objectStore('setlists').getAll(),
    tx.objectStore('takes').getAll(),
  ]);
  await tx.done;
  return { app: 'akis-prompter', schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: new Date().toISOString(), scripts, profiles, setlists, takes };
}

export class BackupError extends Error {}

const BLOCK_TYPES: BlockType[] = ['heading', 'speech', 'note'];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

function validBlock(v: unknown): Block | null {
  if (!isObj(v)) return null;
  const type = v.type as BlockType;
  if (!BLOCK_TYPES.includes(type) || typeof v.text !== 'string') return null;
  return { id: str(v.id) || newId(), type, text: v.text };
}

function validScript(v: unknown): Script | null {
  if (!isObj(v) || typeof v.id !== 'string' || !Array.isArray(v.blocks)) return null;
  const blocks = v.blocks.map(validBlock);
  if (blocks.some((b) => b === null)) return null;
  const versions = Array.isArray(v.versions)
    ? v.versions.flatMap((x) => {
        if (!isObj(x) || !Array.isArray(x.blocks)) return [];
        const vb = x.blocks.map(validBlock);
        if (vb.some((b) => b === null)) return [];
        return [{ at: num(x.at), reason: str(x.reason), title: str(x.title), blocks: vb as Block[] }];
      })
    : [];
  const lp = isObj(v.lastPosition) && typeof v.lastPosition.blockId === 'string'
    ? {
        blockId: v.lastPosition.blockId,
        fraction: Math.min(1, Math.max(0, num(v.lastPosition.fraction))),
        ...(typeof v.lastPosition.sentence === 'number' ? { sentence: v.lastPosition.sentence, sentenceFraction: Math.min(1, Math.max(0, num(v.lastPosition.sentenceFraction))) } : {}),
      }
    : null;
  return {
    id: v.id,
    title: str(v.title, 'Adsız metin'),
    blocks: blocks as Block[],
    tags: Array.isArray(v.tags) ? v.tags.filter((t): t is string => typeof t === 'string') : [],
    folder: str(v.folder),
    favorite: v.favorite === true,
    createdAt: num(v.createdAt, Date.now()),
    updatedAt: num(v.updatedAt, Date.now()),
    revision: num(v.revision),
    deletedAt: typeof v.deletedAt === 'number' ? v.deletedAt : null,
    lastPosition: lp,
    versions,
  };
}

function validProfile(v: unknown): Profile | null {
  if (!isObj(v) || typeof v.id !== 'string' || !isObj(v.settings)) return null;
  return {
    id: v.id,
    name: str(v.name, 'Profil'),
    builtin: v.builtin === true,
    updatedAt: num(v.updatedAt, Date.now()),
    settings: clampSettings({ ...BASE_SETTINGS, ...(v.settings as object) }),
  };
}

export interface ParsedBackup {
  data: BackupFile;
  warnings: string[];
}

/** Yükleme öncesi doğrulama. Veritabanına hiçbir şey yazmaz. */
export function parseBackup(text: string, byteSize = text.length): ParsedBackup {
  if (byteSize > MAX_BACKUP_BYTES) throw new BackupError('Yedek dosyası çok büyük (sınır 50 MB).');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('Dosya geçerli bir JSON değil. Akış Prompter yedeği seçtiğinizden emin olun.');
  }
  if (!isObj(raw) || raw.app !== 'akis-prompter') throw new BackupError('Bu dosya bir Akış Prompter yedeği değil.');
  const sv = num(raw.schemaVersion, -1);
  if (sv < 1) throw new BackupError('Yedek şema sürümü okunamadı.');
  if (sv > BACKUP_SCHEMA_VERSION)
    throw new BackupError(`Yedek daha yeni bir uygulama sürümüyle (şema ${sv}) oluşturulmuş. Önce uygulamayı güncelleyin.`);
  const warnings: string[] = [];
  const pick = <T,>(arr: unknown, fn: (x: unknown) => T | null, label: string): T[] => {
    if (!Array.isArray(arr)) return [];
    const out = arr.map(fn);
    const bad = out.filter((x) => x === null).length;
    if (bad) warnings.push(`${bad} ${label} geçersiz olduğu için atlanacak.`);
    return out.filter((x): x is T => x !== null);
  };
  const scripts = pick(raw.scripts, validScript, 'metin');
  const profiles = pick(raw.profiles, validProfile, 'profil');
  const setlists = pick(
    raw.setlists,
    (v): SetList | null =>
      isObj(v) && typeof v.id === 'string' && Array.isArray(v.items)
        ? {
            id: v.id,
            name: str(v.name, 'Çekim listesi'),
            updatedAt: num(v.updatedAt),
            items: v.items.filter(isObj).map((i) => ({ scriptId: str(i.scriptId), done: i.done === true })),
          }
        : null,
    'çekim listesi',
  );
  const takes = pick(
    raw.takes,
    (v): Take | null =>
      isObj(v) && typeof v.id === 'string' && typeof v.scriptId === 'string'
        ? { id: v.id, scriptId: v.scriptId, number: num(v.number, 1), note: str(v.note), good: v.good === true, blockId: typeof v.blockId === 'string' ? v.blockId : null, at: num(v.at) }
        : null,
    'take kaydı',
  );
  return { data: { app: 'akis-prompter', schemaVersion: sv, exportedAt: str(raw.exportedAt), scripts, profiles, setlists, takes }, warnings };
}

export type ConflictPolicy = 'copy' | 'overwrite' | 'skip';

export interface ImportSummary {
  added: number;
  copied: number;
  overwritten: number;
  skipped: number;
}

/**
 * Tek transaction içinde içe aktarır: bir hata olursa hiçbir şey yazılmaz.
 * mode 'replace' mevcut tüm verileri siler ve yedekle değiştirir.
 */
export async function applyBackup(data: BackupFile, mode: 'merge' | 'replace', policy: ConflictPolicy = 'copy'): Promise<ImportSummary> {
  const db = await getDB();
  const tx = db.transaction(['scripts', 'profiles', 'setlists', 'takes'], 'readwrite');
  const sum: ImportSummary = { added: 0, copied: 0, overwritten: 0, skipped: 0 };
  const scripts = tx.objectStore('scripts');
  const profiles = tx.objectStore('profiles');
  const setlists = tx.objectStore('setlists');
  const takes = tx.objectStore('takes');
  try {
    if (mode === 'replace') {
      await Promise.all([scripts.clear(), profiles.clear(), setlists.clear(), takes.clear()]);
    }
    for (const s of data.scripts) {
      const existing = mode === 'merge' ? await scripts.get(s.id) : undefined;
      if (!existing) {
        await scripts.put(s);
        sum.added++;
      } else if (JSON.stringify(existing.blocks) === JSON.stringify(s.blocks) && existing.title === s.title) {
        sum.skipped++;
      } else if (policy === 'overwrite') {
        await scripts.put({ ...s, revision: existing.revision + 1 });
        sum.overwritten++;
      } else if (policy === 'copy') {
        await scripts.put({ ...s, id: newId(), title: `${s.title} (yedekten)`, revision: 0 });
        sum.copied++;
      } else sum.skipped++;
    }
    for (const p of data.profiles) {
      const existing = mode === 'merge' ? await profiles.get(p.id) : undefined;
      if (!existing || policy === 'overwrite') await profiles.put(p);
      else if (policy === 'copy' && JSON.stringify(existing.settings) !== JSON.stringify(p.settings))
        await profiles.put({ ...p, id: newId(), name: `${p.name} (yedekten)`, builtin: false });
    }
    for (const l of data.setlists) if (mode === 'replace' || !(await setlists.get(l.id))) await setlists.put(l);
    for (const t of data.takes) if (mode === 'replace' || !(await takes.get(t.id))) await takes.put(t);
    await tx.done;
  } catch (e) {
    try {
      tx.abort();
    } catch {
      /* zaten bitti */
    }
    throw e;
  }
  notifyChange({ kind: 'all' });
  return sum;
}

export function downloadText(filename: string, text: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function safeFilename(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'metin';
}

export function backupFilename(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `akis-prompter-yedek-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}
