# Test raporu — 5 Kasım 2026

Ortam: Linux bulut çalışma alanı, Node 22.23.4, npm 10.9.9. Tarayıcı: sistemdeki Google Chrome (headless, Playwright 1.64.1 üzerinden). Playwright’ın kendi Chromium/WebKit indirmesi ağ kısıtı nedeniyle **engellendi** (cdn.playwright.dev 403).

## Çalıştırılan komutlar

| Komut | Sonuç |
|---|---|
| `npm ci` / `npm install` | ✅ |
| `npm run typecheck` (`tsc -b`, strict) | ✅ hata yok |
| `npm run lint` (ESLint 9 + typescript-eslint + react-hooks) | ✅ hata/uyarı yok |
| `npm test` (Vitest 5, jsdom, fake-indexeddb) | ✅ 38/38 |
| `npm run build` | ✅ `dist/` ~400 KB; ana JS 305 KB (gzip 97 KB); Ayarlar ve Yedekleme sayfaları ayrı tembel paket |
| `npm run test:e2e` | ✅ 21/21 (16 masaüstü Chrome, 5 mobil emülasyon “Pixel 7” Chrome) |

`npm audit`: `vite-plugin-pwa → workbox-build → @rollup/plugin-node-resolve → deepmerge/glob` zincirinde orta düzey bildirimler var. Bunlar **yalnızca derleme zamanı** araçlarıdır; yayınlanan uygulamaya girmez. Önerilen “düzeltme” vite-plugin-pwa’yı eski ana sürüme düşürdüğü için uygulanmadı.

## Kabul testleri eşlemesi

| # | Kabul ölçütü | Test | Sonuç |
|---|---|---|---|
| 1 | Oluştur, düzenle, kapat/aç → içerik aynı | e2e `1.` + birim (Unicode korunur) | ✅ |
| 2 | 10.000+ kelimede akış/duraklat/devam | e2e `2.` (stres örneği 10.523 kelime) | ✅ |
| 3 | Farklı kare aralıklarında aynı mesafe; arka plandan dönüşte sıçrama yok | birim: 60/90/120 Hz + 7 ms + 23 ms kare → 10 sn’de 800 px (±0,5); 5 sn tek kare sınırlandırılır; e2e `3.` gizlenince duraklar | ✅ |
| 4 | Yazı boyutu / pencere / sütun değişince okuma yeri korunur | e2e `4.` (font 56→90 px, pencere 1280→700 px; aynı cümle çizgide) | ✅ |
| 5 | Ayna açıkken kontroller doğru | e2e `5.` | ✅ |
| 6 | Cümle geri, take tekrarı, bölüm, metin sonu | e2e `6.` ve `6b.` (tekrar al: cümle başı + 3 sn sayaç + yeniden akış) | ✅ |
| 7 | Editörde Space oynatmaz | e2e `7.` | ✅ |
| 8 | Cache hazırken internet kesilince çekirdek çalışır | e2e `8.` (Playwright `setOffline`) | ✅ |
| 9 | JSON round-trip; bozuk dosya veriyi bozmaz | birim (4 test) + e2e `9.` | ✅ |
| 10 | Depolama hatasında metin sessizce kaybolmaz | e2e `10.` (IndexedDB `put` QuotaExceeded taklidi) | ✅ |
| 11 | Wake Lock / tam ekran reddi çökertmez | e2e `11.` | ✅ — kamera/mikrofon henüz yok (Faz C) |
| 12 | İkinci pencere senkronu | — | ⏳ Faz B. Çoklu sekme **veri** çakışması e2e `12.` ile test edildi |
| 13 | Remote | — | ⏳ Faz C, uygulanmadı |
| 14 | Kayıt dosyası | — | ⏳ Faz C, uygulanmadı |
| 15 | Ses takibi | — | ⏳ Faz C, uygulanmadı |
| 16 | Mobil dikey/yatay, safe-area, klavye | e2e mobil: 320×640, 390×844, 844×390 — yatay taşma yok, tüm kontroller ekranda ve ≥40 px | ✅ emülasyon. Safe-area ve sanal klavye **gerçek cihazda denenmedi** |
| 17 | Çekim sürerken güncelleme yenilemez | Kod: `registerType: 'prompt'`, okuma ekranında bildirim gizli. e2e `17.` yalnızca kayıt güncellemesi tetikleyip sayfanın yenilenmediğini kontrol ediyor | ⚠️ kısmi — gerçek yeni sürüm dağıtımı taklit edilmedi |

## Performans ölçümü

| Cihaz | Tarayıcı | Metin | Ölçüm |
|---|---|---|---|
| Bulut Linux VM (GPU yok) | Chrome headless, 1280×720 | 10.523 kelime, 56 px | 3 sn’de 181 kare; kare aralığı p95 16,7 ms, en fazla 16,8 ms |

Headless ortamda vsync sanaldır; bu değer **gerçek telefonda akıcılık kanıtı değildir**. 30 dakikalık okuma süresi boyunca ölçüm yapılmadı.

## Gerçek cihazda denenmeyenler (yapılması gerekenler)

- iPhone / iPad Safari ve Ana Ekrana Ekle modu (safe-area, Dynamic Island, sanal klavye, Wake Lock).
- Safari macOS.
- 90/120 Hz ekranlarda gözle akıcılık.
- Fiziksel prompter camında ayna okunabilirliği.
- Bluetooth sunum kumandası / ayak pedalı tuş eşlemesi.
- Gerçek kota dolması (taklit edildi), gerçek tarayıcı veri temizliği.
- Edge (Chromium tabanlı; Chrome ile aynı motor ama ayrıca denenmedi).

## Bilinen sorunlar / sınırlamalar

- Okuma ekranında `hyphens: auto` Türkçe heceleme sözlüğü olmayan tarayıcılarda etkisizdir; çok büyük yazıda uzun kelime satır sonunda bölünebilir. Dar ekranda bir kez “yazı boyutu büyük” uyarısı gösterilir.
- Editörde geri al/ileri al blok düzeyindedir; Ctrl/⌘+Z textarea’nın kendi geçmişi yerine uygulama geçmişini kullanır.
- Okuma ekranındaki ayar değişiklikleri o anki profile kaydedilir (400 ms erteleme). Geçici değişiklik isteyenler profili çoğaltmalı.
