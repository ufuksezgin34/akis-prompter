# Veri, saklama ve yedekleme

## Nerede saklanır?

Tüm veriler **yalnızca bu tarayıcıda/cihazda**, IndexedDB veritabanı `akis-prompter` (şema sürümü 1) içinde durur. Sunucuya, buluta veya üçüncü tarafa hiçbir şey gönderilmez; analytics yoktur. localStorage kullanılmaz.

| Depo | İçerik |
|---|---|
| `scripts` | Metinler: başlık, bloklar (`heading` / `speech` / `note`), etiketler, proje, favori, tarihler, `revision`, çöp kutusu zamanı, son okuma konumu, en fazla 15 yerel sürüm |
| `profiles` | Okuma profilleri ve ayarları (kişisel ölçülmüş kelime/dk dahil) |
| `meta` | Uygulama ayarları: etkin profil, tuş eşlemesi, editör teması, rehber durumu |
| `setlists`, `takes` | Çekim listeleri ve take notları (Faz B arayüzü için hazır; şimdilik boş) |

Metin modeli düz metindir; biçim yalnızca `**kalın**` ve `==vurgu==` işaretleriyle tutulur. HTML saklanmaz ve çalıştırılmaz.

## Kayıt güvenliği

- Her düzenleme 600 ms sonra otomatik kaydedilir; sekme gizlenirken / sayfa kapanırken bekleyen kayıt hemen başlatılır.
- Kayıt başarısız olursa metin ekranda kalır, “Kaydedilemedi” uyarısı ve **Dosya olarak indir** düğmesi çıkar.
- Her metnin `revision` sayacı vardır. Başka sekmede daha yeni sürüm kaydedildiyse eski sekme onu ezmez; kullanıcıya seçim sunulur.
- Bul/değiştir, zaman kodu temizliği, yapıştırarak değiştirme, sürüm geri yükleme ve her okuma oturumunun ilk oynatması öncesinde yerel sürüm alınır.
- Şema göçleri IndexedDB `versionchange` transaction’ında yapılır; yarıda kalırsa geri alınır.

## Tarayıcı verisi silinebilir

Tarayıcılar disk dolunca veya site uzun süre kullanılmayınca (özellikle Safari) site verisini silebilir. **Yedekleme → Kalıcı depolama iste** bu riski azaltır ama garanti etmez. Düzenli JSON yedek alın.

## JSON tam yedek

```json
{ "app": "akis-prompter", "schemaVersion": 1, "exportedAt": "…",
  "scripts": [...], "profiles": [...], "setlists": [...], "takes": [...] }
```

- **Kapsam:** metinler (bloklar, etiketler, sürümler, son konum), profiller, çekim listeleri, take notları. **Video kayıtları dahil değildir** (kayıt özelliği eklendiğinde ayrı dosya olarak indirilecek).
- **Yükleme öncesi:** boyut (≤ 50 MB), JSON geçerliliği, `app` alanı, şema sürümü (daha yeni sürüm reddedilir), her metin/blok tek tek doğrulanır; geçersizler uyarıyla atlanır. Önizleme gösterilir, veritabanına henüz yazılmaz.
- **Birleştir:** aynı kimlikli metin farklıysa → kopya ekle (varsayılan) / atla / üzerine yaz. Aynıysa atlanır.
- **Tümünü değiştir:** önce “Önce mevcut verileri yedekle” fırsatı sunulur.
- Tüm içe aktarma tek transaction’dır; hata olursa hiçbir şey değişmez.

## Cihazlar arası aktarım

Otomatik eşitleme yoktur. Yol: bir cihazda **Yedeği indir** (veya metni TXT/Markdown indir) → dosyayı diğer cihaza gönder (AirDrop, e-posta, bulut klasörü) → **Yedekten geri yükle** / **İçe aktar**.
