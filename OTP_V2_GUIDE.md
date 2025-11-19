# OTP V2 - Panduan Lengkap

## Overview

OTP V2 adalah versi terbaru dari Kirimi OTP API yang menawarkan fitur lebih lengkap dan reliable dibandingkan V1.

### Keunggulan OTP V2

- ✅ **Database Persistent**: Setiap OTP tersimpan di database dengan tracking lengkap
- ✅ **Dual Method**: Pilihan antara WABA (Central Kirimi) atau Device (Device sendiri)
- ✅ **Cost Tracking**: Pelacakan biaya otomatis per transaksi
- ✅ **Better Security**: Enkripsi, rate limiting, dan monitoring terintegrasi
- ✅ **Verification Attempts**: Maksimal 3 percobaan verifikasi dengan auto-expire

### Perbandingan Method

| Feature | WABA Method | Device Method |
|---------|-------------|---------------|
| **Provider** | Central Kirimi WABA | Device milik user |
| **Biaya** | Rp 400/OTP (auto-deduct dari balance) | Gratis (pakai quota device) |
| **Template** | WhatsApp approved templates | Fully customizable |
| **Setup** | Tidak perlu (ready to use) | Perlu device aktif |
| **Kecepatan** | Sangat cepat (~1-2 detik) | Normal (~2-5 detik) |
| **Reliability** | Sangat tinggi (99.9%) | Tergantung koneksi device |
| **Use Case** | Production/High volume | Testing/Custom branding |

---

## Cara Menggunakan di n8n

### 1. Send OTP V2

#### A. Menggunakan WABA Method (Recommended untuk Production)

**Node Configuration:**

1. **Resource**: OTP
2. **Operation**: Send OTP V2 (Recommended)
3. **Phone Number (V2)**: `628123456789` (atau gunakan dynamic expression dari previous node)
4. **Send Method**: WABA (Central) - Rp 400/OTP
5. **App Name** (optional): `"MyApp"` (akan muncul di pesan OTP)
6. **Template Code** (optional): Kosongkan untuk template default

**Output Example:**
```json
{
  "success": true,
  "data": {
    "otp_id": "550e8400-e29b-41d4-a716-446655440000",
    "phone": "62812***",
    "method": "waba",
    "cost": 400,
    "expires_in": 5,
    "message": "OTP sent successfully"
  }
}
```

**Catatan:**
- Balance akan otomatis dikurangi Rp 400
- OTP dikirim via WhatsApp Business API resmi
- Response time sangat cepat (~1-2 detik)

#### B. Menggunakan Device Method (Free, Customizable)

**Node Configuration:**

1. **Resource**: OTP
2. **Operation**: Send OTP V2 (Recommended)
3. **Phone Number (V2)**: `628123456789`
4. **Send Method**: Device (Own Device) - Free
5. **App Name** (optional): `"MyApp"`
6. **Device ID (for Device Method)**: `D-XXXXX` (masukkan device ID Anda)
7. **Custom Message**: 
```
🔐 Kode OTP {{app_name}}

Kode verifikasi Anda: {{otp}}

Berlaku 5 menit. Jangan bagikan!
```

**Output Example:**
```json
{
  "success": true,
  "data": {
    "otp_id": "550e8400-e29b-41d4-a716-446655440000",
    "phone": "62812***",
    "method": "device",
    "cost": 0,
    "expires_in": 5,
    "message": "OTP sent successfully",
    "device_id": "D-XXXXX"
  }
}
```

**Catatan:**
- Gratis (tidak dikenakan biaya)
- Menggunakan quota device
- Pesan bisa fully customizable
- Device harus dalam status connected

### 2. Verify OTP V2

**Node Configuration:**

1. **Resource**: OTP
2. **Operation**: Verify OTP V2 (Recommended)
3. **Phone Number (V2)**: `628123456789` (nomor yang sama dengan saat send)
4. **OTP Code (V2)**: `123456` (6 digit code dari user)

**Output Success:**
```json
{
  "success": true,
  "data": {
    "verified": true,
    "phone": "62812***",
    "verified_at": "2025-11-19T10:30:00.000Z"
  }
}
```

**Output Error (Wrong Code):**
```json
{
  "success": false,
  "message": "Invalid OTP code. 2 attempts remaining.",
  "attempts_left": 2
}
```

**Catatan:**
- Maksimal 3 percobaan verifikasi
- OTP expired setelah 5 menit
- Setelah 3 failed attempts, OTP tidak bisa digunakan lagi

---

## Workflow Examples

### Example 1: Registration Flow dengan WABA

**Workflow:**
```
1. HTTP Request (Get user phone from form)
2. Kirimi - Send OTP V2 (WABA method)
3. Function - Save OTP ID to database
4. Response - Send success message to user
5. [User enters OTP]
6. HTTP Request (Get OTP code from user)
7. Kirimi - Verify OTP V2
8. IF Node - Check if verified
   - TRUE: Create user account
   - FALSE: Show error message
```

### Example 2: Login Verification dengan Device Method

**Workflow:**
```
1. Trigger: Webhook (Login form submission)
2. Postgres - Check if user exists
3. IF - User exists?
   - YES: 
     4a. Kirimi - Send OTP V2 (Device method, custom message)
     5a. Response - Continue to OTP page
   - NO:
     4b. Response - User not found error
```

### Example 3: Phone Verification di Checkout

**Workflow:**
```
1. Trigger: Webhook (Checkout form)
2. Function - Extract phone number
3. Kirimi - Send OTP V2 (WABA for reliability)
4. Set Node - Store order_id + phone
5. Wait - For OTP verification webhook
6. Kirimi - Verify OTP V2
7. IF - Verified?
   - TRUE: Process payment
   - FALSE: Cancel order
```

---

## Custom Message Guidelines (Device Method)

### Template Variables

- `{{otp}}` - **WAJIB**, akan diganti dengan OTP code
- `{{app_name}}` - Optional, akan diganti dengan parameter app_name

### Good Examples

```
✅ BAGUS - Clear dan professional
🔐 Kode OTP {{app_name}}

Kode verifikasi Anda: {{otp}}

Berlaku 5 menit.
Jangan bagikan kode ini!

_Powered by Kirimi_
```

```
✅ BAGUS - Simple dan jelas
Halo! Kode OTP Anda untuk {{app_name}} adalah:

{{otp}}

Kode berlaku 5 menit. Demi keamanan, jangan berikan kode ini ke siapapun.
```

### Bad Examples

```
❌ BURUK - Missing {{otp}} placeholder
Kode verifikasi Anda telah dikirim
```

```
❌ BURUK - Too short
OTP: {{otp}}
```

```
❌ BURUK - Contains blacklisted words
SELAMAT! Anda menang hadiah! 
Kode: {{otp}}
```

---

## Error Handling

### Common Errors

#### 1. Insufficient Balance (WABA Method)
```json
{
  "success": false,
  "message": "Insufficient balance. Please top up."
}
```

**Solution**: Top up balance minimal Rp 400

#### 2. Device Not Connected (Device Method)
```json
{
  "success": false,
  "message": "Device offline"
}
```

**Solution**: Pastikan device dalam status connected

#### 3. Missing {{otp}} Placeholder
```json
{
  "success": false,
  "message": "Custom message must contain {{otp}}"
}
```

**Solution**: Tambahkan `{{otp}}` di custom message

#### 4. Invalid Phone Format
```json
{
  "success": false,
  "message": "Invalid phone format"
}
```

**Solution**: Gunakan format: `08xxx`, `62xxx`, atau `+62xxx`

#### 5. OTP Expired
```json
{
  "success": false,
  "message": "OTP has expired"
}
```

**Solution**: Request OTP baru (OTP hanya valid 5 menit)

#### 6. Max Attempts Exceeded
```json
{
  "success": false,
  "message": "Maximum validation attempts exceeded"
}
```

**Solution**: Request OTP baru (max 3 verifikasi attempts per OTP)

---

## Best Practices

### 1. Pilih Method yang Tepat

**Gunakan WABA Method ketika:**
- Production environment
- High volume OTP sending
- Membutuhkan reliability tinggi
- Budget tersedia (Rp 400/OTP)

**Gunakan Device Method ketika:**
- Testing/development
- Custom branding penting
- Budget terbatas (sudah punya quota device)
- Low-medium volume

### 2. Handle Errors dengan Baik

Selalu handle error response dari API:

```javascript
// In n8n Function Node
const response = $input.all()[0].json;

if (!response.success) {
  // Handle different error scenarios
  if (response.message.includes('balance')) {
    throw new Error('Balance tidak cukup. Silakan top up.');
  } else if (response.message.includes('expired')) {
    return { resendOtp: true };
  } else {
    throw new Error(response.message);
  }
}

return response.data;
```

### 3. Rate Limiting

Implementkan rate limiting di aplikasi Anda:

- **Per merchant**: Max 120 requests/hour
- **Per phone**: Max 5 requests/hour, 2 requests/5 minutes
- **Minimum interval**: 30 seconds antar request

### 4. Security

- Jangan log OTP code yang actual
- Selalu validate di server-side
- Implement client-side input validation (6 digits only)
- Show remaining attempts ke user
- Clear OTP input setelah 3 failed attempts

### 5. User Experience

- Tampilkan countdown timer (5 menit)
- Show "Resend OTP" button setelah 30 detik
- Inform user berapa attempts tersisa
- Auto-fill OTP jika memungkinkan (WebOTP API)

---

## Phone Number Formats

API otomatis normalize phone numbers:

```
Input             →  Normalized Output
"08123456789"     →  "628123456789" (Indonesia)
"62812345678"     →  "628123456789"
"+62812345678"    →  "628123456789"
"601234567890"    →  "601234567890" (Malaysia)
"+60123456789"    →  "601234567890"
```

---

## Monitoring & Logging

### Log Format

Setiap OTP request di-log dengan info:
- Unique OTP ID (UUID)
- User code dan phone number
- Encrypted OTP code
- Send method (waba/device)
- Cost dan device_id (jika applicable)
- Status dan timestamps
- Verification attempts counter

### OTP Status Flow

1. **sent** - Status awal setelah OTP dikirim
2. **verified** - OTP berhasil diverifikasi
3. **expired** - OTP kadaluarsa (>5 menit)
4. **failed** - Max verification attempts exceeded

---

## Migration dari V1 ke V2

### Perbandingan API

| Aspect | OTP V1 | OTP V2 |
|--------|--------|--------|
| Endpoint Send | `/api/v1/otp/generate` | `/v2/otp/send` |
| Endpoint Verify | `/api/v1/otp/validate` | `/v2/otp/verify` |
| Methods | Device only | WABA + Device |
| Database | In-memory | Persistent |
| Cost Tracking | Manual | Automatic |
| Field name (verify) | `otp` | `otp_code` |

### Migration Steps

1. **Update Endpoints**
   - Change operation dari `generateOtp` ke `sendOtpV2`
   - Change operation dari `validateOtp` ke `verifyOtpV2`

2. **Update Fields**
   - Gunakan `phoneV2` instead of `phone`
   - Gunakan `otpCodeV2` instead of `otp` untuk verify
   - Tambahkan field `otpMethod` (waba atau device)

3. **Handle New Response Format**
   - V2 return `otp_id` (UUID format)
   - Ada field `method` dan `cost` di response

4. **Test Thoroughly**
   - Test dengan WABA method
   - Test dengan Device method
   - Test error scenarios

---

## Troubleshooting

### OTP tidak terkirim (WABA Method)

**Checklist:**
- ✅ Balance >= Rp 400?
- ✅ Phone number format valid?
- ✅ Rate limit tidak exceeded?

### OTP tidak terkirim (Device Method)

**Checklist:**
- ✅ Device connected?
- ✅ Device quota > 0?
- ✅ Device tidak expired?
- ✅ Custom message contains `{{otp}}`?
- ✅ Message length 10-500 chars?

### Verification gagal terus

**Checklist:**
- ✅ OTP belum expired (< 5 menit)?
- ✅ Phone number sama dengan saat send?
- ✅ OTP code 6 digits?
- ✅ Belum 3 failed attempts?

---

## Support

Untuk bantuan lebih lanjut:
- Email: support@kirimi.id
- Dokumentasi: https://docs.kirimi.id
- GitHub: https://github.com/kiriminow/n8n-kirimi-nodes

---

## Changelog

### Version 1.0.11 (2025-11-19)
- ✨ Added OTP V2 support
- ✨ Added dual method (WABA + Device)
- ✨ Added custom message templates
- ✨ Improved error handling
