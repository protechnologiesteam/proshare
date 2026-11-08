# ProShare

Cihazlar arasında doğrudan dosya ve mesaj paylaşımı. Kurulum ya da hesap gerektirmez, tarayıcıda çalışır.

**Canlı sürüm:** https://proshare.protechnologies.com.tr

Dosyalar ve mesajlar sunucudan geçmez. Cihazlar WebRTC ile birbirine doğrudan ve şifreli bağlanır; sunucu yalnızca cihazları tanıştırır.

## İki bölüm, tek uygulama

| | Next To | Far Away |
|---|---|---|
| Ne için | Aynı ağdaki cihazlar | Farklı ağlardaki cihazlar |
| Cihazı bulma | Liste, oda kodu ya da QR | Karşı cihazın adını yazarak |
| İnternet kullanımı | Veri yerel ağda kalır | Dosya boyutu kadar, iki cihazın kendi interneti |

Bağlantı türü sürekli izlenir. Cihazların ağ durumu seçili bölümle uyuşmazsa diğer bölüme geçmek önerilir; onaylanınca iki cihaz birlikte geçer ve yeniden bağlanır.

## Özellikler

- Dosya, klasör ve metin mesajı; ekran görüntüsünü yapıştırarak gönderme
- Alıcı onayı; dosyalar ancak "İndir" denince kaydedilir, birden çok dosya tek ZIP olarak iner
- Büyük dosyaları doğrudan diske yazma (destekleyen tarayıcılarda)
- Duraklatma, iptal ve kopan aktarımı sürdürme
- CRC-32 ile dosya bütünlüğü kontrolü
- İki cihazda karşılaştırılabilen 4 haneli doğrulama kodu
- İsteğe bağlı cihaz şifresi ve QR ile tek kullanımlık davet
- Next To'da internetsiz bağlanma: tanışma bilgisi sunucu yerine QR koduyla taşınır
- Okundu bilgisi, yazıyor göstergesi, bildirimler
- Açık ve koyu tema, uygulama olarak yüklenebilir (PWA)

## Kendi sunucunda çalıştırma

Node.js gerekir.

```bash
npm install
npm start
```

Varsayılan adres `http://127.0.0.1:4008` olur.

| Ortam değişkeni | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | `4008` | Dinlenecek port |
| `HOST` | `127.0.0.1` | Dinlenecek adres |
| `BASE_PATH` | `/apps/proshare` | Uygulamanın ek olarak sunulduğu alt yol |

Uygulama yükleme, kamera ve diske yazma özellikleri tarayıcıda güvenli bağlantı ister. Bu yüzden `localhost` dışında HTTPS arkasında çalıştırılmalıdır.

| Yol | İçerik |
|---|---|
| `/` | Açılış ekranı ve Next To |
| `/faraway/` | Far Away |
| `/demo/` | Deneme sürümü |
| `/healthz` | Sağlık kontrolü |

## Sınırlar

- Far Away yalnızca doğrudan bağlantı kullanır, aktarma (TURN) sunucusu yoktur. Doğrudan bağlantıya izin vermeyen bazı şirket ağlarında ve mobil operatörlerde bağlantı kurulamayabilir.
- İnternetsiz bağlanmada iki cihaz aynı Wi-Fi'da ya da hotspot'ta olmalı, sayfa daha önce bir kez açılmış olmalı ve kod okutmak için iki cihazda da kamera bulunmalıdır.

## Lisans

[MIT](LICENSE). QR okuyucu olarak Apache-2.0 lisanslı [jsQR](https://github.com/cozmo/jsQR) kullanılır; lisansı [jsQR.LICENSE](jsQR.LICENSE) dosyasındadır.
