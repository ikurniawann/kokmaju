# EPIC-054: Kasir Mobile KoMa (POS di HP kasir, gaya self-order) — `MODULE-POS`

status: ready-for-qa
environment: dev
phase: 1
priority: P1
area: Fullstack
module: `MODULE-POS`
retries: 0

## Goal

Kasir Gerobak KoMa berjualan dari HP: tampilan seperti self-order meja
(`/table-order/...`) — daftar menu, sheet varian/add-on, bar keranjang — tapi
penggunanya **kasir** dan transaksinya langsung lunas lewat checkout kasir.

## Keputusan (owner 2026-10-19)

- Referensi UI: self-order `poskopi.reddie.id/table-order/WIT-OFFICE-BDG`, branding KoMa.
- Rute layar penuh `/kasir` (alamat lama `/pos/kasir` dialihkan), di luar layout dashboard
  (tanpa sidebar), gerbang akses = gerbang layout POS (menu IAM `pos*`).
- Metode bayar di HP: Tunai (keypad + nominal cepat + kembalian), QRIS Statis
  (tampilkan QR, kasir konfirmasi), non-tunai manual (EDC/transfer). QRIS
  dinamis, ARK Coin, NFC, gift card, FOC tetap di kasir desktop.
- Role `pos` (POS Cashier) login → langsung ke `/kasir`. Akun utama
  `kasir@kokmaju.id` (stall Gerobak 1).

## Desain

- `src/features/pos/mobile-kasir/catalog.ts` (murni, diuji): produk POS →
  `TableOrderProduct` (pakai ulang `MenuItemRow`/`VariantSheet`), urut kategori
  per `display_order`; baris keranjang → `PosCartItem` (selisih varian/add-on
  dipecah seperti kasir desktop); opsi metode bayar; nominal tunai cepat.
- `mobile-kasir-app.tsx`: katalog `usePosProducts` (stall aktif), billing
  `useResolvedBillingProfile`, checkout `usePosCheckout` (paid), shift
  `usePosShift` (hanya bila flag shift aktif), stall dari `/api/auth/stall-options`.
- Layar sukses: nomor antrian besar, kembalian, **Cetak struk**
  (`printThermalReceipt` — RawBT di Android / Web Serial / dialog print).
- Riwayat "Transaksi hari ini" (jumlah lunas + omzet).
- PWA: `public/manifest-kasir.webmanifest` (start `/pos/kasir`).
- `/api/pos/products` kini ikut mengirim `category.display_order`.

## Tasks

- [x] Modul katalog + tes (`catalog.test.ts`)
- [x] Halaman kasir mobile, sheet keranjang/bayar, layar sukses, riwayat
- [x] Rute `/pos/kasir`, `/kasir`, redirect login, manifest
- [x] Seeder menu contoh `kokmaju-demo-menu.js` & akun `kokmaju-kasir-users.js`
- [x] Animasi "Bayar → Struk" di layar sukses (referensi reel PathLink "Pay → Receipt"), diputar ulang tiap Cetak struk
- [ ] Ganti menu contoh dengan menu & harga asli KoMa
- [ ] Atur gambar QRIS statis (Settings → Payment Gateways) bila dipakai
- [ ] Tinjau pajak bawaan 10% (POS → Billing) untuk gerobak

## Acceptance Criteria

- Kasir login di HP → mendarat di kasir mobile, stall penempatannya aktif.
- Tambah menu (termasuk add-on) → keranjang → bayar tunai → nomor antrian,
  kembalian benar, order tercatat lunas dengan stall & catatan "Atas nama".
- Pengguna tanpa menu POS tidak bisa membuka `/pos/kasir`.

## Automation Log

- 2026-10-19 — Dibangun & dideploy ke kokmaju.reddie.id. Uji E2E (Chromium
  headless 390×844, akun kasir1@kokmaju.id): Ayam Geprek + Extra Sambal & Air
  Mineral, tunai Rp 50.000 → POS-20261019-0001 antrian 001, total Rp 26.400
  (termasuk pajak 10% bawaan), kembalian Rp 23.600, item kitchen/bar
  tercatat. Vitest 2.4k+ hijau, lint modul bersih.
- 2026-10-19 — Insiden: init-kokmaju-master.sql versi awal menghapus holding
  duplikat; saat dijalankan ulang, FK ON DELETE CASCADE ikut menghapus hierarki
  asli. DB dibangun ulang di database baru `kokmaju_app` (DB lama `kokmaju`
  dibiarkan, dump di docker-infra/kokmaju/backups); skrip init kini hanya
  mengganti nama (idempoten) + bootstrap-db.sh.
- 2026-10-19 — Animasi "Bayar → Struk" (`pay-receipt-animation.tsx/.css`):
  tombol Bayar → pil hijau "Lunas" (centang tergambar) → kertas struk bergerigi
  naik dari balik tombol, baris muncul berurutan, barcode hiasan deterministik.
  Ketuk = lewati; prefers-reduced-motion dihormati. Diverifikasi frame
  250–3200 ms di 390×844 dengan request order di-mock (tanpa tulis DB).
- 2026-10-19 — Revisi owner: struk keluar dari PRINTER + langkah POTONG kertas.
  Printer thermal KoMa (layar "Rp …" → "✓ LUNAS", LED berkedip, getar),
  kertas keluar dari celah tersendat (header duluan), pisau cutter menyapu
  celah + kilatan, tepi bawah jadi bergerigi, struk lepas (naik & miring).
  Layar sukses mulai dari atas (sheet bayar memulihkan gulir lama).
- 2026-10-19 — Akun kasir@kokmaju.id dibuat (seeder kokmaju-kasir-users.js,
  password dari owner). Alamat utama dipindah ke `/kasir` sesuai permintaan;
  `/pos/kasir` redirect. Uji: login lewat halaman /login di viewport HP →
  mendarat di /kasir; /kasir tanpa sesi → /login?redirect=/kasir.
