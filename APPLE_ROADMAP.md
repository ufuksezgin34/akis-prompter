# iPhone / iPad geçiş planı

Şu an native iOS projesi **yoktur** ve App Store yayını yapılmamıştır. Bu belge, web çekirdeğini bozmadan Apple tarafına nasıl geçileceğini tanımlar.

## 1. Önce PWA (şimdi kullanılabilir)

- Safari → Paylaş → **Ana Ekrana Ekle**. Standalone açılır, tarayıcı çubukları görünmez, çevrimdışı çalışır (ilk tam yüklemeden sonra).
- Ücretsizdir, onay süreci yoktur, güncelleme anında gelir.
- Sınırlar (iOS Safari/WebKit): Fullscreen API öğe tam ekranı iPhone’da yok (PWA modu alternatiftir); Wake Lock desteği iOS sürümüne bağlı; harici ekran/AirPlay temiz çıkış yok; sistem ses tuşları yakalanamaz; uzun süre açılmayan sitelerin verisi WebKit tarafından silinebilir → düzenli yedek.
- **Gerçek cihaz testi henüz yapılmadı** (TEST_REPORT.md). İlk iş: iPhone ve iPad’de Ana Ekran modunda kabul testlerini elle geçmek.

## 2. Capacitor ile paketleme (web arayüzü korunur)

- Capacitor, mevcut `dist/` çıktısını bir **WKWebView** içinde native uygulama olarak paketler. Arayüz React/HTML olarak kalır; bu **SwiftUI ile yazılmış bir arayüz değildir**.
- Avantaj: tek kod tabanı, mevcut iş mantığı ve testler korunur; gerektiğinde küçük Swift eklentileriyle native API eklenir.
- Hazırlık zaten yapıldı: tarayıcıya özel işlemler `src/platform/` (Wake Lock, tam ekran, klavye) ve `src/storage/` (IndexedDB) altında ayrık. Capacitor sürümünde bunların yerine native adaptörler takılacak.

## 3. Gerektiğinde küçük native adaptörler (Swift)

| İhtiyaç | Web’deki karşılığı | Native plan |
|---|---|---|
| Ekranı açık tutma | `WakeLockAdapter` | `UIApplication.shared.isIdleTimerDisabled` |
| Harici ekran / temiz çıkış | yok (ikinci pencere Faz B) | `UIScene` harici ekran rolü ile ikinci WKWebView/yerel görünüm |
| Kamera kaydı | Faz C `RecordingAdapter` (MediaRecorder) | AVFoundation (`AVCaptureSession`, `AVAssetWriter`) — metin videoya girmez |
| Yerel konuşma tanıma | Faz C `SpeechAdapter` | `SFSpeechRecognizer` + `requiresOnDeviceRecognition` (tr-TR cihaz içi desteği cihazda doğrulanmalı) |
| Dosya paylaşma | indirme bağlantısı | `UIActivityViewController` / Files |
| Bluetooth kumanda | klavye olayları | aynı (HID klavye olarak gelir); gerekirse `UIKeyCommand` |

## 4. WKWebView ≠ Safari

WKWebView davranışı Safari ile otomatik eşit sayılmayacak. Yeniden test edilecekler: kamera/mikrofon izinleri (Info.plist açıklamaları + WebView izin delegesi), getUserMedia/MediaRecorder desteği, service worker (Capacitor’da gerekmez; dosyalar paket içinde), IndexedDB kalıcılığı, klavye olayları, safe-area.

## 5. Veri aktarımı

Native uygulama, Safari’deki PWA’nın IndexedDB verisini **kendiliğinden devralmaz** (farklı depolama alanı). Geçiş yolu: PWA’da **Yedekleme → Yedeği indir**, native uygulamada **Yedekten geri yükle**. Bu nedenle `schemaVersion`’lı JSON yedek formatı korunacak ve geriye dönük okunabilir kalacak.

## 6. Kontrol listesi (native aşamaya geçildiğinde)

- [ ] Mac + güncel Xcode (Mac App Store, ücretsiz)
- [ ] `npm i @capacitor/core @capacitor/ios` + `npx cap add ios` (sürümler o gün doğrulanacak)
- [ ] Bundle ID, ekip seçimi, otomatik imzalama
- [ ] Info.plist: `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription` (yalnızca ilgili özellik eklendiğinde), Türkçe açıklamalar
- [ ] App Privacy (gizlilik bildirimi): veri toplanmıyor, analytics yok — doğrulanarak işaretlenecek
- [ ] Gerçek iPhone ve iPad’de kabul testleri; harici ekran testi
- [ ] Yedekten aktarım testi (PWA → native)

## 7. Ücretsiz test ve ücretli dağıtım ayrımı

Apple’ın resmî sayfalarından 5 Kasım 2026’da kontrol edildi:

- **Ücretsiz:** Xcode ile geliştirme ve **kendi cihazlarınızda test** için üyelik gerekmez (Apple Account ile “Personal Team”). Bu yolla imzalanan uygulamalar kısa süre sonra yeniden imzalanmalıdır (genelde 7 gün; Apple güncel sınırları sayfalarında ayrıntılı vermiyor — Xcode’da doğrulayın). TestFlight ve App Store dağıtımı yoktur.
- **Apple Developer Program:** bireysel üyelik **yıllık 99 USD** (veya yerel para birimindeki karşılığı). TestFlight, App Store Connect ve App Store dağıtımı bu üyelikle gelir. Ücret muafiyeti yalnızca uygun kâr amacı gütmeyen kuruluşlar, akredite eğitim kurumları ve kamu kurumları için başvuruyla mümkündür.
- Dolayısıyla **kalıcı ve ücretsiz App Store dağıtımı vaat edilmez.** Ücretsiz kalıcı yol PWA’dır.

Kaynaklar: [Apple Developer Program — What’s included](https://developer.apple.com/programs/whats-included/), [Programs overview](https://developer.apple.com/help/account/membership/programs-overview)

## 8. Sonraki ürün kararları (ilk native sürümde YOK)

Apple Watch kumandası, gelişmiş harici ekran yönetimi, native kamera kaydı, cihaz içi ses takibi. Her biri ayrı karar ve test turu gerektirir; ilk native sürüm yalnızca PWA’nın yaptığını + ekranı açık tutmayı güvenilir yapmalıdır.
