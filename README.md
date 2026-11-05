# Akış Prompter

Türkçe öncelikli, tamamen cihazda çalışan teleprompter (web/PWA). Hesap, sunucu, reklam, abonelik veya ücretli API gerektirmez. Kamera/mikrofon izni istemeden metin gösterir.

> Durum: **Faz A (zorunlu çekirdek) tamamlandı.** Faz B’nin bir kısmı (cümle/bölüm gezinme, tekrar al, prova hızı ölçümü) da hazır. Ayrıntı: [FEATURES.md](FEATURES.md), [PROGRESS.md](PROGRESS.md).

## Gereksinimler

- Node.js 22+ ve npm 10+ (geliştirme ortamında Node 22.23, npm 10.9 ile doğrulandı)
- Uygulamayı **kullanmak** için yalnızca güncel bir tarayıcı (Safari iOS/iPadOS/macOS, Chrome, Edge)

## Kurulum ve geliştirme

```bash
npm ci            # lockfile’daki sürümlerle kurar
npm run dev       # http://localhost:5173 (service worker geliştirme modunda kapalı)
```

Telefonda denemek için `npm run dev -- --host` ile aynı ağdan açabilirsiniz; **ancak yerel ağ HTTP adresi güvenli bağlam değildir**: service worker (çevrimdışı), Wake Lock ve bazı API’ler çalışmaz. Gerçek cihaz testi için aşağıdaki HTTPS yayın yolunu kullanın.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run typecheck` | TypeScript strict denetimi |
| `npm run lint` | ESLint |
| `npm test` | Birim/entegrasyon testleri (Vitest + fake-indexeddb) |
| `npm run build` | Üretim derlemesi → `dist/` (~400 KB, gzip’li JS ~97 KB) |
| `npm run preview` | Derlenmiş sürümü yerelde sunar (http://localhost:4173) |
| `npm run test:e2e` | Derler ve Playwright kullanıcı akışlarını çalıştırır |

Playwright, tarayıcıyı `/usr/bin/google-chrome` yolundan kullanır (ortamda Playwright’ın kendi indirmesi engelliydi). Farklı yol için `CHROME_PATH=... npm run test:e2e`; kendi makinenizde `npx playwright install` sonrası WebKit projesi için `PW_WEBKIT=1`. **Playwright WebKit, gerçek iPhone/iPad Safari testi yerine geçmez.**

## Ücretsiz statik yayınlama

`dist/` klasörü herhangi bir statik HTTPS sunucusunda çalışır (`base: './'`, hash yönlendirme — sunucu ayarı gerekmez, alt klasörde de çalışır). Özel alan adı gerekmez.

**Canlı adres:** https://ufuksezgin34.github.io/akis-prompter/ — `main` dalına her gönderimde `.github/workflows/deploy.yml` test eder, derler ve `gh-pages` dalına yayınlar.

**Seçenek 1 — GitHub Pages** (5 Kasım 2026’da resmî dokümandan doğrulandı):
- Ücretsiz GitHub hesabında yalnızca **public** depolarda çalışır. Metinleriniz depoda değil, tarayıcınızda durur; depoya yalnızca uygulama kodu gider.
- Site en fazla 1 GB; aylık 100 GB **yumuşak** bant genişliği sınırı; saatte 10 derleme yumuşak sınırı.
- GitHub, Pages’in ticari SaaS/e-ticaret barındırması olarak kullanılmasına izin vermez; kişisel/ekip aracı kullanımı bu tanıma girmez, ama koşulları kendiniz değerlendirin.
- Adımlar: depoyu GitHub’a gönderin → Settings → Pages → “GitHub Actions” → Vite statik site iş akışı (build komutu `npm ci && npm run build`, yayın klasörü `dist`).

**Seçenek 2 — Cloudflare Pages** (aynı tarihte resmî dokümandan doğrulandı):
- Ücretsiz planda ayda 500 derleme, site başına 20.000 dosya, dosya başına 25 MiB. Doküman bant genişliği sınırı belirtmiyor; plan koşulları değişebilir.
- Git bağlamadan “Direct Upload” ile `dist/` klasörünü sürükleyip bırakabilirsiniz; adres `*.pages.dev` olur.

Ücretsiz katmanların koşulları değişebilir; “sonsuza kadar ve sınırsız” değildir.

Kaynaklar: [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits)

## Uygulama olarak kurma (PWA)

- **iPhone/iPad:** Safari’de siteyi açın → Paylaş → **Ana Ekrana Ekle**. Simgeden açınca tarayıcı çubukları görünmez.
- **Chrome/Edge (masaüstü/Android):** adres çubuğundaki “Yükle” simgesi veya Ayarlar sayfasındaki “Uygulamayı kur”.
- Çevrimdışı çalışma, **bir kez internetle tam yükleme ve önbellek hazırlığından sonra** mümkündür (“Uygulama çevrimdışı kullanıma hazır” bildirimi). İlk ziyaret çevrimdışı çalışmaz.
- Yeni sürüm yüklendiğinde okuma ekranı dışında “Yeni sürüm hazır” çubuğu çıkar; sayfa **asla kendiliğinden yenilenmez**.

## Kısa kullanım

1. **Metinlerim → + Yeni metin** (veya TXT/Markdown içe aktar, ya da “Metin yapıştır”).
   - Blok türleri: **Bölüm başlığı**, **Konuşma** (okunur, süreye sayılır), **Yönetmen notu** (okunmaz, süreye sayılmaz).
   - Markdown/yapıştırmada `# Başlık` → bölüm, `%% not` → yönetmen notu. `[GÜLÜMSE]` gibi satırlar otomatik değişmez; “Diğer araçlar → [Köşeli] satırları nota çevir” ile seçerek dönüştürürsünüz.
   - Biçim: `**kalın**`, `==vurgu==` (seçip K / V düğmeleri).
2. **▶ Oku** → okuma ekranı. ⚙ ile profil, yazı, okuma çizgisi, ayna, hız, sayaç, hedef süre.
3. Klavye (Ayarlar’dan değiştirilebilir): Boşluk oynat/duraklat · ↑/↓ hız · ←/→ cümle · PageUp/PageDown bölüm · Home başa · R tekrar al · F tam ekran · M ayna · Esc çık.
4. **Yedekleme:** JSON tam yedek indir / geri yükle. Cihazlar arası otomatik eşitleme yoktur; dosyayla aktarın.

## Belgeler

- [FEATURES.md](FEATURES.md) — özellik durumu (tamamlandı / deneysel / ertelendi / desteklenmiyor)
- [TEST_REPORT.md](TEST_REPORT.md) — çalıştırılan testler, ölçümler, denenmeyenler
- [DATA.md](DATA.md) — veri modeli, saklama ve yedekleme
- [APPLE_ROADMAP.md](APPLE_ROADMAP.md) — iPhone/iPad geçiş planı
- [LICENSES.md](LICENSES.md) — üçüncü taraf lisansları ve maliyet/bağımlılık tablosu
- [PROGRESS.md](PROGRESS.md) — devam eden iş ve sonraki adım
