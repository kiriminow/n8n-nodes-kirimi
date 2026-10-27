# Kirimi Trigger Node - Panduan Penggunaan

Node trigger untuk menangkap webhook dari Kirimi WhatsApp API.

## Cara Install

Dalam n8n instance Anda:

1. Buka **Settings** > **Community Nodes**
2. Klik **Install**
3. Masukkan: `n8n-nodes-kirimi`
4. Klik **Install**

## Mode Registrasi

Parameter **Registration** punya dua mode:

| Mode | Cara kerja | Retry |
|---|---|---|
| **Manual (default)** | Salin URL webhook n8n ke dashboard Kirimi sendiri | Server retry sampai 7x selama sekitar 5 jam |
| **Automatic (Recommended)** | Node mendaftar lewat API Kirimi saat workflow diaktifkan dan menghapusnya saat dinonaktifkan | Server retry sampai 7x selama sekitar 5 jam (event id sama, otomatis di-dedupe node) |

Workflow lama otomatis memakai mode Manual (perilaku tidak berubah).

### Mode Automatic

1. Pilih **Registration = Automatic**, pilih kredensial Kirimi API.
2. Pilih **Scope** (`Device (QR)` atau `WABA`), isi Device ID / WABA ID, pilih 1-20 events.
3. Aktifkan workflow. Node memanggil `/v1/webhook/subscribe` dengan URL webhook n8n dan menyimpan `secret`.
4. URL webhook **wajib https**. Jika n8n Anda memakai http, gunakan mode Manual atau set `WEBHOOK_URL` ke https.
5. Mengubah URL, scope, atau events akan mengganti subscription secara otomatis saat workflow diaktifkan ulang.
6. **Pindah dari Manual ke Automatic?** Hapus URL webhook node ini dari dashboard Kirimi. URL produksinya tetap sama, jadi kiriman dashboard (tanpa signature subscription) akan ditolak 401 lalu di-retry dan memicu email "webhook gagal".

Verifikasi signature (otomatis di node, request tidak valid dijawab 401):

- Header `x-kirimi-signature: sha256=<hex>` dan `x-kirimi-timestamp: <unix detik>`
- `hex(HMAC-SHA256(key = secret, message = "<timestamp>.<raw body>"))`
- Timestamp lebih dari 300 detik dari waktu sekarang ditolak

Di kedua mode, event duplikat (id yang sama, 200 id terakhir) diabaikan. Penyimpanan id hanya bertahan
untuk workflow yang aktif (production).

## Cara Setup Webhook (Mode Manual)

### 1. Tambahkan Kirimi Trigger Node ke Workflow

1. Buat workflow baru atau buka workflow yang ada
2. Klik **Add Node** (+)
3. Cari "Kirimi Trigger"
4. Tambahkan node ke canvas

### 2. Pilih Events yang Ingin Ditangkap

Di node configuration, pilih event-event yang ingin Anda tangkap:

#### Event Device (23):

`message`, `message.outgoing`, `message.history`, `message.sent`, `message.failed`, `message.ack`,
`message.reaction`, `message.deleted`, `message.edited`, `connection.connected`, `connection.disconnected`,
`logged_out`, `qr`, `group.join`, `group.leave`, `group.update`, `presence.update`, `call.offer`,
`device.created`, `device.connected`, `device.status_changed`, `device.last_active`, `device.reconnected`

#### Event WABA (10):

`message`, `message.sent`, `message.ack`, `message.failed`, `template.status_update`,
`template.quality_update`, `account.review_update`, `account.alerts`, `account.banned`,
`phone_number.quality_update`

Catatan:
- `message.ack` hanya dikirim untuk WABA, **tidak** dikirim untuk device QR.
- `presence.update` belum dikirim oleh server (belum delivered).
- Di mode Manual, daftar event adalah gabungan; event khusus WABA diberi label "(WABA)".
- Maksimal 20 events per subscription (mode Automatic).

### 3. Konfigurasi Filter (Opsional)

#### Device ID Filter
Filter hanya untuk device tertentu. Kosongkan untuk semua device. Untuk event WABA, nilainya adalah `phone_number_id`.
```
Contoh: D-2J3IG
```

#### Filter From Me (untuk event Message)
Centang untuk menyaring pesan yang dikirim sendiri (isFromMe=true).

#### Filter Groups (untuk event Message)
- **All Messages** - Terima semua pesan (group & individual)
- **Only Groups** - Hanya pesan dari group
- **Only Individual** - Hanya pesan private/individual

#### Message Type Filter (untuk event Message)
Pilih tipe pesan yang ingin diterima:
- Text
- Image
- Video
- Audio
- Document
- Sticker
- Location
- Contact

Kosongkan untuk menerima semua tipe.

### 4. Dapatkan Webhook URL

1. Activate workflow Anda
2. Klik pada Kirimi Trigger node
3. Klik **Copy** pada **Production URL**
4. URL akan terlihat seperti: `https://your-n8n.com/webhook/abc123`

### 5. Set Webhook URL di Dashboard Kirimi

1. Login ke [dash.kirimi.id](https://dash.kirimi.id)
2. Buka menu **Device Whatsapp**
3. Pilih device yang ingin Anda set webhook
4. Paste webhook URL dari n8n di **Webhook Outgoing**
5. Klik **Save**

## Contoh Data Output

Setiap payload memakai envelope dengan field `id` (event id unik), `created_at` (ISO-8601 dengan offset
`+07:00`) dan `datetime_wib`. Node menambahkan `eventId` (sama dengan `id`) dan `receivedAt`.

### Pesan Masuk (Message Event)

```json
{
  "id": "8f14e45f-ceea-4d1a-9a1e-2f5c6b7d8e90",
  "created_at": "2025-11-19T20:15:07.000+07:00",
  "datetime_wib": "2025-11-19 20:15:07",
  "event": "message",
  "deviceId": "D-2J3IG",
  "msgId": "3EB03F895D0BA042B04A69",
  "from": "6282171836262",
  "name": "yolk",
  "message": "test webhook",
  "isFromGroup": false,
  "isFromMe": false,
  "messageType": "text",
  "mediaUrl": "",
  "eventId": "8f14e45f-ceea-4d1a-9a1e-2f5c6b7d8e90",
  "receivedAt": "2025-11-19T13:15:07.123Z"
}
```

### Pesan dengan Media

```json
{
  "event": "message",
  "deviceId": "D-2J3IG",
  "msgId": "3EB03F895D0BA042B05C78",
  "from": "6281234567890",
  "name": "John Doe",
  "message": "Check this out!",
  "isFromGroup": false,
  "isFromMe": false,
  "messageType": "image",
  "mediaUrl": "https://mmg.whatsapp.net/xxxxx",
  "caption": "Check this out!",
  "receivedAt": "2025-11-19T13:15:07.123Z"
}
```

### Connection Event

```json
{
  "event": "connection.connected",
  "deviceId": "D-2J3IG",
  "status": "connected",
  "message": "Device berhasil terhubung",
  "receivedAt": "2025-11-19T13:15:07.123Z"
}
```

## Contoh Workflow

### Auto-Reply Simple

1. **Kirimi Trigger** - Filter hanya event "Message", filter out "From Me"
2. **Function Node** - Buat pesan reply
3. **Kirimi Node** - Send Message

### Save Pesan ke Database

1. **Kirimi Trigger** - Event "Message"
2. **Postgres Node** - Insert data ke database

### Notifikasi ke Slack saat Device Disconnect

1. **Kirimi Trigger** - Event "Connection Disconnected"
2. **Slack Node** - Send notification

## Tips & Best Practices

### 1. Gunakan Filter yang Tepat
Untuk performa optimal, gunakan filter untuk mengurangi jumlah webhook yang diproses.

**Contoh:** Jika hanya ingin auto-reply pesan text:
- Events: `[Message]`
- Filter From Me: ✅ 
- Message Type Filter: `[text]`

### 2. Handle Error dengan Baik
Tambahkan error handling node untuk menangani kasus-kasus error:
- Device offline
- Invalid data format
- Rate limiting

### 3. Gunakan Condition Node
Gunakan IF/Switch node untuk routing berdasarkan:
- Message content
- Sender number
- Message type
- etc

### 4. Testing
Sebelum production:
1. Test dengan mengirim pesan test
2. Cek webhook logs di n8n
3. Verifikasi data yang diterima

### 5. Security
- Jangan expose webhook URL di public
- Gunakan webhook authentication jika tersedia
- Monitor suspicious activities

## Troubleshooting

### Webhook tidak menerima data

**Cek:**
1. ✅ Workflow sudah active
2. ✅ Webhook URL sudah benar di dashboard Kirimi
3. ✅ Events sudah dipilih di Kirimi dashboard
4. ✅ Filter tidak terlalu ketat (coba hapus semua filter)

### Data tidak sesuai harapan

**Cek:**
1. Filter settings di node
2. Event type yang dipilih
3. Logs di n8n execution history

### Webhook timeout

Kirimi webhook memiliki timeout **10 detik**. Pastikan:
1. Workflow tidak terlalu kompleks
2. External API calls cepat
3. Gunakan async operations jika perlu

## Event Defaults di Kirimi

Event yang **aktif** secara default di Kirimi:
- ✅ message
- ✅ message.sent
- ✅ message.failed
- ✅ message.ack
- ✅ connection.connected
- ✅ connection.disconnected
- ✅ logged_out

Event yang **non-aktif** secara default (perlu diaktifkan manual):
- ❌ qr
- ❌ group.join
- ❌ group.update
- ❌ presence.update
- ❌ call.offer

## Support

Untuk pertanyaan atau issue:
- GitHub: [kiriminow/n8n-nodes-kirimi](https://github.com/kiriminow/n8n-nodes-kirimi)
- Email: support@kirimi.id
- Dokumentasi Kirimi: [docs.kirimi.id](https://docs.kirimi.id)

## Reference

Lihat [webhook.md](./webhook.md) untuk dokumentasi lengkap format JSON webhook Kirimi.
