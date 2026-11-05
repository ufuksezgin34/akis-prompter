import type { Block } from './types';

/** Türkçe büyük/küçük harf duyarsız eşleşme konumları. */
export function findAll(text: string, needle: string): number[] {
  if (!needle) return [];
  const t = text.normalize('NFC');
  const n = needle.normalize('NFC');
  const lt = t.toLocaleLowerCase('tr');
  const ln = n.toLocaleLowerCase('tr');
  // Küçük harfe çevirme uzunluğu değiştirdiyse güvenli yol: birebir arama.
  const [hay, ndl] = lt.length === t.length && ln.length === n.length ? [lt, ln] : [t, n];
  const out: number[] = [];
  let i = hay.indexOf(ndl);
  while (i !== -1) {
    out.push(i);
    i = hay.indexOf(ndl, i + Math.max(1, ndl.length));
  }
  return out;
}

export function replaceAllTr(text: string, needle: string, replacement: string): { text: string; count: number } {
  const t = text.normalize('NFC');
  const idx = findAll(t, needle);
  if (idx.length === 0) return { text, count: 0 };
  const len = needle.normalize('NFC').length;
  let out = '';
  let last = 0;
  for (const i of idx) {
    out += t.slice(last, i) + replacement;
    last = i + len;
  }
  return { text: out + t.slice(last), count: idx.length };
}

export function countInBlocks(blocks: Block[], needle: string): number {
  return blocks.reduce((n, b) => n + findAll(b.text, needle).length, 0);
}

export function replaceInBlocks(blocks: Block[], needle: string, replacement: string): { blocks: Block[]; count: number } {
  let count = 0;
  const next = blocks.map((b) => {
    const r = replaceAllTr(b.text, needle, replacement);
    count += r.count;
    return r.count ? { ...b, text: r.text } : b;
  });
  return { blocks: next, count };
}
