# EPIC-052: BCD Twin — Visual 3D Coffee Shop per Divisi — `MODULE-DASHBOARD`

status: ready-for-qa
environment: dev
phase: 1
priority: P2
area: Fullstack
module: `MODULE-DASHBOARD`
retries: 0

## Goal

Satu halaman yang memvisualkan seluruh sistem BCD sebagai coffee shop 3D
(referensi: WIT ERP Twin, `~/Desktop/erptwin.html`): tiap divisi = area di peta
dengan status & angka, klik area → detail + tautan ke halaman divisinya.

## Keputusan owner (2026-10-11)

- Data **live + mode demo** (simulasi untuk presentasi saat data masih sepi).
- Menu dashboard **BCD Twin**, hanya **super_admin & admin**.
- Gaya **3D isometrik hangat** (palet kopi + aksen biru BCD), terang/gelap.

## Peta area → divisi

Kasir & Self-order (POS) · Bar & Dapur (KDS) · Area Duduk (Restaurant) ·
Pickup Ojol (GoFood) · Gudang & Chiller (Inventory) · Dock Penerimaan
(Procurement) · HRD · Marketing & CRM · Finance (omzet, tagihan member).

## Tasks

- [x] Migrasi `20261011100000_bcd_twin_menu.sql` (menu + akses super_admin/admin)
- [x] `GET /api/dashboard/bcd-twin` — snapshot live, tiap bagian gagal-sendiri
- [x] `lib/bcd-twin` — tipe, zona & aturan status, simulator demo, diff → animasi (+ test)
- [x] Scene three.js (dimuat hanya di halaman ini) + panel UI
- [ ] Port ke Tedja (menunggu keputusan owner)

## Automation Log

- 2026-10-11 — Diuji pada salinan DB produksi memakai image produksi (dev
  server dimatikan earlyoom karena memori server penuh): owner membuka halaman
  (canvas + 9 pin, tanpa error konsol), mode demo berjalan, detail area, tema
  gelap, tablet 1024px; Arip (pos_supervisor) API 403 & dialihkan. Bug
  ditemukan & diperbaiki saat uji: `pos_orders.table_id` bertipe text (join ke
  `pos_tables.id` uuid). Test 2408 lulus, tsc baseline 508. Deploy poskopi
  (backup `wwwcoffee-before-bcd-twin-20261011-0949.dump`).
