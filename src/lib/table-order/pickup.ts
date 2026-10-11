/**
 * Self-order pickup terjadwal (owner 2026-10-11, EPIC-053): pesan dari
 * aplikasi tanpa scan meja, WAJIB bayar dulu (QRIS / QRIS statis / ARK Coin),
 * pilih "secepatnya" atau jam ambil hari ini. Dapur baru melihat pesanan
 * setelah LUNAS dan mendekati jam ambil (kitchen_release_at).
 * Murni (tanpa DB) — dipakai API, KDS, kasir & UI pelanggan.
 */
export const PICKUP_CODE = "PICKUP";
export const PICKUP_SETTING_KEY = "self_order_pickup_enabled";
/** Metode bayar pickup: harus lunas sebelum dibuat (tanpa "bayar di kasir"). */
export const PICKUP_PAYMENT_METHODS = ["qris", "static_qris", "ark_coin"] as const;

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const MINUTE = 60_000;
export const PICKUP_SLOT_STEP_MIN = 15;
/** Jam ambil paling cepat yg bisa dipilih = sekarang + 20 mnt. */
export const PICKUP_MIN_LEAD_MIN = 20;
/** Paling jauh 8 jam ke depan & masih hari yg sama (WIB). */
export const PICKUP_HORIZON_MIN = 8 * 60;

export function isPickupCode(code: string | null | undefined) {
  return String(code ?? "").trim().toUpperCase() === PICKUP_CODE;
}

/** Tanggal WIB "YYYY-MM-DD" dari sebuah waktu. */
export function wibDateKey(at: Date) {
  return new Date(at.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** "12:30" WIB. */
export function formatPickupTime(at: Date | string) {
  const d = typeof at === "string" ? new Date(at) : at;
  return new Date(d.getTime() + WIB_OFFSET_MS).toISOString().slice(11, 16);
}

/** Akhir hari WIB (23:59:59.999) dari sebuah waktu. */
function wibEndOfDay(at: Date) {
  const key = wibDateKey(at);
  return new Date(Date.parse(`${key}T23:59:59.999Z`) - WIB_OFFSET_MS);
}

/** Pilihan jam ambil (kelipatan 15 mnt WIB) mulai sekarang+20 mnt s/d 8 jam / akhir hari. */
export function pickupSlots(now: Date): Date[] {
  const step = PICKUP_SLOT_STEP_MIN * MINUTE;
  const earliest = now.getTime() + PICKUP_MIN_LEAD_MIN * MINUTE;
  // Kelipatan 15 mnt di zona WIB (offset 7 jam juga kelipatan 15 mnt → sama).
  let t = Math.ceil(earliest / step) * step;
  const last = Math.min(now.getTime() + PICKUP_HORIZON_MIN * MINUTE, wibEndOfDay(now).getTime());
  const slots: Date[] = [];
  while (t <= last) {
    slots.push(new Date(t));
    t += step;
  }
  return slots;
}

/** Perkiraan menit siap = waktu siap terlama di keranjang (min 10 mnt). */
export function estimatePrepMinutes(prepMinutes: readonly number[]) {
  const longest = prepMinutes.reduce((max, m) => (Number.isFinite(m) && m > max ? m : max), 0);
  return Math.max(10, Math.round(longest));
}

export type PickupPlan = { pickupAt: Date; kitchenReleaseAt: Date; asap: boolean };

/**
 * Validasi jam ambil dari klien & hitung kapan dapur mulai melihatnya.
 * `requested` null = secepatnya (dapur langsung, jam ambil = perkiraan siap).
 * Toleransi 10 mnt utk slot yg dipilih sebelum layar diperbarui.
 */
export function planPickup(
  requested: string | null | undefined,
  prepMinutes: number,
  now: Date
): { ok: true; plan: PickupPlan } | { ok: false; error: string } {
  if (!requested) {
    return {
      ok: true,
      plan: { pickupAt: new Date(now.getTime() + prepMinutes * MINUTE), kitchenReleaseAt: now, asap: true },
    };
  }
  const at = new Date(requested);
  if (Number.isNaN(at.getTime())) return { ok: false, error: "Jam ambil tidak valid" };
  if (at.getTime() < now.getTime() + (PICKUP_MIN_LEAD_MIN - 10) * MINUTE) {
    return { ok: false, error: "Jam ambil sudah lewat — pilih jam lain" };
  }
  if (at.getTime() > now.getTime() + (PICKUP_HORIZON_MIN + PICKUP_SLOT_STEP_MIN) * MINUTE || wibDateKey(at) !== wibDateKey(now)) {
    return { ok: false, error: "Pickup hanya bisa untuk hari ini" };
  }
  const lead = Math.max(15, prepMinutes + 10);
  const release = new Date(Math.max(now.getTime(), at.getTime() - lead * MINUTE));
  return { ok: true, plan: { pickupAt: at, kitchenReleaseAt: release, asap: false } };
}

type PickupHoldable = {
  pickup_at?: string | Date | null;
  kitchen_release_at?: string | Date | null;
  payment_status?: string | null;
};

/** Pesanan pickup ditahan dari KDS/antrean: belum lunas, atau belum waktunya dibuat. */
export function isHeldFromKitchen(order: PickupHoldable, now: Date) {
  if (!order.pickup_at) return false;
  if (order.payment_status !== "paid") return true;
  if (!order.kitchen_release_at) return false;
  return new Date(order.kitchen_release_at).getTime() > now.getTime();
}

/** Label singkat utk kasir/KDS/notifikasi: "Pickup 12:30". */
export function pickupLabel(pickupAt: string | Date | null | undefined) {
  return pickupAt ? `Pickup ${formatPickupTime(pickupAt)}` : "Pickup";
}

/** Label tempat di layar pelanggan (session.table_label pickup). */
export const PICKUP_PLACE_LABEL = "Ambil di kasir";

/** "Meja 5" utk meja; "Ambil di kasir" utk pickup. */
export function placeLabel(tableLabel: string) {
  return tableLabel === PICKUP_PLACE_LABEL ? tableLabel : `Meja ${tableLabel}`;
}
