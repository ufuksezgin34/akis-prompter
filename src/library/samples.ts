import type { Block } from '../model/types';
import { newId } from '../model/text';

const sp = (text: string): Block => ({ id: newId(), type: 'speech', text });
const h = (text: string): Block => ({ id: newId(), type: 'heading', text });
const n = (text: string): Block => ({ id: newId(), type: 'note', text });

/** ~70 kelime: 140 kelime/dk'da yaklaşık 30 saniye. */
export function reelsSample(): { title: string; tags: string[]; blocks: Block[] } {
  return {
    title: 'Örnek — 30 saniyelik Reels',
    tags: ['Örnek', 'Reels'],
    blocks: [
      n('[KAMERAYA BAK, GÜLÜMSE]'),
      sp('Küçük bir salonu daha geniş göstermenin en kolay yolu nedir? **Işık.** Tavanın ortasındaki tek lamba yerine, odayı üç katmanda aydınlatın.'),
      sp('Genel ışık için tavanı, çalışma alanı için masa lambasını, atmosfer için de duvar aplikini kullanın.'),
      n('[ÜRÜNÜ GÖSTER]'),
      sp('Sıcak beyaz, yani yaklaşık 2700 Kelvin seçerseniz akşamları oda ==hem büyük hem de samimi== görünür. Kaydedin, bir sonraki alışverişte işinize yarar.'),
    ],
  };
}

const PARAGRAPHS = [
  'Bir mekânı tasarlarken ilk sorduğumuz soru, orada kimin yaşayacağı ve günün hangi saatlerinde orayı nasıl kullanacağıdır. Ölçüler, malzemeler ve renkler bu sorunun cevabına göre şekillenir.',
  'Doğal ışığın yönü, mobilya yerleşimini doğrudan etkiler. Güneydoğuya bakan bir odada sabah ışığı çalışma masası için idealdir; batıya bakan bir odada ise öğleden sonra perdeye ihtiyaç duyulur.',
  'Malzeme seçiminde dayanıklılık kadar bakım kolaylığı da önemlidir. Mutfakta mat yüzeyler parmak izini daha az gösterir, ancak bazı mat boyalar sık silinmeye karşı daha hassastır.',
  'Depolama, iyi tasarımın görünmeyen kahramanıdır. Kapı arkaları, merdiven altları ve yatak bazası gibi alanlar doğru planlandığında evin genel ferahlığı belirgin şekilde artar.',
  'Renk paletini belirlerken genellikle yüzde altmış ana renk, yüzde otuz ikincil renk ve yüzde on vurgu rengi oranı iyi bir başlangıçtır. Bu kural mutlak değildir, ama dengeli bir sonuç verir.',
  'Akustik çoğu zaman unutulur. Halılar, perdeler, kitaplıklar ve yumuşak dokulu mobilyalar yankıyı azaltır; özellikle yüksek tavanlı ve sert zeminli odalarda bu fark hemen hissedilir.',
  'Bütçeyi yönetmek için önce dokunduğumuz yüzeylere yatırım yapmayı öneririz: kapı kolları, tezgâh, oturma grubu. Göz hizasının üstündeki detaylar daha sonra da güncellenebilir.',
  'Son olarak, bir mekânın karakteri zamanla oluşur. Kişisel objeler, seyahat hatıraları ve el yapımı parçalar, katalogdan çıkmış gibi görünen bir evi gerçekten size ait hale getirir.',
];

/** Yaklaşık 1250 kelime: 140 kelime/dk'da yaklaşık 9 dakika. */
export function longFormSample(): { title: string; tags: string[]; blocks: Block[] } {
  const blocks: Block[] = [];
  const sections = ['Giriş', 'Işık ve yön', 'Malzeme ve bakım', 'Depolama', 'Renk ve akustik', 'Bütçe', 'Kapanış'];
  sections.forEach((title, si) => {
    blocks.push(h(title));
    if (si === 0) blocks.push(n('[GENİŞ PLAN — kamera 1]'));
    for (let i = 0; i < 7; i++) blocks.push(sp(PARAGRAPHS[(si * 3 + i) % PARAGRAPHS.length]!));
    if (si === 3) blocks.push(n('[DOLABI AÇ, İÇİNİ GÖSTER]'));
  });
  blocks.push(sp('İzlediğiniz için teşekkürler. Sorularınızı yorumlara yazın; bir sonraki videoda görüşmek üzere.'));
  return { title: 'Örnek — 8–10 dakikalık anlatım', tags: ['Örnek', 'YouTube'], blocks };
}

/** 10.000+ kelimelik stres testi metni. */
export function stressSample(targetWords = 10_500): { title: string; tags: string[]; blocks: Block[] } {
  const blocks: Block[] = [];
  let words = 0;
  let i = 0;
  while (words < targetWords) {
    if (i % 12 === 0) blocks.push(h(`Bölüm ${i / 12 + 1}`));
    const p = `${i + 1}. paragraf. ${PARAGRAPHS[i % PARAGRAPHS.length]!}`;
    blocks.push(sp(p));
    words += p.split(/\s+/).length;
    i++;
  }
  return { title: 'Stres testi — 10.000+ kelime', tags: ['Örnek', 'Test'], blocks };
}
