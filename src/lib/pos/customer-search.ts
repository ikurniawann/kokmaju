/**
 * Pencarian member di POS (Find Customer, modern & classic). Laporan owner
 * 2026-10-09: member "tidak ditemukan" — nomor disimpan `08…` tetapi kasir
 * mengetik `62…`/`+62…`/pakai spasi/strip, dan spasi di ujung ketikan.
 */

/** Digit nomor dengan awalan 62 → 0, supaya 62812…, +62 812… dan 0812… setara. */
export function normalizePhoneDigits(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.startsWith("62") ? `0${digits.slice(2)}` : digits;
}

/** Isi QR kartu member (self-order) — dipindai ke kolom cari Find Customer. */
export const MEMBER_QR_PREFIX = "BCD-M:";

export function memberQrValue(customerId: string) {
  return `${MEMBER_QR_PREFIX}${customerId}`;
}

export function matchesCustomerQuery(
  customer: { id?: string | null; name?: string | null; phone?: string | null; nfc_uid?: string | null },
  rawQuery: string
) {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;
  // QR kartu member (scanner mengetik isinya ke kolom cari) → cocokkan ID persis.
  if (query.startsWith(MEMBER_QR_PREFIX.toLowerCase())) {
    return Boolean(customer.id) && customer.id!.toLowerCase() === query.slice(MEMBER_QR_PREFIX.length).trim();
  }
  if ((customer.name ?? "").toLowerCase().includes(query)) return true;
  if ((customer.nfc_uid ?? "").toLowerCase().includes(query)) return true;
  // Nomor: cocokkan digit saja (abaikan spasi/strip/+), minimal 3 digit.
  const queryDigits = normalizePhoneDigits(query);
  if (queryDigits.length >= 3 && /^[\d\s+()-]+$/.test(query)) {
    return normalizePhoneDigits(customer.phone).includes(queryDigits);
  }
  return (customer.phone ?? "").toLowerCase().includes(query);
}
