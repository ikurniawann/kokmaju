-- Self-order pickup terjadwal (owner 2026-10-11, EPIC-053): pelanggan pesan
-- dari aplikasi tanpa scan meja, WAJIB bayar dulu, memilih jam ambil.
--   pickup_at          = jam pelanggan mengambil di kasir
--   kitchen_release_at = sejak kapan pesanan boleh tampil di KDS/antrean
--                        (pickup_at dikurangi waktu siap; "secepatnya" = saat pesan)
-- KDS menahan pesanan pickup sampai LUNAS dan kitchen_release_at terlewati.
ALTER TABLE pos.pos_orders
  ADD COLUMN IF NOT EXISTS pickup_at timestamptz,
  ADD COLUMN IF NOT EXISTS kitchen_release_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_pos_orders_pickup_at
  ON pos.pos_orders (pickup_at)
  WHERE pickup_at IS NOT NULL;

-- Saklar buka/tutup pickup (default tutup sampai admin menyalakan).
INSERT INTO configuration.app_settings (key, value)
SELECT 'self_order_pickup_enabled', 'false'
WHERE NOT EXISTS (SELECT 1 FROM configuration.app_settings WHERE key = 'self_order_pickup_enabled');
