# ProShare

**Live:** https://proshare.protechnologies.com.tr

[English](#english) · [Türkçe](#türkçe)

## English

Direct file and message sharing between devices. It runs in the browser, with no installation or account required.

Files and messages do not pass through the server. Devices connect to each other directly over encrypted WebRTC; the server only introduces them.

### Two modes, one app

| | Next To | Far Away |
|---|---|---|
| Purpose | Devices on the same network | Devices on different networks |
| Finding a device | List, room code or QR | Typing the other device's name |
| Internet usage | Data stays on the local network | File size, on each device's own connection |

The connection type is monitored continuously. If the devices' network state does not match the selected mode, the app suggests switching; once confirmed, both devices switch together and reconnect.

### Features

- Files, folders and text messages; send screenshots by pasting
- Receiver approval; files are saved only after pressing "İndir" (Download), and multiple files download as a single ZIP
- Large files written directly to disk (in supporting browsers)
- Pause, cancel and resume interrupted transfers
- File integrity check with CRC-32
- 4-digit verification code to compare on both devices
- Optional device password and single-use QR invites
- Offline connection in Next To: the pairing data is carried by QR codes instead of the server
- Read receipts, typing indicator and notifications
- Light and dark themes, installable as an app (PWA)

The interface is in Turkish.

### Running your own server

Requires Node.js.

```bash
npm install
npm start
```

The default address is `http://127.0.0.1:4008`.

| Environment variable | Default | Description |
|---|---|---|
| `PORT` | `4008` | Port to listen on |
| `HOST` | `127.0.0.1` | Address to listen on |
| `BASE_PATH` | `/apps/proshare` | Additional sub-path the app is served from |

App installation, camera access and writing to disk require a secure context in the browser, so anything other than `localhost` should run behind HTTPS.

| Path | Content |
|---|---|
| `/` | Start screen and Next To |
| `/faraway/` | Far Away |
| `/demo/` | Demo version |
| `/healthz` | Health check |

### Limitations

- Far Away only uses direct connections; there is no relay (TURN) server. Connections may fail on some corporate networks and mobile carriers that do not allow direct connections.
- For offline connections, both devices must be on the same Wi-Fi or hotspot, the page must have been opened once before, and both devices need a camera to scan the codes.

### License

[MIT](LICENSE). The QR reader uses [jsQR](https://github.com/cozmo/jsQR), licensed under Apache-2.0; see [jsQR.LICENSE](jsQR.LICENSE).

---

## Türkçe

Cihazlar arasında doğrudan dosya ve mesaj paylaşımı. Kurulum ya da hesap gerektirmez, tarayıcıda çalışır.

Dosyalar ve mesajlar sunucudan geçmez. Cihazlar WebRTC ile birbirine doğrudan ve şifreli bağlanır; sunucu yalnızca cihazları tanıştırır.

### İki bölüm, tek uygulama

| | Next To | Far Away |
|---|---|---|
| Ne için | Aynı ağdaki cihazlar | Farklı ağlardaki cihazlar |
| Cihazı bulma | Liste, oda kodu ya da QR | Karşı cihazın adını yazarak |
| İnternet kullanımı | Veri yerel ağda kalır | Dosya boyutu kadar, iki cihazın kendi interneti |

Bağlantı türü sürekli izlenir. Cihazların ağ durumu seçili bölümle uyuşmazsa diğer bölüme geçmek önerilir; onaylanınca iki cihaz birlikte geçer ve yeniden bağlanır.

### Özellikler

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

### Kendi sunucunda çalıştırma

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

### Sınırlar

- Far Away yalnızca doğrudan bağlantı kullanır, aktarma (TURN) sunucusu yoktur. Doğrudan bağlantıya izin vermeyen bazı şirket ağlarında ve mobil operatörlerde bağlantı kurulamayabilir.
- İnternetsiz bağlanmada iki cihaz aynı Wi-Fi'da ya da hotspot'ta olmalı, sayfa daha önce bir kez açılmış olmalı ve kod okutmak için iki cihazda da kamera bulunmalıdır.

### Lisans

[MIT](LICENSE). QR okuyucu olarak Apache-2.0 lisanslı [jsQR](https://github.com/cozmo/jsQR) kullanılır; lisansı [jsQR.LICENSE](jsQR.LICENSE) dosyasındadır.
