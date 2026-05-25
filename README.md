# MITRA-DASH PWA — Panduan Deployment

> **Converted by:** Gas-to-PWA Converter  
> **Versi:** 1.0.0  
> **Teknologi:** HTML5, CSS3, Vanilla JS, Service Worker, IndexedDB, Background Sync

---

## 📁 Struktur File

```
mitra-dash-pwa/
├── index.html          ← App utama (semua UI + logic)
├── manifest.json       ← Konfigurasi PWA (nama, ikon, warna)
├── sw.js               ← Service Worker (Cache First + Background Sync)
├── icons/
│   ├── icon-192.svg    ← Ikon app 192×192 (placeholder, bisa diganti)
│   └── icon-512.svg    ← Ikon app 512×512 (placeholder, bisa diganti)
└── README.md           ← File ini
```

---

## 🚀 Cara Deploy

### Opsi A: GitHub Pages (Gratis, Direkomendasikan)

1. Buat repository baru di GitHub (misal: `mitra-dash`)
2. Upload semua file dari folder ini ke repository
3. Masuk ke **Settings → Pages**
4. Set **Source** ke `main` branch, folder `/ (root)`
5. App akan tersedia di `https://[username].github.io/mitra-dash/`

### Opsi B: Netlify (Drag & Drop)

1. Buka [netlify.com](https://netlify.com) → **Add new site → Deploy manually**
2. Drag & drop seluruh folder `mitra-dash-pwa/` ke area upload
3. Netlify akan langsung memberikan URL HTTPS

### Opsi C: Vercel

```bash
npm install -g vercel
cd mitra-dash-pwa
vercel --prod
```

> ⚠️ **PENTING:** PWA **harus dihosting di HTTPS** agar Service Worker dan Install Prompt berfungsi.  
> Semua platform di atas sudah otomatis HTTPS.

---

## 🔧 Cara Test PWA di Chrome

1. Buka app di Chrome
2. Tekan `F12` → tab **Application**
3. Cek **Service Workers** — harus ada status `activated and running`
4. Cek **Manifest** — harus muncul nama dan ikon
5. Cek **Storage → IndexedDB → mitra-dash-db** — antrian offline tersimpan di sini

---

## 📱 Cara Install di Device

### Android (Chrome)
- Buka app → muncul banner **"Tambahkan ke layar utama"** atau
- Ketuk icon titik tiga → **Install app**
- Atau ketuk tombol **"Install App"** yang muncul di halaman

### iPhone / iPad (Safari)
- Buka app di Safari
- Ketuk ikon **Share** (kotak dengan panah ke atas)
- Pilih **"Add to Home Screen"**
- Ketuk **Add**

> ⚠️ **iOS Note:** Background Sync tidak didukung di iOS. Sinkronisasi dilakukan secara otomatis saat app dibuka kembali dan perangkat sudah online.

---

## 🖼️ Cara Mengganti Ikon

File `icons/icon-192.svg` dan `icons/icon-512.svg` adalah placeholder.  
Ganti dengan logo asli aplikasi:

1. **Format yang direkomendasikan:** PNG (transparan background) atau SVG
2. **Ukuran:** 192×192px dan 512×512px
3. Update `manifest.json` jika menggunakan PNG:

```json
"icons": [
  {
    "src": "icons/icon-192.png",
    "sizes": "192x192",
    "type": "image/png",
    "purpose": "any maskable"
  },
  {
    "src": "icons/icon-512.png",
    "sizes": "512x512",
    "type": "image/png",
    "purpose": "any maskable"
  }
]
```

4. Tambahkan juga untuk iOS di `index.html`:
```html
<link rel="apple-touch-icon" href="icons/icon-192.png">
```

---

## 🔑 Fitur PWA yang Diimplementasikan

| Fitur | Status | Keterangan |
|-------|--------|------------|
| Install ke device | ✅ | Banner dan tombol install native |
| Session persisten | ✅ | Login tersimpan di localStorage, tidak logout saat app ditutup |
| Logout manual saja | ✅ | User hanya keluar saat klik tombol Logout |
| Offline indicator | ✅ | Banner merah di bawah saat offline |
| Input offline | ✅ | Form `saveVerifVarietas`, `saveUser`, `deleteUser` tersimpan di antrian |
| Auto-sync saat online | ✅ | Background Sync (Android/Chrome) + fallback manual (iOS) |
| Cache static assets | ✅ | HTML, CSS, JS, font di-cache oleh Service Worker |
| Notifikasi sync | ✅ | SweetAlert2 toast saat data berhasil tersinkronisasi |

---

## 🌐 Konfigurasi GAS (Google Apps Script)

**GAS URL** yang digunakan:
```
https://script.google.com/macros/s/AKfycbyJ5vIZ6ZU-VPzevgpL763kpcBldo1L9N0jlksYPkl4j90hH80AHLnWN25v-_lRJi8l/exec
```

Pastikan GAS deployment dikonfigurasi:
- **Execute as:** Me
- **Who has access:** Anyone

Fungsi `doPost()` di `kode.gs` sudah disiapkan untuk menerima request dari PWA.

---

## 🔄 Alur Offline Sync

```
User input form (offline)
    ↓
Data masuk IndexedDB (mitra-dash-db)
    ↓
Badge antrian muncul di topbar
    ↓
Koneksi kembali online
    ↓
Background Sync (Android) atau window.online event (iOS)
    ↓
Flush antrian → kirim ke GAS satu per satu
    ↓
Notifikasi sukses di app
```

---

## 🐛 Troubleshooting

**Service Worker tidak aktif:**
- Pastikan file di-host via HTTPS
- Di Chrome DevTools → Application → Service Workers → klik "Update"

**Install prompt tidak muncul:**
- Pastikan `manifest.json` valid dan bisa diakses
- Cek tidak ada error di console browser
- Coba di Chrome incognito

**Data tidak tersinkronisasi:**
- Buka DevTools → Application → IndexedDB → mitra-dash-db → offline_queue
- Cek apakah ada item di sana
- Pastikan GAS URL masih valid dan accessible

---

*MITRA-DASH PWA v1.0 — TNCF Temanggung | @rochmadjeka*
