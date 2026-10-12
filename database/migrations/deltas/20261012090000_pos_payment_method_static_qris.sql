-- Static QRIS sbg metode bayar kasir (owner 2026-10-12): pelanggan scan
-- gambar QRIS statis venue (Settings → Payment Gateways), kasir konfirmasi.
-- Alur kasir non-tunai generik (handler credit); kode static_qris membuat
-- laporan menampilkan "Static QRIS" & jurnal masuk akun QRIS. Opsi hanya
-- muncul di kasir bila Static QRIS aktif & gambarnya ada.
INSERT INTO pos.payment_methods (
  code, name, description, icon, handler, is_active, sort_order, requires_cash_input
)
VALUES ('static_qris', 'Static QRIS', 'Scan QRIS statis venue', 'scan-line', 'credit', true, 25, false)
ON CONFLICT (code) DO NOTHING;
