import { expect, it } from 'vitest';
import { nextSentenceOffset, prevSentenceOffset, type Layout } from './layout';

const el = {} as HTMLElement;
const lay: Layout = {
  readingLineY: 0,
  startY: 0,
  maxOffset: 400,
  blocks: [{ blockId: 'b', top: 0, bottom: 400 }],
  sections: [],
  // 0 ve 1 aynı satırda (top 0), 2 ve 3 aynı satırda (top 100), 4 ayrı satırda (top 200)
  sentences: [0, 0, 100, 100, 200].map((top, i) => ({ blockId: 'b', top, bottom: top + 50, index: i, el })),
};

it('önceki cümle aynı satırdaki cümlede takılmaz', () => {
  expect(prevSentenceOffset(lay, 200)).toBe(100);
  expect(prevSentenceOffset(lay, 100)).toBe(0);
  expect(prevSentenceOffset(lay, 150)).toBe(100); // satır ortasında: o cümlenin başına
});

it('sonraki cümle bir alt satıra geçer', () => {
  expect(nextSentenceOffset(lay, 0)).toBe(100);
  expect(nextSentenceOffset(lay, 100)).toBe(200);
  expect(nextSentenceOffset(lay, 200)).toBeNull();
});
