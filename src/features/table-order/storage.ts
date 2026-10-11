/** Persistensi ringan per meja di browser pemesan (keranjang & order aktif) — aman bila storage diblokir. */

import type { CartLine } from "@/lib/table-order/pricing";
import type { TableOrderType } from "@/lib/table-order/order-status";

type Stored = {
  cart?: CartLine[];
  orderType?: TableOrderType;
  activeOrderId?: string | null;
  /** Semua pesanan kunjungan ini, terbaru di depan ("Pesanan saya"). */
  orderIds?: string[];
  savedAt?: number;
};

const TTL_MS = 6 * 60 * 60 * 1000; // 6 jam — cukup utk satu kunjungan
// Pickup (EPIC-053) bisa dijadwalkan s/d 8 jam ke depan → simpan sehari.
const PICKUP_TTL_MS = 24 * 60 * 60 * 1000;

function key(tableCode: string) {
  return `table-order:${tableCode.toUpperCase()}`;
}

export function readTableState(tableCode: string): Stored {
  try {
    const raw = window.localStorage.getItem(key(tableCode));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Stored;
    const ttl = tableCode.toUpperCase() === "PICKUP" ? PICKUP_TTL_MS : TTL_MS;
    if (parsed.savedAt && Date.now() - parsed.savedAt > ttl) {
      window.localStorage.removeItem(key(tableCode));
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export function writeTableState(tableCode: string, patch: Stored) {
  try {
    const current = readTableState(tableCode);
    window.localStorage.setItem(
      key(tableCode),
      JSON.stringify({ ...current, ...patch, savedAt: Date.now() })
    );
  } catch {
    // storage penuh/diblokir → abaikan, state tetap di memori
  }
}
