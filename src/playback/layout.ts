import type { ReadingAnchor } from '../model/types';

const EPS = 4;

/**
 * Okuma görünümünün ölçümleri. Yalnızca yerleşim değiştiğinde (ResizeObserver, font yüklenmesi,
 * ayar değişimi) yeniden ölçülür; her karede DOM okunmaz.
 * Tüm y değerleri içerik kabının (position: relative) üstüne göredir ve transform'dan etkilenmez.
 */
export interface MeasuredItem {
  blockId: string;
  top: number;
  bottom: number;
}

export interface MeasuredSentence extends MeasuredItem {
  index: number; // global cümle sırası
  el: HTMLElement;
}

export interface Layout {
  /** Okuma çizgisinin içerik kabının görünür üstünden uzaklığı (px). */
  readingLineY: number;
  blocks: MeasuredItem[];
  sentences: MeasuredSentence[];
  sections: MeasuredItem[];
  /** Son satır okuma çizgisine geldiğinde ulaşılan offset. */
  maxOffset: number;
  /** offset = 0 iken ilk satırın içerik y'si. */
  startY: number;
}

function topWithin(el: HTMLElement, container: HTMLElement): number {
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== container) {
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return y;
}

export function measure(content: HTMLElement, readingLineY: number): Layout {
  const blocks: MeasuredItem[] = [];
  const sections: MeasuredItem[] = [];
  const sentences: MeasuredSentence[] = [];
  content.querySelectorAll<HTMLElement>('[data-block-id]').forEach((el) => {
    const top = topWithin(el, content);
    const item = { blockId: el.dataset.blockId!, top, bottom: top + el.offsetHeight };
    blocks.push(item);
    if (el.dataset.kind === 'heading') sections.push(item);
  });
  content.querySelectorAll<HTMLElement>('[data-s]').forEach((el, i) => {
    const top = topWithin(el, content);
    const block = el.closest<HTMLElement>('[data-block-id]');
    sentences.push({ blockId: block?.dataset.blockId ?? '', top, bottom: top + el.offsetHeight, index: i, el });
  });
  const first = blocks[0];
  const last = blocks[blocks.length - 1];
  const startY = first ? first.top : 0;
  // Son satırın ÜSTÜ okuma çizgisine geldiğinde değil, satır tamamen çizgiyi geçtiğinde biter.
  const endY = last ? last.bottom : 0;
  return {
    readingLineY,
    blocks,
    sentences,
    sections,
    startY,
    maxOffset: Math.max(0, endY - startY),
  };
}

/** offset → içerikte okuma çizgisinin denk geldiği y. */
export function lineY(layout: Layout, offset: number): number {
  return layout.startY + offset;
}

export function offsetForY(layout: Layout, y: number): number {
  return y - layout.startY;
}

export function anchorAt(layout: Layout, offset: number): ReadingAnchor | null {
  const y = lineY(layout, offset);
  let found: MeasuredItem | undefined;
  for (const b of layout.blocks) {
    if (b.top <= y + EPS) found = b;
    else break;
  }
  if (!found) return layout.blocks[0] ? { blockId: layout.blocks[0].blockId, fraction: 0 } : null;
  const h = Math.max(1, found.bottom - found.top);
  const anchor: ReadingAnchor = { blockId: found.blockId, fraction: Math.min(1, Math.max(0, (y - found.top) / h)) };
  const inBlock = layout.sentences.filter((s) => s.blockId === found.blockId);
  let si = -1;
  for (let i = 0; i < inBlock.length; i++) if (inBlock[i]!.top <= y + EPS) si = i;
  if (si >= 0) {
    const s = inBlock[si]!;
    anchor.sentence = si;
    anchor.sentenceFraction = Math.min(1, Math.max(0, (y - s.top) / Math.max(1, s.bottom - s.top)));
  }
  return anchor;
}

export function offsetForAnchor(layout: Layout, anchor: ReadingAnchor | null): number | null {
  if (!anchor) return null;
  const b = layout.blocks.find((x) => x.blockId === anchor.blockId);
  if (!b) return null;
  if (anchor.sentence !== undefined) {
    const s = layout.sentences.filter((x) => x.blockId === anchor.blockId)[anchor.sentence];
    if (s) return offsetForY(layout, s.top + (anchor.sentenceFraction ?? 0) * (s.bottom - s.top));
  }
  return offsetForY(layout, b.top + anchor.fraction * (b.bottom - b.top));
}


export function currentSentenceIndex(layout: Layout, offset: number): number {
  const y = lineY(layout, offset);
  let idx = -1;
  for (const s of layout.sentences) {
    if (s.top <= y + EPS) idx = s.index;
    else break;
  }
  return idx;
}

export function nextSentenceOffset(layout: Layout, offset: number): number | null {
  const y = lineY(layout, offset);
  const s = layout.sentences.find((x) => x.top > y + EPS);
  return s ? offsetForY(layout, s.top) : null;
}

/**
 * Önceki cümle: okuma çizgisi mevcut cümlenin başından belirgin şekilde ilerideyse önce o cümlenin
 * başına döner; zaten başındaysa bir öncekine.
 */
export function prevSentenceOffset(layout: Layout, offset: number, mode: 'current' | 'previous' = 'current'): number {
  const idx = currentSentenceIndex(layout, offset);
  if (idx < 0) return 0;
  const cur = layout.sentences[idx]!;
  const atStart = Math.abs(lineY(layout, offset) - cur.top) <= EPS;
  const target = mode === 'previous' || atStart ? layout.sentences[idx - 1] ?? cur : cur;
  return offsetForY(layout, target.top);
}

export function nextSectionOffset(layout: Layout, offset: number): number | null {
  const y = lineY(layout, offset);
  const s = layout.sections.find((x) => x.top > y + EPS);
  return s ? offsetForY(layout, s.top) : null;
}

export function prevSectionOffset(layout: Layout, offset: number): number {
  const y = lineY(layout, offset);
  const before = layout.sections.filter((x) => x.top < y - EPS);
  const t = before[before.length - 1];
  return t ? offsetForY(layout, t.top) : 0;
}
