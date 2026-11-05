import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Block, BlockType, Script } from '../model/types';
import { getScript, onExternalChange, saveScript, withVersion, createScript } from '../storage/repo';
import {
  blocksToMarkdown,
  blocksToPlainText,
  estimateSeconds,
  findTimecodes,
  formatDuration,
  isBracketNoteCandidate,
  newId,
  parsePlainText,
  speechWordCount,
  stripTimecodes,
  DEFAULT_WPM,
} from '../model/text';
import { countInBlocks, replaceInBlocks } from '../model/findReplace';
import { EditHistory, type Snapshot } from './history';
import { useAutosave, type SaveStatus } from './useAutosave';
import { navigate, useStore, announce } from '../ui/store';
import { Dialog, formatDate } from '../ui/common';
import { downloadText, safeFilename } from '../backup/backup';
import { Icon } from '../ui/Icon';

const TYPE_LABEL: Record<BlockType, string> = { heading: 'Bölüm başlığı', speech: 'Konuşma', note: 'Yönetmen notu' };

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Kaydediliyor…',
  saved: 'Kaydedildi',
  error: 'Kaydedilemedi',
  conflict: 'Çakışma',
};

export function Editor({ id }: { id: string }) {
  const { activeProfile } = useStore();
  const [script, setScriptState] = useState<Script | null>(null);
  const scriptRef = useRef<Script | null>(null);
  const setScript = useCallback((s: Script) => {
    scriptRef.current = s;
    setScriptState(s);
  }, []);
  const [notFound, setNotFound] = useState(false);
  const [externalChanged, setExternalChanged] = useState(false);
  const history = useRef(new EditHistory());
  const baseRevision = useRef(0);
  const focused = useRef<string | null>(null);
  const [tagsDraft, setTagsDraft] = useState('');
  const focusAfter = useRef<{ id: string; pos: number } | null>(null);

  const auto = useAutosave((saved) => {
    baseRevision.current = saved.revision;
  });

  useEffect(() => {
    let alive = true;
    void getScript(id).then((s) => {
      if (!alive) return;
      if (!s || s.deletedAt) setNotFound(true);
      else {
        baseRevision.current = s.revision;
        setScript(s);
        setTagsDraft(s.tags.join(', '));
      }
    });
    const off = onExternalChange((m) => {
      if (m.kind === 'script' && m.id === id && m.revision !== baseRevision.current) setExternalChanged(true);
    });
    return () => {
      alive = false;
      off();
    };
  }, [id, setScript]);

  /** Tüm düzenlemeler buradan geçer: geçmiş + otomatik kayıt. */
  const apply = useCallback(
    (patch: Partial<Pick<Script, 'title' | 'blocks' | 'tags' | 'folder' | 'versions'>>, opts: { coalesce?: boolean; record?: boolean } = {}) => {
      const cur = scriptRef.current;
      if (!cur) return;
      if (opts.record !== false) history.current.record({ title: cur.title, blocks: cur.blocks }, !!opts.coalesce);
      const next = { ...cur, ...patch, revision: baseRevision.current };
      scriptRef.current = next;
      setScript(next);
      auto.queue(next);
    },
    [auto, setScript],
  );

  const restoreSnap = (snap: Snapshot | null) => {
    if (!snap) return;
    apply({ title: snap.title, blocks: snap.blocks }, { record: false });
  };
  const undo = () => script && restoreSnap(history.current.undo({ title: script.title, blocks: script.blocks }));
  const redo = () => script && restoreSnap(history.current.redo({ title: script.title, blocks: script.blocks }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      // Textarea'nın kendi geri alması yerine blok düzeyinde tutarlı geçmiş.
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        void auto.flush();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    const f = focusAfter.current;
    if (!f) return;
    focusAfter.current = null;
    const el = document.querySelector<HTMLTextAreaElement>(`textarea[data-block="${f.id}"]`);
    if (el) {
      el.focus();
      el.setSelectionRange(f.pos, f.pos);
    }
  });

  const wpm = activeProfile.settings.wpm ?? DEFAULT_WPM;
  const words = useMemo(() => (script ? speechWordCount(script.blocks) : 0), [script]);

  if (notFound)
    return (
      <main className="page">
        <p>Bu metin bulunamadı veya çöp kutusunda.</p>
        <button className="btn" onClick={() => navigate({ name: 'library' })}>
          Metinlerime dön
        </button>
      </main>
    );
  if (!script) return <main className="page" aria-busy="true" />;

  const setBlock = (bid: string, patch: Partial<Block>, coalesce = false) =>
    apply({ blocks: script.blocks.map((b) => (b.id === bid ? { ...b, ...patch } : b)) }, { coalesce });

  const insertAfter = (index: number, type: BlockType = 'speech') => {
    const nb: Block = { id: newId(), type, text: '' };
    const blocks = [...script.blocks];
    blocks.splice(index + 1, 0, nb);
    focusAfter.current = { id: nb.id, pos: 0 };
    apply({ blocks });
  };

  const removeBlock = (index: number) => {
    const blocks = script.blocks.filter((_, i) => i !== index);
    apply({ blocks });
    announce('Blok silindi. Geri almak için Geri al.');
  };

  const splitBlock = (index: number, pos: number) => {
    const b = script.blocks[index]!;
    const a: Block = { ...b, text: b.text.slice(0, pos).replace(/\s+$/u, '') };
    const c: Block = { id: newId(), type: b.type, text: b.text.slice(pos).replace(/^\s+/u, '') };
    const blocks = [...script.blocks];
    blocks.splice(index, 1, a, c);
    focusAfter.current = { id: c.id, pos: 0 };
    apply({ blocks });
  };

  const mergeUp = (index: number) => {
    if (index === 0) return;
    const prev = script.blocks[index - 1]!;
    const cur = script.blocks[index]!;
    const sep = prev.text && cur.text ? ' ' : '';
    const merged: Block = { ...prev, text: prev.text + sep + cur.text };
    const blocks = [...script.blocks];
    blocks.splice(index - 1, 2, merged);
    focusAfter.current = { id: prev.id, pos: prev.text.length + sep.length };
    apply({ blocks });
  };

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= script.blocks.length) return;
    const blocks = [...script.blocks];
    [blocks[index], blocks[j]] = [blocks[j]!, blocks[index]!];
    apply({ blocks });
  };

  const wrapSelection = (bid: string, mark: '**' | '==') => {
    const el = document.querySelector<HTMLTextAreaElement>(`textarea[data-block="${bid}"]`);
    const b = script.blocks.find((x) => x.id === bid);
    if (!el || !b) return;
    const { selectionStart: s, selectionEnd: e } = el;
    if (s === e) return;
    const text = b.text.slice(0, s) + mark + b.text.slice(s, e) + mark + b.text.slice(e);
    focusAfter.current = { id: bid, pos: e + mark.length * 2 };
    setBlock(bid, { text });
  };

  const goRead = async () => {
    await auto.flush();
    navigate({ name: 'read', id: script.id });
  };

  return (
    <main className="page editor">
      <header className="editor-head">
        <button className="back-btn" onClick={async () => { await auto.flush(); navigate({ name: 'library' }); }} aria-label="Metinlere dön">
          <Icon name="prevSentence" size={26} />
        </button>
        <span className="editor-title">Metni düzenle</span>
        <SaveChip status={auto.status} />
      </header>

      {auto.status === 'error' && (
        <div className="banner danger" role="alert">
          <strong>Kaydedilemedi.</strong> Metin bu sayfada duruyor ve kaybolmadı. {auto.error && <span className="muted">({auto.error})</span>}
          <div className="row">
            <button className="btn" onClick={() => void auto.flush()}>Tekrar dene</button>
            <button className="btn" onClick={() => downloadText(`${safeFilename(script.title)}.md`, blocksToMarkdown(script.title, script.blocks), 'text/markdown')}>
              Dosya olarak indir
            </button>
          </div>
        </div>
      )}
      {(auto.conflict || externalChanged) && (
        <ConflictBanner
          script={script}
          other={auto.conflict}
          onLoadOther={async () => {
            const fresh = auto.conflict ?? (await getScript(script.id));
            if (fresh) {
              baseRevision.current = fresh.revision;
              setScript(fresh);
            }
            auto.resolveConflict();
            setExternalChanged(false);
          }}
          onSaveCopy={async () => {
            const copy = { ...createScript(`${script.title} (bu sekme)`, script.blocks), tags: script.tags, folder: script.folder };
            const r = await saveScript(copy);
            auto.resolveConflict();
            setExternalChanged(false);
            if (r.ok) navigate({ name: 'edit', id: r.script.id });
          }}
          onOverwrite={async () => {
            const r = await saveScript({ ...script }, { force: true });
            if (r.ok) baseRevision.current = r.script.revision;
            auto.resolveConflict();
            setExternalChanged(false);
          }}
        />
      )}

      <section className="title-card">
        <input
          className="title-input"
          aria-label="Metin adı"
          value={script.title}
          onChange={(e) => apply({ title: e.target.value }, { coalesce: true })}
        />
        <div className="meta-row">
          <label className="tag-input">
            <Icon name="lines" size={18} />
            <input
              aria-label="Etiketler (virgülle ayır)"
              value={tagsDraft}
              placeholder="Etiket ekle: Reels, YouTube…"
              onChange={(e) => {
                setTagsDraft(e.target.value);
                apply({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) }, { coalesce: true, record: false });
              }}
            />
          </label>
          <label className="tag-input">
            <Icon name="library" size={18} />
            <input aria-label="Proje / klasör" value={script.folder} placeholder="Proje" onChange={(e) => apply({ folder: e.target.value }, { coalesce: true, record: false })} />
          </label>
        </div>
      </section>

      <Toolbar
        script={script}
        canUndo={history.current.canUndo}
        canRedo={history.current.canRedo}
        undo={undo}
        redo={redo}
        apply={apply}
      />

      <ol className="blocks">
        {script.blocks.map((b, i) => (
          <li key={b.id} className={`block block-${b.type}`} onFocus={() => (focused.current = b.id)}>
            <div className="block-tools">
              <select aria-label={`Blok ${i + 1} türü`} value={b.type} onChange={(e) => setBlock(b.id, { type: e.target.value as BlockType })}>
                {(Object.keys(TYPE_LABEL) as BlockType[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              <button
                className="icon-btn"
                aria-label="İmleçten böl"
                title="Bloğu imleç konumundan ikiye böl"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const el = document.querySelector<HTMLTextAreaElement>(`textarea[data-block="${b.id}"]`);
                  splitBlock(i, el?.selectionStart ?? b.text.length);
                }}
              >
                <Icon name="split" size={20} />
              </button>
              <button className="icon-btn" aria-label="Üstteki blokla birleştir" title="Üstteki blokla birleştir" disabled={i === 0} onClick={() => mergeUp(i)}>
                <Icon name="merge" size={20} />
              </button>
              <button className="icon-btn" aria-label="Yukarı taşı" disabled={i === 0} onClick={() => move(i, -1)}>
                <Icon name="up" size={20} />
              </button>
              <button className="icon-btn" aria-label="Aşağı taşı" disabled={i === script.blocks.length - 1} onClick={() => move(i, 1)}>
                <Icon name="down" size={20} />
              </button>
              <button className="icon-btn danger" aria-label="Bloğu sil" onClick={() => removeBlock(i)}>
                <Icon name="trash" size={20} />
              </button>
            </div>
            <textarea
              data-block={b.id}
              aria-label={`${TYPE_LABEL[b.type]} ${i + 1}`}
              value={b.text}
              rows={b.type === 'heading' ? 1 : 3}
              placeholder={b.type === 'note' ? 'Okunmayacak not (ör. ürünü göster)' : b.type === 'heading' ? 'Bölüm adı' : 'Okunacak metin'}
              onChange={(e) => setBlock(b.id, { text: e.target.value }, true)}
              onKeyDown={(e) => {
                const ta = e.currentTarget;
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  splitBlock(i, ta.selectionStart);
                } else if (e.key === 'Backspace' && ta.selectionStart === 0 && ta.selectionEnd === 0 && i > 0) {
                  e.preventDefault();
                  mergeUp(i);
                }
              }}
            />
            <button className="add-between" onClick={() => insertAfter(i)} aria-label={`${i + 1}. bloktan sonra yeni blok ekle`}>
              + blok
            </button>
          </li>
        ))}
      </ol>
      {script.blocks.length === 0 && (
        <div className="empty">
          <p>Metin boş. Bir blok ekleyin veya uzun metni yapıştırın.</p>
          <button className="btn" onClick={() => insertAfter(-1)}>
            + Konuşma bloğu
          </button>
        </div>
      )}
      <p className="hint muted">
        İpucu: Ctrl/⌘+Enter bloğu böler, satır başında Backspace üstteki blokla birleştirir. Kalın ve vurgu okuma ekranında biçime dönüşür.
      </p>

      <div className="editor-dock">
        <div className="format-bar" role="toolbar" aria-label="Biçim">
          <button className="fmt" aria-label="Seçili metni kalın yap" onMouseDown={(e) => e.preventDefault()} onClick={() => focused.current && wrapSelection(focused.current, '**')}>
            <b>B</b>
          </button>
          <button className="fmt" aria-label="Seçili metni vurgula" onMouseDown={(e) => e.preventDefault()} onClick={() => focused.current && wrapSelection(focused.current, '==')}>
            <Icon name="edit" /><span className="hl-bar" />
          </button>
          <button
            className="fmt"
            aria-label="Blok türünü değiştir (konuşma, başlık, not)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const b = script.blocks.find((x) => x.id === focused.current);
              if (!b) return;
              const order: BlockType[] = ['speech', 'heading', 'note'];
              const next = order[(order.indexOf(b.type) + 1) % order.length]!;
              setBlock(b.id, { type: next });
              announce(`Blok türü: ${TYPE_LABEL[next]}`);
            }}
          >
            <span className="aa">Aa</span>
          </button>
          <button className="fmt" aria-label="Geri al" disabled={!history.current.canUndo} onClick={undo}>
            <Icon name="undo" />
          </button>
        </div>
        <p className="stats" aria-live="off">
          <span><Icon name="file" size={20} /> {words.toLocaleString('tr')} kelime</span>
          <span><Icon name="clock" size={20} /> Tahmini {formatDuration(estimateSeconds(words, wpm))}</span>
        </p>
        <button className="btn primary big block" onClick={() => void goRead()} disabled={words === 0} title={words === 0 ? 'Okunacak konuşma metni yok' : undefined}>
          <Icon name="play" size={22} /> Prompteri aç
        </button>
      </div>
    </main>
  );
}

function SaveChip({ status }: { status: SaveStatus }) {
  if (status === 'idle') return <span className="save-chip" />;
  return (
    <span className={`save-chip s-${status}`} role="status" aria-live="polite">
      <span className="save-dot" aria-hidden="true" /> {STATUS_TEXT[status]}
    </span>
  );
}

function ConflictBanner({
  other,
  onLoadOther,
  onSaveCopy,
  onOverwrite,
}: {
  script: Script;
  other: Script | null;
  onLoadOther: () => void;
  onSaveCopy: () => void;
  onOverwrite: () => void;
}) {
  return (
    <div className="banner warn" role="alert">
      <strong>Bu metin başka bir sekmede değiştirildi.</strong>{' '}
      {other ? `Diğer sürüm: ${formatDate(other.updatedAt)}.` : ''} Hangi sürümü tutmak istersiniz?
      <div className="row">
        <button className="btn" onClick={onSaveCopy}>Buradakini kopya olarak kaydet</button>
        <button className="btn" onClick={onLoadOther}>Diğer sürümü yükle</button>
        <button className="btn danger" onClick={onOverwrite}>Buradakiyle üzerine yaz</button>
      </div>
    </div>
  );
}

type ApplyFn = (patch: Partial<Pick<Script, 'title' | 'blocks' | 'tags' | 'folder' | 'versions'>>, opts?: { coalesce?: boolean; record?: boolean }) => void;

function Toolbar({ script, canUndo, canRedo, undo, redo, apply }: { script: Script; canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void; apply: ApplyFn }) {
  const [dialog, setDialog] = useState<null | 'find' | 'timecode' | 'notes' | 'paste' | 'versions'>(null);
  const close = () => setDialog(null);
  /** Toplu değişiklik öncesi yerel sürüm. */
  const snapshotFirst = (reason: string): Script['versions'] => withVersion(script, reason).versions;

  return (
    <div className="toolbar" role="toolbar" aria-label="Düzenleme araçları">
      <button className="btn ghost" onClick={undo} disabled={!canUndo}><Icon name="undo" size={18} /> Geri al</button>
      <button className="btn ghost" onClick={redo} disabled={!canRedo}><Icon name="redo" size={18} /> İleri al</button>
      <button className="btn ghost" onClick={() => setDialog('find')}><Icon name="search" size={18} /> Bul / değiştir</button>
      <button className="btn ghost" onClick={() => setDialog('paste')}>Metin yapıştır</button>
      <details className="menu">
        <summary className="btn ghost"><Icon name="more" size={18} /> Diğer araçlar</summary>
        <div className="menu-list">
          <button className="btn ghost" onClick={() => setDialog('timecode')}>Zaman kodlarını temizle…</button>
          <button className="btn ghost" onClick={() => setDialog('notes')}>[Köşeli] satırları nota çevir…</button>
          <button className="btn ghost" onClick={() => setDialog('versions')}>Yerel sürümler ({script.versions.length})</button>
          <button className="btn ghost" onClick={() => downloadText(`${safeFilename(script.title)}.txt`, blocksToPlainText(script.blocks), 'text/plain')}>TXT olarak indir</button>
          <button className="btn ghost" onClick={() => downloadText(`${safeFilename(script.title)}.md`, blocksToMarkdown(script.title, script.blocks), 'text/markdown')}>Markdown olarak indir</button>
        </div>
      </details>

      <FindDialog open={dialog === 'find'} onClose={close} script={script} apply={apply} snapshotFirst={snapshotFirst} />
      <TimecodeDialog open={dialog === 'timecode'} onClose={close} script={script} apply={apply} snapshotFirst={snapshotFirst} />
      <NotesDialog open={dialog === 'notes'} onClose={close} script={script} apply={apply} />
      <PasteDialog open={dialog === 'paste'} onClose={close} script={script} apply={apply} snapshotFirst={snapshotFirst} />
      <VersionsDialog open={dialog === 'versions'} onClose={close} script={script} apply={apply} snapshotFirst={snapshotFirst} />
    </div>
  );
}

interface DlgProps {
  open: boolean;
  onClose: () => void;
  script: Script;
  apply: ApplyFn;
  snapshotFirst?: (reason: string) => Script['versions'];
}

function FindDialog({ open, onClose, script, apply, snapshotFirst }: DlgProps) {
  const [find, setFind] = useState('');
  const [rep, setRep] = useState('');
  const [msg, setMsg] = useState('');
  const count = countInBlocks(script.blocks, find);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Bul ve değiştir"
      actions={
        <>
          <button className="btn" onClick={onClose}>Kapat</button>
          <button
            className="btn primary"
            disabled={!find || count === 0}
            onClick={() => {
              const r = replaceInBlocks(script.blocks, find, rep);
              apply({ blocks: r.blocks, versions: snapshotFirst!('Bul/değiştir öncesi') });
              setMsg(`${r.count} yer değiştirildi. Geri al ile dönebilirsiniz.`);
            }}
          >
            Tümünü değiştir
          </button>
        </>
      }
    >
      <label className="field">
        Aranan (büyük/küçük harf ve I/ı-İ/i duyarsız)
        <input value={find} onChange={(e) => { setFind(e.target.value); setMsg(''); }} autoFocus />
      </label>
      <label className="field">
        Yeni metin
        <input value={rep} onChange={(e) => setRep(e.target.value)} />
      </label>
      <p role="status">{msg || (find ? `${count} eşleşme` : '')}</p>
    </Dialog>
  );
}

function TimecodeDialog({ open, onClose, script, apply, snapshotFirst }: DlgProps) {
  const affected = script.blocks.filter((b) => findTimecodes(b.text) > 0);
  const total = affected.reduce((n, b) => n + findTimecodes(b.text), 0);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Zaman kodlarını temizle"
      wide
      actions={
        <>
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button
            className="btn primary"
            disabled={total === 0}
            onClick={() => {
              apply({ blocks: script.blocks.map((b) => ({ ...b, text: stripTimecodes(b.text) })), versions: snapshotFirst!('Zaman kodu temizliği öncesi') });
              onClose();
              announce(`${total} zaman kodu temizlendi`);
            }}
          >
            {total} kodu temizle
          </button>
        </>
      }
    >
      <p>Yalnızca satır başındaki “00:01 –”, “[01:02:03]” gibi kodlar silinir. Cümle içindeki sayılara dokunulmaz. İşlem geri alınabilir.</p>
      {total === 0 ? (
        <p className="muted">Satır başında zaman kodu bulunamadı.</p>
      ) : (
        <ul className="preview-list">
          {affected.slice(0, 8).map((b) => (
            <li key={b.id}>
              <del>{b.text.split('\n').find((l) => findTimecodes(l) > 0)}</del>
              <br />
              <ins>{stripTimecodes(b.text.split('\n').find((l) => findTimecodes(l) > 0) ?? '')}</ins>
            </li>
          ))}
          {affected.length > 8 && <li className="muted">… ve {affected.length - 8} blok daha</li>}
        </ul>
      )}
    </Dialog>
  );
}

function NotesDialog({ open, onClose, script, apply }: DlgProps) {
  const candidates = script.blocks.filter((b) => b.type === 'speech' && isBracketNoteCandidate(b.text));
  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (open) setSel(new Set(candidates.map((c) => c.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Köşeli parantezli satırları nota çevir"
      actions={
        <>
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button
            className="btn primary"
            disabled={sel.size === 0}
            onClick={() => {
              apply({ blocks: script.blocks.map((b) => (sel.has(b.id) ? { ...b, type: 'note' as const } : b)) });
              onClose();
            }}
          >
            {sel.size} bloğu not yap
          </button>
        </>
      }
    >
      <p>Notlar okuma süresine katılmaz ve okuma ekranında farklı görünür. Yalnızca seçtikleriniz dönüştürülür.</p>
      {candidates.length === 0 && <p className="muted">Tamamı [köşeli parantez] olan konuşma bloğu yok.</p>}
      {candidates.map((c) => (
        <label key={c.id} className="check">
          <input
            type="checkbox"
            checked={sel.has(c.id)}
            onChange={(e) => {
              const n = new Set(sel);
              if (e.target.checked) n.add(c.id);
              else n.delete(c.id);
              setSel(n);
            }}
          />
          {c.text}
        </label>
      ))}
    </Dialog>
  );
}

function PasteDialog({ open, onClose, script, apply, snapshotFirst }: DlgProps) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const run = (mode: 'append' | 'replace') => {
    try {
      const blocks = parsePlainText(text);
      if (blocks.length === 0) {
        setErr('Yapıştırılan metin boş.');
        return;
      }
      apply({ blocks: mode === 'append' ? [...script.blocks, ...blocks] : blocks, versions: mode === 'replace' ? snapshotFirst!('Yapıştırarak değiştirme öncesi') : script.versions });
      setText('');
      setErr('');
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Uzun metin yapıştır"
      wide
      actions={
        <>
          <button className="btn" onClick={onClose}>Vazgeç</button>
          {script.blocks.length > 0 && <button className="btn" onClick={() => run('replace')}>Mevcut metnin yerine koy</button>}
          <button className="btn primary" onClick={() => run('append')}>Sona ekle</button>
        </>
      }
    >
      <p className="muted">Boş satırlar paragrafları ayırır. “# Başlık” bölüm başlığı, “%% not” yönetmen notu olur.</p>
      <textarea className="paste-area" value={text} onChange={(e) => setText(e.target.value)} rows={12} aria-label="Yapıştırılacak metin" />
      {err && <p className="error" role="alert">{err}</p>}
    </Dialog>
  );
}

function VersionsDialog({ open, onClose, script, apply, snapshotFirst }: DlgProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Yerel sürümler">
      <p className="muted">Toplu değişikliklerden ve çekim başlangıcından önce otomatik saklanır (en fazla 15). Geri yüklemeden önce mevcut metin de sürüm olarak saklanır.</p>
      {script.versions.length === 0 && <p>Henüz sürüm yok.</p>}
      <ul className="version-list">
        {[...script.versions].reverse().map((v) => (
          <li key={v.at}>
            <span>
              {formatDate(v.at)} — {v.reason} <span className="muted">({speechWordCount(v.blocks)} kelime)</span>
            </span>
            <button
              className="btn"
              onClick={() => {
                apply({ title: v.title, blocks: structuredClone(v.blocks), versions: snapshotFirst!('Sürüm geri yükleme öncesi') });
                onClose();
              }}
            >
              Geri yükle
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
