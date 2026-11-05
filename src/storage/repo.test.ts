import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { _resetDB } from './db';
import { createScript, getScript, listProfiles, listScripts, patchScript, saveScript, withVersion, MAX_VERSIONS } from './repo';
import { parsePlainText } from '../model/text';
import { applyBackup, buildBackup, parseBackup, BackupError } from '../backup/backup';

beforeEach(async () => {
  await _resetDB();
  globalThis.indexedDB = new IDBFactory();
});

describe('metin deposu', () => {
  it('kaydet → yeniden aç: içerik aynı (Unicode korunur)', async () => {
    const s = createScript('Deneme', parsePlainText('İç mimarlık “ışık” 🙂\n\nİkinci paragraf'));
    const r = await saveScript(s);
    expect(r.ok).toBe(true);
    await _resetDB(); // sayfa kapanıp açılmış gibi bağlantıyı yenile
    const back = await getScript(s.id);
    expect(back?.blocks.map((b) => b.text)).toEqual(['İç mimarlık “ışık” 🙂', 'İkinci paragraf']);
    expect(back?.revision).toBe(1);
  });

  it('eski revizyon yeni metni ezmez', async () => {
    const s = createScript('A', parsePlainText('bir'));
    const r1 = await saveScript(s);
    if (!r1.ok) throw new Error();
    const tabA = r1.script;
    const tabB = r1.script;
    const r2 = await saveScript({ ...tabB, blocks: parsePlainText('B sekmesi') });
    expect(r2.ok).toBe(true);
    const r3 = await saveScript({ ...tabA, blocks: parsePlainText('A eski') });
    expect(r3.ok).toBe(false);
    expect((await getScript(s.id))?.blocks[0]?.text).toBe('B sekmesi');
  });

  it('okuma konumu revizyonu artırmaz ve editör kaydı konumu silmez', async () => {
    const r = await saveScript(createScript('A', parsePlainText('x')));
    if (!r.ok) throw new Error();
    await patchScript(r.script.id, { lastPosition: { blockId: 'b', fraction: 0.5 } });
    const r2 = await saveScript({ ...r.script, title: 'B' });
    expect(r2.ok).toBe(true);
    expect((await getScript(r.script.id))?.lastPosition?.fraction).toBe(0.5);
  });

  it('sürüm sayısı sınırlı', () => {
    let s = createScript('A', []);
    for (let i = 0; i < MAX_VERSIONS + 5; i++) s = withVersion({ ...s, blocks: parsePlainText(`v${i}`) }, 'test');
    expect(s.versions.length).toBe(MAX_VERSIONS);
  });

  it('ilk açılışta başlangıç profilleri oluşur', async () => {
    const p = await listProfiles();
    expect(p.map((x) => x.name)).toContain('Aynalı Prompter');
  });
});

describe('yedek', () => {
  it('JSON round-trip', async () => {
    await saveScript(createScript('Bir', parsePlainText('# Başlık\n\nMetin 🙂')));
    await listProfiles();
    const json = JSON.stringify(await buildBackup());
    await _resetDB();
    globalThis.indexedDB = new IDBFactory();
    const parsed = parseBackup(json);
    await applyBackup(parsed.data, 'replace');
    const all = await listScripts();
    expect(all).toHaveLength(1);
    expect(all[0]!.blocks.map((b) => b.type)).toEqual(['heading', 'speech']);
  });

  it('bozuk / ileri sürüm dosya reddedilir, mevcut veri bozulmaz', async () => {
    await saveScript(createScript('Kalıcı', parsePlainText('veri')));
    expect(() => parseBackup('{bozuk')).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ app: 'baska' }))).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ app: 'akis-prompter', schemaVersion: 99 }))).toThrow(/daha yeni/);
    expect((await listScripts()).map((s) => s.title)).toEqual(['Kalıcı']);
  });

  it('birleştirmede çakışan metin kopya olarak eklenir', async () => {
    const r = await saveScript(createScript('Aynı', parsePlainText('yerel')));
    if (!r.ok) throw new Error();
    const b = await buildBackup();
    b.scripts[0]!.blocks = parsePlainText('yedekteki');
    const sum = await applyBackup(parseBackup(JSON.stringify(b)).data, 'merge', 'copy');
    expect(sum.copied).toBe(1);
    const titles = (await listScripts()).map((s) => s.title).sort();
    expect(titles).toEqual(['Aynı', 'Aynı (yedekten)']);
  });

  it('geçersiz bloklu metin uyarıyla atlanır', () => {
    const p = parseBackup(JSON.stringify({ app: 'akis-prompter', schemaVersion: 1, scripts: [{ id: 'x', blocks: [{ type: 'script', text: 'alert(1)' }] }] }));
    expect(p.data.scripts).toHaveLength(0);
    expect(p.warnings[0]).toMatch(/1 metin/);
  });
});

describe('profil göçü', () => {
  it('eski kişisel profilleri genel adlara taşır, ayarları ve etkin profili korur', async () => {
    const { getDB } = await import('./db');
    const { BASE_SETTINGS } = await import('../profiles/defaults');
    const { getAppSettings } = await import('./repo');
    const db = await getDB();
    await db.put('profiles', { id: 'p-tuba-youtube', name: 'Tuba — YouTube', builtin: true, updatedAt: 0, settings: { ...BASE_SETTINGS, speed: 99 } });
    await db.put('profiles', { id: 'p-tuba-reels', name: 'Benim Reels', builtin: true, updatedAt: 0, settings: BASE_SETTINGS });
    await db.put('meta', { activeProfileId: 'p-tuba-youtube' }, 'app');
    const all = await listProfiles();
    const names = all.map((p) => p.name);
    expect(names.some((n) => /Tuba|Ufuk/.test(n.replace('Benim Reels', '')))).toBe(false);
    expect(all.find((p) => p.id === 'p-yatay')?.settings.speed).toBe(99);
    expect(all.find((p) => p.id === 'p-dikey')?.name).toBe('Benim Reels');
    expect((await getAppSettings()).activeProfileId).toBe('p-yatay');
  });
});
