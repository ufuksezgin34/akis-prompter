import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Script } from '../model/types';
import { createScript, deleteScriptForever, duplicateScript, listScripts, onExternalChange, patchScript, saveScript } from '../storage/repo';
import { DEFAULT_WPM, estimateSeconds, formatDuration, includesTr, speechWordCount } from '../model/text';
import { navigate, useStore } from '../ui/store';
import { Dialog, Toast } from '../ui/common';
import { Icon } from '../ui/Icon';
import { Brand } from '../ui/kit';
import { longFormSample, reelsSample, stressSample } from './samples';
import { createBlankScript } from '../home/Home';

type Sort = 'updated' | 'created' | 'title' | 'duration';
type View = { kind: 'all' } | { kind: 'fav' } | { kind: 'trash' } | { kind: 'tag'; tag: string } | { kind: 'drafts' };

function relDay(ts: number): string {
  const d = new Date(ts);
  const t = new Date();
  if (d.toDateString() === t.toDateString()) return 'Bugün';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export function Library() {
  const { activeProfile, dbError } = useStore();
  const [scripts, setScripts] = useState<Script[] | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('updated');
  const [view, setView] = useState<View>({ kind: 'all' });
  const [toast, setToast] = useState<string | null>(null);
  const [menu, setMenu] = useState<Script | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Script | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  const wpm = activeProfile.settings.wpm ?? DEFAULT_WPM;
  const withStats = useMemo(() => (scripts ?? []).map((s) => ({ s, words: speechWordCount(s.blocks) })), [scripts]);
  const allTags = useMemo(
    () => [...new Set(withStats.filter((x) => !x.s.deletedAt).flatMap((x) => x.s.tags))].sort((a, b) => a.localeCompare(b, 'tr')),
    [withStats],
  );
  const hasTrash = withStats.some((x) => x.s.deletedAt);
  const hasFav = withStats.some((x) => x.s.favorite && !x.s.deletedAt);
  const hasDrafts = withStats.some((x) => x.words === 0 && !x.s.deletedAt);

  const visible = useMemo(() => {
    const list = withStats.filter(({ s, words }) => {
      if (view.kind === 'trash' ? !s.deletedAt : s.deletedAt) return false;
      if (view.kind === 'fav' && !s.favorite) return false;
      if (view.kind === 'drafts' && words > 0) return false;
      if (view.kind === 'tag' && !s.tags.includes(view.tag)) return false;
      if (q && !includesTr(s.title, q) && !s.tags.some((t) => includesTr(t, q)) && !s.folder.includes(q) && !s.blocks.some((b) => includesTr(b.text, q))) return false;
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
  }, [withStats, view, q, sort]);

  const onNew = async () => {
    const id = await createBlankScript();
    if (id) navigate({ name: 'edit', id });
    else setToast('Metin oluşturulamadı. Depolama erişimini kontrol edin.');
  };

  const addSamples = async () => {
    for (const x of [reelsSample(), longFormSample(), stressSample()]) await saveScript({ ...createScript(x.title, x.blocks), tags: x.tags });
    await load();
    setToast('3 örnek metin eklendi.');
  };

  if (scripts === null) return <main className="page" aria-busy="true" />;
  const isActive = (v: View) => JSON.stringify(v) === JSON.stringify(view);
  const chip = (v: View, label: string) => (
    <button key={label} className="chip" aria-pressed={isActive(v)} onClick={() => setView(v)}>
      {label}
    </button>
  );
  const firstId = view.kind !== 'trash' ? visible[0]?.s.id : undefined;

  return (
    <main className="page library">
      {dbError && <div className="banner danger" role="alert">{dbError}</div>}
      <Brand />
      <div className="title-row">
        <h1>Metinlerin</h1>
        <button className="fab" onClick={() => void onNew()} aria-label="Yeni metin">
          <Icon name="plus" size={30} />
        </button>
      </div>

      <label className="search">
        <Icon name="search" size={22} />
        <input ref={searchRef} type="search" placeholder="Metinlerde ara" aria-label="Metinlerde ara" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      <div className="chips" role="group" aria-label="Filtre">
        {chip({ kind: 'all' }, 'Tümü')}
        {allTags.map((t) => chip({ kind: 'tag', tag: t }, t))}
        {hasFav && chip({ kind: 'fav' }, 'Favoriler')}
        {hasDrafts && chip({ kind: 'drafts' }, 'Taslaklar')}
        {hasTrash && chip({ kind: 'trash' }, 'Çöp kutusu')}
        <select className="chip-select" aria-label="Sırala" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="updated">Son düzenlenen</option>
          <option value="created">Oluşturma tarihi</option>
          <option value="title">Ada göre</option>
          <option value="duration">Süreye göre</option>
        </select>
      </div>

      {visible.length === 0 && (
        <div className="empty">
          {scripts.length === 0 ? (
            <>
              <span className="empty-icon"><Icon name="file" size={40} /></span>
              <h2>İlk metnini ekle</h2>
              <p>Yaz, yapıştır ya da dosyadan içe aktar. Denemek için hazır örneklerle de başlayabilirsin.</p>
              <div className="row center">
                <button className="btn primary" onClick={() => void onNew()}><Icon name="plus" size={20} /> Yeni metin</button>
                <button className="btn" onClick={() => navigate({ name: 'import' })}>İçe aktar</button>
                <button className="btn ghost" onClick={() => void addSamples()}>Örnek metinleri ekle</button>
              </div>
            </>
          ) : (
            <p>{view.kind === 'trash' ? 'Çöp kutusu boş.' : 'Aramayla eşleşen metin yok.'}</p>
          )}
        </div>
      )}

      <ul className="doc-list">
        {visible.map(({ s, words }) => (
          <li key={s.id} className={`doc${s.id === firstId ? ' is-recent' : ''}${s.deletedAt ? ' is-trashed' : ''}`}>
            <button className="doc-main" onClick={() => (s.deletedAt ? setMenu(s) : navigate({ name: 'edit', id: s.id }))}>
              <span className="doc-icon"><Icon name="file" size={30} /></span>
              <span className="doc-text">
                <strong>
                  {s.favorite && <Icon name="star" size={16} filled />} {s.title}
                </strong>
                <span className="doc-meta">
                  {words > 0 ? (
                    <>
                      <span>{words.toLocaleString('tr')} kelime</span>
                      <span>{formatDuration(estimateSeconds(words, wpm))}</span>
                    </>
                  ) : (
                    <>
                      <span>Taslak</span>
                      <span>{relDay(s.updatedAt)}</span>
                    </>
                  )}
                </span>
              </span>
            </button>
            <button className="icon-btn doc-more" aria-label={`${s.title} için seçenekler`} onClick={() => setMenu(s)}>
              <Icon name="more" size={26} />
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={!!menu} title={menu?.title ?? ''} onClose={() => setMenu(null)}>
        {menu && (
          <div className="menu-sheet">
            {menu.deletedAt ? (
              <>
                <button className="sheet-row" onClick={async () => { await patchScript(menu.id, { deletedAt: null }); setMenu(null); void load(); }}>
                  <Icon name="undo" /> Geri yükle
                </button>
                <button className="sheet-row danger" onClick={() => { setConfirmDelete(menu); setMenu(null); }}>
                  <Icon name="trash" /> Kalıcı sil
                </button>
              </>
            ) : (
              <>
                <button className="sheet-row" disabled={speechWordCount(menu.blocks) === 0} onClick={() => navigate({ name: 'read', id: menu.id })}>
                  <Icon name="play" /> Prompteri aç
                </button>
                <button className="sheet-row" onClick={() => navigate({ name: 'edit', id: menu.id })}>
                  <Icon name="edit" /> Düzenle
                </button>
                <button className="sheet-row" onClick={async () => { await patchScript(menu.id, { favorite: !menu.favorite }); setMenu(null); void load(); }}>
                  <Icon name="star" filled={menu.favorite} /> {menu.favorite ? 'Favoriden çıkar' : 'Favorilere ekle'}
                </button>
                <button className="sheet-row" onClick={async () => { await saveScript(duplicateScript(menu)); setMenu(null); void load(); setToast('Kopya oluşturuldu.'); }}>
                  <Icon name="copy" /> Çoğalt
                </button>
                <button
                  className="sheet-row danger"
                  onClick={async () => {
                    await patchScript(menu.id, { deletedAt: Date.now() });
                    setToast(`“${menu.title}” çöp kutusuna taşındı.`);
                    setMenu(null);
                    void load();
                  }}
                >
                  <Icon name="trash" /> Çöp kutusuna taşı
                </button>
              </>
            )}
          </div>
        )}
      </Dialog>

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
        <p>“{confirmDelete?.title}” ve yerel sürümleri bu cihazdan silinecek. Bu işlem geri alınamaz.</p>
      </Dialog>
      <Toast message={toast} onClose={() => setToast(null)} />
    </main>
  );
}
