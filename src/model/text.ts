import type { Block, BlockType } from './types';
import { stripInline } from './inline';

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const LOCALE = 'tr';

/** Unicode birleşimlerini korur; yalnızca karşılaştırma için NFC'ye çevirir. */
export function normalizeForCompare(s: string): string {
  return s.normalize('NFC').toLocaleLowerCase(LOCALE);
}

/** Türkçe I/ı ve İ/i dönüşümlerine duyarlı arama. */
export function includesTr(haystack: string, needle: string): boolean {
  if (!needle) return true;
  return normalizeForCompare(haystack).includes(normalizeForCompare(needle));
}

type SegmenterCtor = new (
  locale: string,
  opts: { granularity: 'word' | 'sentence' },
) => { segment(s: string): Iterable<{ segment: string; index: number; isWordLike?: boolean }> };

function getSegmenter(): SegmenterCtor | null {
  const I = Intl as unknown as { Segmenter?: SegmenterCtor };
  return typeof I.Segmenter === 'function' ? I.Segmenter : null;
}

let forceFallback = false;
/** Testlerde fallback yolunu denemek için. */
export function _setSegmenterFallback(v: boolean): void {
  forceFallback = v;
}

export function countWords(text: string): number {
  const plain = stripInline(text);
  const Seg = forceFallback ? null : getSegmenter();
  if (Seg) {
    let n = 0;
    for (const s of new Seg(LOCALE, { granularity: 'word' }).segment(plain)) if (s.isWordLike) n++;
    return n;
  }
  const m = plain.match(/[\p{L}\p{N}]+(?:['’.,-][\p{L}\p{N}]+)*/gu);
  return m ? m.length : 0;
}

/** Kısaltmalar: bunlardan sonra gelen nokta cümle sonu sayılmaz. */
const ABBREVIATIONS = new Set(
  [
    'dr', 'prof', 'doç', 'av', 'mr', 'mrs', 'ms', 'st', 'vb', 'vs', 'bkz', 'örn', 'yy', 'sn',
    'no', 'tel', 'cad', 'sok', 'mah', 'apt', 'ltd', 'şti', 'a.ş', 'yrd', 'op', 'uzm', 'etc', 'e.g', 'i.e',
  ].map((a) => a.toLocaleLowerCase(LOCALE)),
);

/**
 * Cümle bölme. Intl.Segmenter varsa kullanır, sonra Türkçe kısaltma / ondalık / üç nokta
 * hatalarını onarır. Dönen parçaların birleşimi orijinal metne eşittir (boşluklar dahil).
 */
export function splitSentences(text: string): string[] {
  if (!text) return [];
  const Seg = forceFallback ? null : getSegmenter();
  let raw: string[];
  if (Seg) {
    raw = Array.from(new Seg(LOCALE, { granularity: 'sentence' }).segment(text), (s) => s.segment);
  } else {
    // Fallback: noktalama (+ kapanış tırnağı) ve ardından boşluk gelen yerde böl.
    raw = [];
    const re = /[.!?…]+["'”’)\]]*\s+/gu;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const end = m.index + m[0].length;
      raw.push(text.slice(last, end));
      last = end;
    }
    if (last < text.length) raw.push(text.slice(last));
  }
  // Onarım: kısaltma veya sayı ile biten parçayı bir sonrakiyle birleştir.
  const out: string[] = [];
  for (const part of raw) {
    const prev = out[out.length - 1];
    if (prev !== undefined && shouldJoin(prev, part)) out[out.length - 1] = prev + part;
    else out.push(part);
  }
  return out.filter((s) => s.length > 0);
}

function shouldJoin(prev: string, next: string): boolean {
  const t = prev.trimEnd();
  if (!t.endsWith('.')) return false;
  if (t.endsWith('...')) {
    // Üç noktadan sonra küçük harfle devam ediyorsa aynı cümle.
    const first = next.trimStart().charAt(0);
    return first !== '' && first === first.toLocaleLowerCase(LOCALE) && /\p{L}/u.test(first);
  }
  const m = t.match(/([\p{L}.]+)\.$/u);
  if (m && m[1] && ABBREVIATIONS.has(m[1].toLocaleLowerCase(LOCALE))) return true;
  // Tek harf baş harf (ör. "A. Yılmaz")
  if (/(^|\s)\p{Lu}\.$/u.test(t)) return true;
  // Ondalık: "3." + "5 metre" (segmenter genelde bölmez ama fallback için)
  if (/\d\.$/.test(t) && /^\d/.test(next)) return true;
  return false;
}

/** Varsayılan tahmini okuma hızı. Bilimsel kesinlik değil; profilde ölçülerek değiştirilir. */
export const DEFAULT_WPM = 140;

export function speechWordCount(blocks: Block[]): number {
  return blocks.reduce((n, b) => (b.type === 'speech' ? n + countWords(b.text) : n), 0);
}

export function estimateSeconds(words: number, wpm: number = DEFAULT_WPM): number {
  if (wpm <= 0) return 0;
  return Math.round((words / wpm) * 60);
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

/** Satır başındaki "00:01 –", "[00:01:23]", "1:02 -" gibi zaman kodları. Anlamlı sayılara dokunmaz. */
const TIMECODE_RE = /^[ \t]*\[?\(?\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?\]?\)?[ \t]*(?:[-–—:|][ \t]*)?/gmu;

export function findTimecodes(text: string): number {
  return (text.match(TIMECODE_RE) ?? []).length;
}

export function stripTimecodes(text: string): string {
  return text.replace(TIMECODE_RE, '');
}

/** "[GÜLÜMSE]" gibi tamamen köşeli parantezli satırlar not adayıdır; otomatik dönüştürülmez. */
export function isBracketNoteCandidate(text: string): boolean {
  return /^\s*\[[^\]]{1,80}\]\s*$/u.test(text);
}

export const MAX_IMPORT_CHARS = 2_000_000;

/**
 * Düz metin / Markdown'ı bloklara çevirir. Boş satırlar paragraf ayırır.
 * "# Başlık" → bölüm başlığı, "%% metin" → yönetmen notu, gerisi konuşma.
 * Köşeli parantezli satırlar yalnızca `notesFromBrackets` açıkça verilirse not yapılır.
 */
export function parsePlainText(input: string, opts: { notesFromBrackets?: boolean } = {}): Block[] {
  if (input.length > MAX_IMPORT_CHARS) {
    throw new Error(`Metin çok uzun (${input.length.toLocaleString('tr')} karakter). Sınır ${MAX_IMPORT_CHARS.toLocaleString('tr')}.`);
  }
  const text = input.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
  const paras = text.split(/\n[ \t]*\n+/);
  const blocks: Block[] = [];
  for (const p of paras) {
    const trimmed = p.replace(/^\n+|\n+$/g, '');
    if (!trimmed.trim()) continue;
    const h = trimmed.match(/^#{1,6}[ \t]+(.+)$/u);
    if (h && !trimmed.includes('\n')) {
      blocks.push({ id: newId(), type: 'heading', text: h[1]!.trim() });
      continue;
    }
    const noteMd = trimmed.match(/^%%[ \t]?([\s\S]*)$/u);
    if (noteMd) {
      blocks.push({ id: newId(), type: 'note', text: noteMd[1]!.trim() });
      continue;
    }
    const type: BlockType = opts.notesFromBrackets && isBracketNoteCandidate(trimmed) ? 'note' : 'speech';
    blocks.push({ id: newId(), type, text: trimmed });
  }
  return blocks;
}

export function blocksToMarkdown(title: string, blocks: Block[]): string {
  const parts = [`# ${title}`];
  for (const b of blocks) {
    if (b.type === 'heading') parts.push(`## ${b.text}`);
    else if (b.type === 'note') parts.push(`%% ${b.text}`);
    else parts.push(b.text);
  }
  return parts.join('\n\n') + '\n';
}

export function blocksToPlainText(blocks: Block[], includeNotes = false): string {
  return (
    blocks
      .filter((b) => includeNotes || b.type !== 'note')
      .map((b) => stripInline(b.text))
      .join('\n\n') + '\n'
  );
}

/** Markdown içe aktarma: "## Başlık" bölüm olur, ilk "# Başlık" metin adı olur. */
export function parseMarkdown(md: string): { title: string | null; blocks: Block[] } {
  const text = md.replace(/\r\n?/g, '\n');
  const m = text.match(/^\uFEFF?#[ \t]+(.+)\n/u);
  const title = m ? m[1]!.trim() : null;
  const body = m ? text.slice(m[0].length) : text;
  return { title, blocks: parsePlainText(body) };
}
