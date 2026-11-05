# İlerleme — 5 Kasım 2026

## Tamamlanan

- **Faz A — zorunlu çekirdek: tamamlandı.** Ayrıntı FEATURES.md.
- Faz B’den: cümle/bölüm gezinme, tekrar al, −5 sn (gerçek geçmiş), prova hızı ölçümü.
- Dokümanlar: README, FEATURES, TEST_REPORT, DATA, LICENSES, APPLE_ROADMAP.
- Testler: 38 birim/entegrasyon + 21 Playwright (Chrome masaüstü + mobil emülasyon), hepsi geçiyor.

## Çalışan komutlar

```bash
npm ci
npm run typecheck && npm run lint && npm test
npm run test:e2e        # derler + Playwright; Chrome yolu: CHROME_PATH (varsayılan /usr/bin/google-chrome)
npm run dev             # geliştirme
npm run build && npm run preview
```

## Kod haritası

- `src/model/` — tipler, metin işleme (cümle/kelime, Türkçe arama, zaman kodu, içe/dışa aktarma), satır içi biçim, bul/değiştir
- `src/storage/` — IndexedDB şeması (`db.ts`), depo işlemleri + revizyon + BroadcastChannel (`repo.ts`)
- `src/playback/` — `engine.ts` (kaydırma motoru, React’ten bağımsız), `layout.ts` (ölçüm, çapa, cümle/bölüm konumları), `Reader.tsx`, `ReaderText.tsx`, `ReaderSettingsPanel.tsx`
- `src/editor/` — editör, otomatik kayıt, geçmiş
- `src/library/` — kütüphane, örnek metinler
- `src/profiles/` — varsayılanlar, Ayarlar sayfası (profiller, tuş eşleme, kurulum)
- `src/backup/` — JSON yedek doğrulama/uygulama, Yedekleme sayfası
- `src/platform/` — Wake Lock, tam ekran, klavye
- `e2e/` — Playwright testleri

## Eksikler (öncelik sırasıyla)

1. **Faz B — ikinci pencere / harici ekran:** `src/remote/secondWindow.ts` — `window.open('#/output/<id>')`, BroadcastChannel `akis-output`; okuma penceresi otorite; mesaj: `{seq, anchor: ReadingAnchor, state, speed, settingsHash}`; çıktı penceresi kendi motorunu çalıştırır, her snapshot’ta çapaya hizalanır; popup engeli ve pencere kapanma durumu; e2e kabul #12.
2. Faz B — çekim listesi arayüzü (depo `setlists` hazır), take notları (depo `takes` hazır, video olmadığı açıkça yazılacak).
3. Faz B — yer işaretleri (bloğa `bookmark` alanı veya ayrı liste), seçili bölüm prova döngüsü, “tekrar al” geri dönüş ayarı (`prevSentenceOffset(..., 'previous')` hazır).
4. Faz B — DOCX düz metin (lazy `mammoth` veya JSZip ile `word/document.xml` okuma; açılmış boyut sınırı) ve PDF metin katmanı (lazy pdf.js; sıralama önizlemesi).
5. Faz C — kamera kaydı, deneysel ses takibi, ikinci cihaz kumandası (WebRTC manuel offer/answer veya yerel yardımcı).
6. Gerçek cihaz testleri: iPhone/iPad Safari (Ana Ekran), Safari macOS, Bluetooth kumanda.

## Sonraki somut görev

Madde 1: ikinci pencere çıktısı. Önce `src/remote/protocol.ts` (mesaj tipleri + sıra numarası + yinelenen yok sayma) ve birim testleri, sonra `#/output/:id` rotası (yalnız metin katmanı, kontrolsüz), sonra Reader’a “İkinci pencere aç” düğmesi.
