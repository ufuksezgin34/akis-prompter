import { useRef, useState } from 'react';
import type { Block } from '../model/types';
import { createScript, saveScript } from '../storage/repo';
import { DEFAULT_WPM, MAX_IMPORT_CHARS, estimateSeconds, formatDuration, parseMarkdown, parsePlainText, speechWordCount } from '../model/text';
import { stripInline } from '../model/inline';
import { navigate, useStore } from '../ui/store';
import { looksLikeText, readFileText } from '../ui/common';
import { Icon } from '../ui/Icon';
import { ActionCard, Brand, PageHead } from '../ui/kit';
import { reelsSample } from '../library/samples';

interface Draft {
  title: string;
  source: string;
  blocks: Block[];
  note?: string;
  tags?: string[];
}

const MAX_TEXT_BYTES = 8 * 1024 * 1024;

export function ImportPage() {
  const { activeProfile } = useStore();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const wpm = activeProfile.settings.wpm ?? DEFAULT_WPM;

  const fromText = (text: string, title: string, source: string) => {
    if (text.length > MAX_IMPORT_CHARS) throw new Error('Metin çok uzun.');
    const blocks = parsePlainText(text);
    if (blocks.length === 0) throw new Error('Metin boş görünüyor.');
    setDraft({ title, source, blocks });
  };

  const onFile = async (f: File | undefined) => {
    setError(null);
    setDraft(null);
    if (!f) return;
    setBusy(true);
    try {
      const base = f.name.replace(/\.(txt|md|markdown|docx)$/i, '');
      if (/\.docx$/i.test(f.name)) {
        const { docxToBlocks } = await import('./docx');
        const blocks = await docxToBlocks(f);
        if (blocks.length === 0) throw new Error('Belgede okunacak metin bulunamadı.');
        setDraft({ title: base, source: f.name, blocks, note: 'Word biçimlendirmesi (yazı tipi, renk, tablo, görsel) alınmadı; yalnızca metin aktarılır.' });
      } else if (/\.pdf$/i.test(f.name)) {
        throw new Error('PDF içe aktarma henüz desteklenmiyor. Metni kopyalayıp “Panodan yapıştır”ı kullanın.');
      } else {
        if (!(await looksLikeText(f))) throw new Error('Bu bir metin dosyası değil. TXT, Markdown veya DOCX seçin.');
        const text = await readFileText(f, MAX_TEXT_BYTES);
        if (/\.(md|markdown)$/i.test(f.name)) {
          const md = parseMarkdown(text);
          if (md.blocks.length === 0) throw new Error('Dosya boş.');
          setDraft({ title: md.title ?? base, source: f.name, blocks: md.blocks });
        } else fromText(text, base, f.name);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const fromClipboard = async () => {
    setError(null);
    try {
      const t = await navigator.clipboard?.readText?.();
      if (t && t.trim()) {
        fromText(t, 'Yapıştırılan metin', 'Panodan');
        return;
      }
    } catch {
      /* izin yoksa elle yapıştırma alanı açılır */
    }
    setPasteOpen(true);
  };

  const doImport = async () => {
    if (!draft) return;
    setBusy(true);
    const r = await saveScript({ ...createScript(draft.title, draft.blocks), tags: draft.tags ?? [] }).catch(() => null);
    setBusy(false);
    if (r?.ok) navigate({ name: 'edit', id: r.script.id });
    else setError('Metin kaydedilemedi. Depolama izni veya boş alanı kontrol edin.');
  };

  const words = draft ? speechWordCount(draft.blocks) : 0;
  const preview = draft
    ? draft.blocks
        .filter((b) => b.type !== 'note')
        .map((b) => stripInline(b.text))
        .join(' ')
        .slice(0, 220)
    : '';

  return (
    <main className="page import">
      <Brand center />
      <PageHead title="Metin içe aktar" subtitle="Senaryonu getir, okumaya başla." onBack={() => (history.length > 1 ? history.back() : navigate({ name: 'home' }))} />

      <div className="stack">
        <ActionCard icon="file" title="Dosya seç" text="TXT, Markdown veya DOCX" onClick={() => fileRef.current?.click()} />
        <ActionCard icon="clipboard" title="Panodan yapıştır" text="Kopyaladığın metni ekle" onClick={() => void fromClipboard()} />
        <ActionCard
          icon="lines"
          title="Örnek metin"
          text="Kısa bir prova ile başla"
          onClick={() => {
            const s = reelsSample();
            setError(null);
            setDraft({ title: s.title, source: 'Örnek', blocks: s.blocks, tags: s.tags });
          }}
        />
        <input
          ref={fileRef}
          type="file"
          hidden
          accept=".txt,.md,.markdown,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => void onFile(e.target.files?.[0])}
          aria-label="Dosya seç"
        />
      </div>

      {pasteOpen && !draft && (
        <div className="card-panel">
          <label className="field">
            Metni buraya yapıştır
            <textarea className="paste-area" value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={8} autoFocus />
          </label>
          <button
            className="btn"
            disabled={!pasteText.trim()}
            onClick={() => {
              try {
                fromText(pasteText, 'Yapıştırılan metin', 'Panodan');
                setPasteOpen(false);
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            Önizle
          </button>
        </div>
      )}

      {error && <p className="error card-panel" role="alert">{error}</p>}

      {draft && (
        <section className="card-panel preview-card" aria-label="Metin önizlemesi">
          <h2>Metin önizlemesi</h2>
          <p className="preview-src"><Icon name="file" size={20} /> {draft.source}</p>
          <label className="field">
            Ad
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <p className="preview-text">{preview}{preview.length >= 220 ? '…' : ''}</p>
          {draft.note && <p className="muted small">{draft.note}</p>}
          <p className="preview-meta">
            <Icon name="clock" size={20} /> {words.toLocaleString('tr')} kelime · Yaklaşık {formatDuration(estimateSeconds(words, wpm))}
          </p>
        </section>
      )}

      <button className="btn primary big block sticky-cta" disabled={!draft || busy} onClick={() => void doImport()}>
        Metni içe aktar
      </button>
    </main>
  );
}
