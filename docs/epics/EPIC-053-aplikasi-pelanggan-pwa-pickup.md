# EPIC-053: Aplikasi Pelanggan (PWA) + Pickup Terjadwal — `MODULE-POS`

status: ready-for-qa
environment: dev
phase: 1
priority: P1
area: Fullstack
module: `MODULE-POS`
retries: 0

## Goal

Self-order bisa dipasang sebagai aplikasi di HP pelanggan (PWA, tanpa toko
aplikasi) dan pelanggan bisa memesan untuk **diambil di kasir tanpa scan
meja**, dengan jam ambil pilihan.

## Keputusan owner (2026-10-11)

- **PWA dulu**; aplikasi toko (Capacitor/native) menyusul bila perlu.
- Pickup **wajib bayar dulu** (QRIS dinamis, Static QRIS, ARK Coin) — tanpa
  "bayar di kasir".
- Pelanggan **memilih jam ambil** (atau "secepatnya").
- **Saklar buka/tutup** pickup — kasir (layar Pesanan Self-Order) & admin
  (Settings → Payment Gateways). Default **tutup** setelah migrasi.

## Desain

- `/pesan` beranda aplikasi (manifest `/pesan/manifest.webmanifest`, SW
  `/sw-pelanggan.js` scope `/pesan`, ikon `public/app-icons`): kartu member,
  Pesan ambil, Scan QR meja (BarcodeDetector / jsQR), pesanan pickup aktif,
  portal member, tombol Pasang / panduan iPhone.
- `/pesan/ambil` = self-order dengan kode khusus `PICKUP` (order_type takeaway,
  tanpa meja). Jam ambil kelipatan 15 mnt, ≥ sekarang+20 mnt, ≤ 8 jam & hari
  yang sama (WIB), dihitung dari jam server.
- Kolom baru `pos_orders.pickup_at` & `kitchen_release_at`
  (delta `20261011150000_pos_orders_pickup.sql`). Dapur dilepas
  `max(15, prep+10)` mnt sebelum jam ambil; "secepatnya" = langsung.
- KDS & papan antrean menahan pesanan pickup sampai **LUNAS** dan
  `kitchen_release_at` lewat; label "Pickup HH:MM"; waktu tunggu dihitung
  sejak dilepas.
- Kasir: kartu self-order menampilkan "Pickup HH:MM" & status bayar asli
  (dulu selalu "belum dibayar"); pickup QRIS dinamis yang belum dibayar tidak
  muncul (QRIS statis tetap muncul utk cek bukti).
- QRIS gagal dibuat utk pickup → pesanan dibatalkan (bukan jadi open bill).

## Tasks

- [x] T-1 Logika murni pickup (`lib/table-order/pickup.ts`) + tes
- [x] T-2 Migrasi kolom + saklar `self_order_pickup_enabled`
- [x] T-3 API order/sesi/detail mendukung pickup + tes
- [x] T-4 KDS menahan pickup; kasir label & status bayar
- [x] T-5 Saklar API + UI (kasir & settings)
- [x] T-6 UI pelanggan pickup (jam ambil, tanpa bayar di kasir, tracking)
- [x] T-7 PWA: manifest, SW, ikon, beranda, scan QR, pasang
- [ ] T-8 QA owner di HP (pasang aplikasi, pesan pickup nyata)

## Acceptance Criteria

- Given pickup ditutup, When pelanggan membuka /pesan/ambil, Then terlihat
  "Pickup sedang tutup" dan pesanan ditolak server (409).
- Given pickup dibuka, When pelanggan memilih jam 12:00 dan membayar, Then
  pesanan tidak muncul di KDS sampai lunas dan sampai ±20 mnt sebelum 12:00.
- Given metode "bayar di kasir", When dikirim utk pickup, Then 400.
- Aplikasi bisa dipasang (Android: tombol Pasang; iPhone: panduan Bagikan).

## Automation Log

- 2026-10-11 — Implementasi T-1..T-7. Gate: vitest penuh 2454 lulus; eslint
  bersih utk berkas yang diubah; tsc berkas yang diubah tanpa error baru. E2E
  di salinan DB (integrasi dinetralkan): manifest valid (192/512/maskable),
  /pesan & /pesan/ambil publik, bayar di kasir utk pickup → 400, 31 slot jam,
  pesanan Static QRIS jam 15:45 → KDS tersembunyi saat belum lunas & saat
  lunas tapi belum waktunya, tampil "Pickup 15:45" setelah kitchen_release_at;
  kartu kasir "Pickup 15:45 · Static QRIS · lunas"; beranda menampilkan
  pesanan aktif. Catatan: pickup QRIS dinamis yang tak pernah dibayar tetap
  `pending` (tersembunyi dari kasir) — pembersihan otomatis belum ada.
