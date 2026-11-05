# Üçüncü taraf bağımlılıklar, lisanslar ve maliyet

Tüm bağımlılıklar açık kaynaklıdır; hiçbiri hesap, API anahtarı veya ödeme gerektirmez. Sürümler `package-lock.json` ile sabitlenmiştir (5 Kasım 2026’da npm’deki güncel kararlı sürümler; TypeScript, `typescript-eslint` uyumu için 7.x yerine 6.0 tutuldu).

## Çalışma zamanı (yayınlanan uygulamaya girer)

| Paket | Sürüm | Lisans | Neden |
|---|---|---|---|
| react, react-dom | 19.3.1 | MIT | Arayüz |
| idb | 8.0.4 | ISC | IndexedDB için küçük Promise sarmalayıcı (~1 KB) |
| workbox-window | 7.4.1 | MIT | Service worker kaydı ve “yeni sürüm hazır” bildirimi |
| (oluşturulan) workbox runtime | 7.x | MIT | Çevrimdışı önbellek (vite-plugin-pwa üretir) |

Font ve ikon: sistem fontları ve Unicode simgeler; harici font/CDN yok. Uygulama simgesi bu projede çizildi (`public/icon.svg`).

## Geliştirme araçları (yayına girmez)

| Paket | Sürüm | Lisans | Neden |
|---|---|---|---|
| vite | 8.3.6 | MIT | Geliştirme sunucusu ve derleme |
| @vitejs/plugin-react | 6.2.1 | MIT | React/JSX dönüşümü |
| vite-plugin-pwa | 2.0.0 | MIT | Manifest + service worker üretimi |
| typescript | 6.0.3 | Apache-2.0 | Tip denetimi (strict) |
| vitest | 5.1.0 | MIT | Birim/entegrasyon testleri |
| jsdom | 31.0.0 | MIT | Testte DOM |
| fake-indexeddb | 6.2.7 | Apache-2.0 | Testte IndexedDB |
| @playwright/test | 1.64.1 | Apache-2.0 | Uçtan uca testler |
| eslint, @eslint/js | 9.39.5 | MIT | Lint |
| typescript-eslint | 8.72.1 | MIT | TS lint kuralları |
| eslint-plugin-react-hooks | 7.1.1 | MIT | Hook kuralları |
| globals | 17.x | MIT | Lint ortam tanımları |

## Maliyet / bağımlılık tablosu

| Kalem | Gerekli mi? | Maliyet |
|---|---|---|
| Uygulamayı kullanmak | — | Ücretsiz; hesap, reklam, limit yok |
| Sunucu / backend / veritabanı hizmeti | Hayır | 0 |
| Yapay zekâ / konuşma tanıma API’si | Hayır | 0 (eklenmeyecek) |
| Statik HTTPS barındırma | Telefona kurmak için evet | GitHub Pages veya Cloudflare Pages ücretsiz katman (koşullar README’de; değişebilir) |
| Alan adı | Hayır | 0 (`*.github.io` / `*.pages.dev`) |
| Apple Developer Program | Yalnızca App Store/TestFlight için | Yıllık 99 USD (APPLE_ROADMAP.md) — PWA için gerekmez |
| Geliştirme sırasında Claude kullanımı | — | Uygulamanın çalışma maliyetinden ayrıdır |
