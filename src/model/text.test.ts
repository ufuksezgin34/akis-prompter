import { describe, expect, it, afterEach } from 'vitest';
import {
  countWords, splitSentences, includesTr, stripTimecodes, findTimecodes, parsePlainText,
  parseMarkdown, blocksToMarkdown, estimateSeconds, formatDuration, speechWordCount, _setSegmenterFallback,
} from './text';
import { parseInline, stripInline } from './inline';

afterEach(() => _setSegmenterFallback(false));

for (const fallback of [false, true]) {
  describe(`cümle/kelime (${fallback ? 'fallback' : 'Intl.Segmenter'})`, () => {
    const setup = () => _setSegmenterFallback(fallback);

    it('kelime sayar, Türkçe karakterleri korur', () => {
      setup();
      expect(countWords('Şu ağacın gölgesi çok güzel.')).toBe(5);
      expect(countWords('**Kalın** ve ==vurgulu== söz')).toBe(4);
      expect(countWords('')).toBe(0);
    });

    it('Dr. ve vb. kısaltmalarında cümle bölmez', () => {
      setup();
      const s = splitSentences('Dr. Ayşe geldi. Masa, sandalye vb. eşyalar taşındı. Bitti.');
      expect(s.map((x) => x.trim())).toEqual(['Dr. Ayşe geldi.', 'Masa, sandalye vb. eşyalar taşındı.', 'Bitti.']);
    });

    it('ondalık sayıda bölmez', () => {
      setup();
      const s = splitSentences('Tavan 2.75 metre yüksek. Pencere geniş.');
      expect(s.map((x) => x.trim())).toEqual(['Tavan 2.75 metre yüksek.', 'Pencere geniş.']);
    });

    it('üç noktadan sonra küçük harfle devam eden cümleyi birleştirir', () => {
      setup();
      const s = splitSentences('Ve sonra... evet, öyle oldu. Yeni cümle.');
      expect(s.map((x) => x.trim())).toEqual(['Ve sonra... evet, öyle oldu.', 'Yeni cümle.']);
    });

    it('parçaların birleşimi orijinal metindir', () => {
      setup();
      const t = 'Merhaba! Nasılsın? “Akıllı tırnak” korunur… 🙂 Son.';
      expect(splitSentences(t).join('')).toBe(t);
    });
  });
}

describe('Türkçe arama', () => {
  it('I/ı ve İ/i dönüşümleri', () => {
    expect(includesTr('IŞIK TASARIMI', 'ışık')).toBe(true);
    expect(includesTr('İç mimarlık', 'iç')).toBe(true);
    expect(includesTr('istanbul', 'İSTANBUL')).toBe(true);
    expect(includesTr('ISIK', 'isik')).toBe(false); // Türkçede I → ı
  });
  it('NFC/NFD farkına dayanıklı', () => {
    expect(includesTr('çay'.normalize('NFD'), 'çay')).toBe(true);
  });
});

describe('zaman kodları', () => {
  it('satır başı kodları temizler, anlamlı sayılara dokunmaz', () => {
    const t = '00:01 – Merhaba\n[01:23:45] Devam\n12:30 de buluşalım dedik\nOda 3:4 oranında.';
    expect(findTimecodes(t)).toBe(3);
    expect(stripTimecodes(t)).toBe('Merhaba\nDevam\nde buluşalım dedik\nOda 3:4 oranında.');
  });
});

describe('içe aktarma modeli', () => {
  it('başlık, not ve konuşmayı ayırır; köşeli parantezi açık seçimle not yapar', () => {
    const b = parsePlainText('# Giriş\n\nMerhaba.\n\n[GÜLÜMSE]\n\n%% kamera sola');
    expect(b.map((x) => x.type)).toEqual(['heading', 'speech', 'speech', 'note']);
    const b2 = parsePlainText('Merhaba.\n\n[GÜLÜMSE]', { notesFromBrackets: true });
    expect(b2.map((x) => x.type)).toEqual(['speech', 'note']);
  });
  it('notlar süre hesabına katılmaz', () => {
    const b = parsePlainText('Bir iki üç.\n\n%% dört beş altı yedi');
    expect(speechWordCount(b)).toBe(3);
  });
  it('markdown round-trip', () => {
    const b = parsePlainText('## Bölüm\n\nSatır bir\nsatır iki 🙂\n\n%% not');
    const md = blocksToMarkdown('Başlık', b);
    const back = parseMarkdown(md);
    expect(back.title).toBe('Başlık');
    expect(back.blocks.map(({ type, text }) => ({ type, text }))).toEqual(b.map(({ type, text }) => ({ type, text })));
  });
  it('çok uzun metni açıklayıcı hatayla reddeder', () => {
    expect(() => parsePlainText('a'.repeat(2_000_001))).toThrow(/çok uzun/);
  });
});

describe('satır içi biçim', () => {
  it('kalın ve vurgu', () => {
    expect(parseInline('a **b** ==c==')).toEqual([
      { text: 'a ', bold: false, accent: false },
      { text: 'b', bold: true, accent: false },
      { text: ' ', bold: false, accent: false },
      { text: 'c', bold: false, accent: true },
    ]);
  });
  it('eşleşmeyen işaret düz metin kalır; HTML yorumlanmaz', () => {
    expect(stripInline('2**3 <b>x</b>')).toBe('2**3 <b>x</b>');
  });
});

describe('süre', () => {
  it('tahmin ve biçim', () => {
    expect(estimateSeconds(140, 140)).toBe(60);
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3725)).toBe('1:02:05');
  });
});
