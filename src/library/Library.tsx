import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Script } from '../model/types';
import { createScript, deleteScriptForever, duplicateScript, listScripts, onExternalChange, patchScript, saveScript } from '../storage/repo';
import { estimateSeconds, formatDuration, includesTr, parseMarkdown, parsePlainText, speechWordCount, DEFAULT_WPM, MAX_IMPORT_CHARS, newId } from '../model/text';
import { navigate, useStore } from '../ui/store';
import { formatDate, looksLikeText, readFileText, Toast, Dialog } from '../ui/common';
import { longFormSample, reelsSample, stressSample } from './samples';

type Sort = 'updated' | 'created' | 'title' | 'duration';
const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

export function Library() {
  const { activeProfile, dbError } = useStore();
  const [scripts, setScripts] = useState<Script[] | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('updated');
  const [view, setView] = useState<'all' | 'fav' | 'trash'>('all');
  const [tag, setTag] = useState('');
  const [folder, setFolder] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Script | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setScripts(await listScripts());
    } catch {
      setScripts([]);
    }
  }, []);
  useEffect(() => {
    void load();
    return onExternalChange(() => void load());
  }, [load]);

  const wpm = activeProfile.settings.measuredWpm ?? DEFAULT_WPM;
  const withStats = useMemo(
    () => (scripts ?? []).map((s) => ({ s, words: speechWordCount(s.blocks) })),
    [scripts],
  );
  const allTags = useMemo(() => [...new Set(withStats.flatMap((x) => x.s.tags))].sort((a, b) => a.localeCompare(b, 'tr')), [withStats]);
  const allFolders = useMemo(() => [...new Set(withStats.map((x) => x.s.folder).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')), [withStats]);

  const visible = useMemo(() => {
    const list = withStats.filter(({ s }) => {
      if (view === 'trash' ? !s.deletedAt : s.deletedAt) return false;
      if (view === 'fav' && !s.favorite) return false;
      if (tag && !s.tags.includes(tag)) return false;
      if (folder && s.folder !== folder) return false;
      if (q && !includesTr(s.title, q) && !s.tags.some((t) => includesTr(t, q)) && !s.blocks.some((b) => includesTr(b.text, q))) return false;
      return true;
    });
    list.sort((a, b) => {
      switch (sort) {
        case 'title':
          return a.s.title.localeCompare(b.s.title, 'tr');
        case 'created':
          return b.s.createdAt - a.s.createdAt;
        case 'duration':
          return b.words - a.words;
        default:
          return b.s.updatedAt - a.s.updatedAt;
      }
    });
    return list;
  }, [withStats, view, tag, folder, q, sort]);

  const create = async (title = 'Yeni metin', blocks = parsePlainText(''), tags: string[] = []) => {
    const s = { ...createScript(title, blocks), tags };
    const r = await saveScript(s);
    if (r.ok) return r.script;
    return null;
  };

  const onNew = async () => {
    const s = await create('Yeni metin', [{ id: newId(), type: 'speech', text: '' }]);
    if (s) navigate({ name: 'edit', id: s.id });
    else setToast('Metin oluşturulamadı. Depolama erişimini kontrol edin.');
  };

  const onImport = async (files: FileList | null) => {
    if (!files?.length) return;
    let ok = 0;
    const errors: string[] = [];
    for (const f of Array.from(files)) {
      try {
        if (!(await looksLikeText(f))) throw new Error('metin dosyası değil (DOCX/PDF desteği sonraki aşamada)');
        const text = await readFileText(f, MAX_IMPORT_BYTES);
        if (text.length > MAX_IMPORT_CHARS) throw new Error('çok uzun');
        const base = f.name.replace(/\.(txt|md|markdown)$/i, '');
        const isMd = /\.(md|markdown)$/i.test(f.name);
        const parsed = isMd ? parseMarkdown(text) : { title: null, blocks: parsePlainText(text) };
        if (parsed.blocks.length === 0) throw new Error('boş dosya');
        if (await create(parsed.title ?? base, parsed.blocks)) ok++;
      } catch (e) {
        errors.push(`${f.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    await load();
    setToast(`${ok} dosya içe aktarıldı.${errors.length ? ` Atlananlar — ${errors.join('; ')}` : ''}`);
    if (fileRef.current) fileRef.current.value = '';
  };

  const addSamples = async () => {
    for (const x of [reelsSample(), longFormSample(), stressSample()]) await create(x.title, x.blocks, x.tags);
    await load();
    setToast('3 örnek metin eklendi.');
  };

  if (scripts === null) return <main className="page" aria-busy="true" />;

  return (
    <main className="page library">
      {dbError && (
        <div className="banner danger" role="alert">
          {dbError}
        </div>
      )}
      <header className="lib-head">
        <h1>Metinlerim</h1>
        <div className="row">
          <button className="btn primary" onClick={() => void onNew()}>+ Yeni metin</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>İçe aktar (TXT/MD)</button>
          <input ref={fileRef} type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" multiple hidden onChange={(e) => void onImport(e.target.files)} />
        </div>
      </header>

      <div className="filters">
        <input type="search" placeholder="Ara (başlık, etiket, içerik)" aria-label="Metinlerde ara" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Sırala" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="updated">Son düzenlenen</option>
          <option value="created">Oluşturma tarihi</option>
          <option value="title">Ada göre</option>
          <option value="duration">Süreye göre</option>
        </select>
        {allTags.length > 0 && (
          <select aria-label="Etiket filtresi" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">Tüm etiketler</option>
            {allTags.map((t) => <option key={t}>{t}</option>)}
          </select>
        )}
        {allFolders.length > 0 && (
          <select aria-label="Proje filtresi" value={folder} onChange={(e) => setFolder(e.target.value)}>
            <option value="">Tüm projeler</option>
            {allFolders.map((t) => <option key={t}>{t}</option>)}
          </select>
        )}
        <div className="seg" role="group" aria-label="Görünüm">
          <button aria-pressed={view === 'all'} onClick={() => setView('all')}>Tümü</button>
          <button aria-pressed={view === 'fav'} onClick={() => setView('fav')}>★ Favoriler</button>
          <button aria-pressed={view === 'trash'} onClick={() => setView('trash')}>Çöp kutusu</button>
        </div>
      </div>

      {visible.length === 0 && (
        <div className="empty">
          {scripts.length === 0 ? (
            <>
              <p>Henüz metin yok. Yeni bir metin oluşturun, dosya içe aktarın veya örneklerle deneyin.</p>
              <button className="btn" onClick={() => void addSamples()}>Örnek metinleri ekle</button>
            </>
          ) : (
            <p>{view === 'trash' ? 'Çöp kutusu boş.' : 'Aramayla eşleşen metin yok.'}</p>
          )}
        </div>
      )}

      <ul className="cards">
        {visible.map(({ s, words }) => (
          <li key={s.id} className="card">
            <div className="card-main">
              <h2>
                <button className="link" onClick={() => navigate({ name: 'edit', id: s.id })} disabled={!!s.deletedAt}>
                  {s.title}
                </button>
              </h2>
              <p className="muted small">
                {words.toLocaleString('tr')} kelime · ≈ {formatDuration(estimateSeconds(words, wpm))} · {formatDate(s.updatedAt)}
                {s.folder && <> · 📁 {s.folder}</>}
                {s.lastPosition && !s.deletedAt && <> · kaldığı yer kayıtlı</>}
              </p>
              {s.tags.length > 0 && (
                <p className="tags">
                  {s.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                </p>
              )}
            </div>
            <div className="card-actions">
              {s.deletedAt ? (
                <>
                  <button className="btn" onClick={() => void patchScript(s.id, { deletedAt: null }).then(load)}>Geri yükle</button>
                  <button className="btn danger" onClick={() => setConfirmDelete(s)}>Kalıcı sil</button>
                </>
              ) : (
                <>
                  <button className="btn primary" disabled={words === 0} onClick={() => navigate({ name: 'read', id: s.id })}>▶ Oku</button>
                  <button className="icon-btn" aria-label={s.favorite ? 'Favoriden çıkar' : 'Favorilere ekle'} aria-pressed={s.favorite} onClick={() => void patchScript(s.id, { favorite: !s.favorite }).then(load)}>
                    {s.favorite ? '★' : '☆'}
                  </button>
                  <button className="icon-btn" aria-label="Çoğalt" title="Çoğalt" onClick={() => void saveScript(duplicateScript(s)).then(load)}>⧉</button>
                  <button
                    className="icon-btn"
                    aria-label="Çöp kutusuna taşı"
                    title="Çöp kutusuna taşı"
                    onClick={() => void patchScript(s.id, { deletedAt: Date.now() }).then(() => { void load(); setToast(`“${s.title}” çöp kutusuna taşındı.`); })}
                  >
                    🗑
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={!!confirmDelete}
        title="Kalıcı olarak silinsin mi?"
        onClose={() => setConfirmDelete(null)}
        actions={
          <>
            <button className="btn" onClick={() => setConfirmDelete(null)}>Vazgeç</button>
            <button
              className="btn danger"
              onClick={async () => {
                if (confirmDelete) await deleteScriptForever(confirmDelete.id);
                setConfirmDelete(null);
                void load();
              }}
            >
              Kalıcı sil
            </button>
          </>
        }
      >
        <p>“{confirmDelete?.title}” ve yerel sürümleri bu cihazdan silinecek. Bu işlem geri alınamaz. Gerekirse önce Yedekleme’den dışa aktarın.</p>
      </Dialog>
      <Toast message={toast} onClose={() => setToast(null)} />
    </main>
  );
}
