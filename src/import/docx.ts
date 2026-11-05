import type { Block } from '../model/types';
import { newId } from '../model/text';

export const MAX_DOCX_BYTES = 20 * 1024 * 1024;
const MAX_XML_BYTES = 30 * 1024 * 1024;

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/**
 * DOCX → düz metin blokları. Yalnızca paragraf metni alınır; biçim (yazı tipi, renk, tablo düzeni,
 * görseller) kaybolur. "Heading/Başlık" stilli paragraflar bölüm başlığı olur.
 * Açılmış XML boyutu sınırlandırılır (zip bombasına karşı). Hiçbir içerik çalıştırılmaz.
 */
export async function docxToBlocks(file: File): Promise<Block[]> {
  if (file.size > MAX_DOCX_BYTES) throw new Error('DOCX dosyası 20 MB sınırını aşıyor.');
  const { unzipSync } = await import('fflate');
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) throw new Error('Bu dosya geçerli bir DOCX (Word) dosyası değil.');
  let tooBig = false;
  const files = unzipSync(buf, {
    filter: (f) => {
      if (f.name !== 'word/document.xml') return false;
      if (f.originalSize > MAX_XML_BYTES) {
        tooBig = true;
        return false;
      }
      return true;
    },
  });
  if (tooBig) throw new Error('Belgenin açılmış hali çok büyük.');
  const xml = files['word/document.xml'];
  if (!xml) throw new Error('Belgede metin bölümü bulunamadı.');
  const doc = new DOMParser().parseFromString(new TextDecoder('utf-8').decode(xml), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Belge okunamadı (bozuk XML).');

  const blocks: Block[] = [];
  const paras = doc.getElementsByTagNameNS(W, 'p');
  for (const p of Array.from(paras)) {
    let text = '';
    const walk = (n: Element) => {
      for (const c of Array.from(n.children)) {
        if (c.namespaceURI !== W) continue;
        if (c.localName === 't') text += c.textContent ?? '';
        else if (c.localName === 'tab') text += '\t';
        else if (c.localName === 'br' || c.localName === 'cr') text += '\n';
        else if (c.localName !== 'pPr' && c.localName !== 'p') walk(c);
      }
    };
    walk(p);
    text = text.replace(/[ \t]+\n/g, '\n').trim();
    if (!text) continue;
    const style = p.getElementsByTagNameNS(W, 'pStyle')[0]?.getAttributeNS(W, 'val') ?? '';
    const heading = /^(heading|başlık|baslik|title)/i.test(style);
    blocks.push({ id: newId(), type: heading ? 'heading' : 'speech', text });
  }
  return blocks;
}
