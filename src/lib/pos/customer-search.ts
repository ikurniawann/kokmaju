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

export function matchesCustomerQuery(
  customer: { name?: string | null; phone?: string | null; nfc_uid?: string | null },
  rawQuery: string
) {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;
  if ((customer.name ?? "").toLowerCase().includes(query)) return true;
  if ((customer.nfc_uid ?? "").toLowerCase().includes(query)) return true;
  // Nomor: cocokkan digit saja (abaikan spasi/strip/+), minimal 3 digit.
  const queryDigits = normalizePhoneDigits(query);
  if (queryDigits.length >= 3 && /^[\d\s+()-]+$/.test(query)) {
    return normalizePhoneDigits(customer.phone).includes(queryDigits);
  }
  return (customer.phone ?? "").toLowerCase().includes(query);
}
