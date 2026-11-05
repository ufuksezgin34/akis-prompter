import { expect, it } from 'vitest';
import { findAll, replaceAllTr } from './findReplace';

it('Türkçe duyarsız bul/değiştir', () => {
  expect(findAll('IŞIK ve ışık', 'ışık')).toEqual([0, 8]);
  expect(replaceAllTr('İstanbul ve istanbul', 'istanbul', 'Ankara')).toEqual({ text: 'Ankara ve Ankara', count: 2 });
  expect(replaceAllTr('abc', '', 'x').count).toBe(0);
});
