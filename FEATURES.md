# Özellik durumu

Etiketler: ✅ tamamlandı · 🧪 deneysel · ⏳ ertelendi · 🚫 platformda desteklenmiyor

## Faz A — Zorunlu çekirdek

| Özellik | Durum | Not |
|---|---|---|
| Metin kütüphanesi: yeni, ad, çoğalt, arama (Türkçe I/ı İ/i duyarlı), sıralama, favori, etiket, proje/klasör, çöp kutusu, kalıcı silme | ✅ | Arama başlık, etiket ve içerikte |
| Oluşturma/güncelleme tarihi, kelime sayısı, tahmini süre, son okunan konum | ✅ | Süre: profilde ölçülmüş hız yoksa 140 kelime/dk **varsayılan tahmin** |
| Blok editörü: başlık / konuşma / yönetmen notu | ✅ | Notlar süreye sayılmaz |
| Uzun metin yapıştırma, geri al/ileri al, bul/değiştir (Türkçe duyarsız), blok bölme/birleştirme/taşıma | ✅ | Ctrl/⌘+Enter böl, satır başında Backspace birleştir |
| Sınırlı biçim: kalın, vurgu rengi | ✅ | `**…**`, `==…==`; HTML hiç yorumlanmaz |
| Köşeli parantez notlarını açık seçimle nota çevirme | ✅ | Otomatik dönüştürme yok |
| Zaman kodu temizleme (önizleme + geri al) | ✅ | Yalnızca satır başı kodlar |
| Unicode/emoji/akıllı tırnak koruma, Intl.Segmenter + fallback | ✅ | Dr., vb., ondalık, üç nokta testli |
| Yerel sürümler (toplu değişiklik ve çekim başlangıcı öncesi, en fazla 15) | ✅ | Geri yüklemeden önce mevcut hâl de saklanır |
| Otomatik kayıt (600 ms), görünürlük/pagehide’da flush, durum: Kaydediliyor/Kaydedildi/Kaydedilemedi | ✅ | Hata: metin bellekte kalır + “Dosya olarak indir” |
| Çoklu sekme revizyon/çakışma denetimi | ✅ | Kopya kaydet / diğerini yükle / üzerine yaz |
| Kaydırma motoru: rAF + monoton zaman, alt piksel transform, idle/countdown/playing/paused/finished | ✅ | React’ten bağımsız; tek döngü garantisi |
| Kare hızından bağımsız gerçek hız (60/90/120 Hz) | ✅ | Birim testte doğrulandı; gerçek 90/120 Hz ekranda ölçülmedi |
| px/s hız + ayrı “≈ kelime/dk (tahmini)” | ✅ | |
| Hedef süre modu | ✅ | Kalan mesafeye göre; yerleşim değişince yeniden hesaplanır; elle hız değişince kapanır ve bildirilir |
| Arka plana geçince duraklat, dönüşte otomatik başlamama | ✅ | Ayardan kapatılabilir |
| Elle sürükleme/tekerlek akışı duraklatır | ✅ | Dokunma yalnızca kontrolleri gösterir |
| Yazı/pencere/yön değişiminde okuma yerini koruma | ✅ | Blok + blok içi cümle + cümle içi oran |
| Okuma ekranı ayarları (boyut 18–160, kalınlık, satır 1.1–2.5, paragraf, hizalama, renkler, sütun, boşluklar) | ✅ | Anında önizleme, varsayılana dön |
| Kameraya yakın dar sütun + kamera konumu seçimi | ✅ | Konum kullanıcı seçer; uygulama bilmez |
| Yatay ayna, dikey ters, ikisi birden — yalnızca metin katmanı | ✅ | |
| Okuma çizgisi/oku, odak bandı, bant dışı karartma | ✅ | |
| Okuma çizgisindeki cümle vurgusu (gerçek yerleşime göre) | ✅ | Söylenen kelimeyi bildiği iddiası yok |
| Kontrollerin oynatmada gizlenmesi | ✅ | |
| Tam ekran (destek varsa) / PWA alternatifi önerisi | ✅ | iPhone Safari’de öğe tam ekranı yok → Ana Ekrana Ekle önerilir |
| Göstergeler (geçen süre, ≈ kalan süre, ilerleme, durum) ayrı ayrı gizlenebilir | ✅ | |
| Başlangıç sayacı kapalı/3/5/10, iptal edilebilir | ✅ | |
| Metin sonu: son satır çizgiyi geçince “Bitti”, baştan başlat, döngü | ✅ | |
| Ekran kilidi (uzun basma 1 sn; klavyede iki aşamalı onay) | ✅ | Kumanda/pedal tuşları kilitliyken de çalışır |
| Klavye kısayolları + değiştirilebilir eşleme + tuş test alanı | ✅ | Yazı alanlarında devre dışı |
| Profiller (5 başlangıç önerisi), çoğalt/adlandır/sil/düzenle | ✅ | |
| JSON tam yedek / doğrulama / önizleme / birleştir-değiştir / çakışma politikası | ✅ | Tek transaction; hata olursa hiçbir şey yazılmaz |
| TXT ve Markdown içe/dışa aktarma | ✅ | İkili dosya NUL bayt denetimiyle reddedilir; 8 MB sınır |
| Kalıcı depolama isteği + kullanım bilgisi | ✅ | Garanti edilmez, açıkça söylenir |
| PWA: manifest, ikonlar, standalone, offline kabuk, güncelleme isteği | ✅ | Güncelleme okuma ekranında gösterilmez, kendiliğinden yenileme yok |
| Screen Wake Lock (destek kontrolü, durum, yeniden isteme) | ✅ | Desteklenmiyorsa manuel ayar önerisi |
| İlk kullanım 3 adımlı, atlanabilir rehber | ✅ | |
| Editör açık/koyu/sistem teması | ✅ | |

## Faz B — Çekim iş akışı

| Özellik | Durum | Not |
|---|---|---|
| Önceki/sonraki cümle, önceki/sonraki bölüm | ✅ | |
| Tekrar al (mevcut cümleye dön + 3 sn + başlat) | ✅ | “Önceki cümleye dön” seçeneği motor/düzende var; arayüz ayarı ⏳ |
| −5 sn (gerçek hareket geçmişi; yoksa cümle geri ve bunu bildirir) | ✅ | |
| Prova hızı ölçümü → profilde kişisel kelime/dk | ✅ | Yaklaşık değer olarak etiketli |
| Yer işaretleri | ⏳ | |
| Seçili bölüm için başlangıç/bitiş + beklemeli döngü | ⏳ | |
| Çekim listesi (ekle, sırala, tamamlandı) | ⏳ | Veritabanı deposu (`setlists`) ve yedek kapsamı hazır, arayüz yok |
| Take numarası/not/iyi take | ⏳ | Depo (`takes`) ve yedek kapsamı hazır, arayüz yok |
| İkinci pencere / harici ekran temiz çıktı (BroadcastChannel) | ⏳ | |
| DOCX düz metin içe aktarma | ⏳ | |
| PDF metin katmanı içe aktarma | ⏳ | Taranmış PDF / OCR: 🚫 (ücretli OCR eklenmeyecek) |

## Faz C — Gelişmiş web

| Özellik | Durum |
|---|---|
| Kamera kaydı (getUserMedia + MediaRecorder) | ⏳ |
| Deneysel sesle takip | ⏳ |
| Başka telefondan kumanda (WebRTC/yerel yardımcı) | ⏳ |

## Faz D — Apple

| Özellik | Durum |
|---|---|
| APPLE_ROADMAP.md | ✅ (plan) |
| Native adaptörler | ⏳ |

## Web’de desteklenmeyen / garanti edilmeyen

- 🚫 Harici ekranı otomatik bulma, AirPlay temiz çıkış, diğer uygulamaların üstünde yüzen pencere, sistem ses tuşlarını yakalama.
- 🚫 Ekranın açık kalması Wake Lock desteklenmiyorsa garanti edilemez.
- 🚫 Tarayıcı verisinin hiç silinmeyeceği garanti edilemez (kalıcı depolama isteği riski azaltır).
- 🚫 Yön kilidi her tarayıcıda zorlanamaz; düzen dikey ve yatayda çalışacak şekilde tasarlandı.
- 🚫 Cihazlar arası otomatik eşitleme yok (bilinçli olarak sunucusuz).
