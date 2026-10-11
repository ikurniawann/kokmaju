// Pickup terjadwal (owner 2026-10-11, EPIC-053): bayar dulu, pilih jam ambil,
// dapur baru melihat pesanan setelah lunas & mendekati jam ambil.
import { describe, expect, it } from "vitest";
import {
  estimatePrepMinutes,
  formatPickupTime,
  isHeldFromKitchen,
  isPickupCode,
  pickupLabel,
  pickupSlots,
  planPickup,
} from "./pickup";

// 2026-10-11 10:07 WIB = 03:07 UTC
const now = new Date("2026-10-11T03:07:00Z");

describe("pickupSlots", () => {
  it("mulai kelipatan 15 mnt ≥ sekarang+20 mnt, per 15 mnt, maks 8 jam", () => {
    const slots = pickupSlots(now).map(formatPickupTime);
    expect(slots[0]).toBe("10:30");
    expect(slots[1]).toBe("10:45");
    expect(slots.at(-1)).toBe("18:00");
  });
  it("malam: berhenti di akhir hari WIB", () => {
    const late = new Date("2026-10-11T15:50:00Z"); // 22:50 WIB
    expect(pickupSlots(late).map(formatPickupTime)).toEqual(["23:15", "23:30", "23:45"]);
    expect(pickupSlots(new Date("2026-10-11T16:45:00Z"))).toEqual([]); // 23:45 WIB
  });
});

describe("planPickup", () => {
  it("secepatnya → dapur langsung, jam ambil = perkiraan siap", () => {
    const r = planPickup(null, 12, now);
    expect(r.ok && r.plan.asap).toBe(true);
    if (r.ok) {
      expect(r.plan.kitchenReleaseAt).toEqual(now);
      expect(formatPickupTime(r.plan.pickupAt)).toBe("10:19");
    }
  });
  it("jam 12:00 → dapur mulai 25 mnt sebelumnya (prep 15 + 10)", () => {
    const r = planPickup("2026-10-11T05:00:00Z", 15, now);
    expect(r.ok).toBe(true);
    if (r.ok) expect(formatPickupTime(r.plan.kitchenReleaseAt)).toBe("11:35");
  });
  it("jam terlalu dekat → dapur mulai sekarang", () => {
    const r = planPickup("2026-10-11T03:30:00Z", 20, now);
    if (r.ok) expect(r.plan.kitchenReleaseAt).toEqual(now);
  });
  it("menolak jam lewat, besok, format rusak", () => {
    expect(planPickup("2026-10-11T03:00:00Z", 10, now)).toMatchObject({ ok: false });
    expect(planPickup("2026-10-12T03:00:00Z", 10, now)).toMatchObject({ ok: false, error: "Pickup hanya bisa untuk hari ini" });
    expect(planPickup("besok", 10, now)).toMatchObject({ ok: false });
  });
});

describe("isHeldFromKitchen", () => {
  const base = { pickup_at: "2026-10-11T05:00:00Z", kitchen_release_at: "2026-10-11T04:35:00Z" };
  it("bukan pickup → tidak pernah ditahan", () => {
    expect(isHeldFromKitchen({ payment_status: "unpaid" }, now)).toBe(false);
  });
  it("pickup belum lunas → ditahan walau sudah waktunya", () => {
    expect(isHeldFromKitchen({ ...base, payment_status: "unpaid" }, new Date("2026-10-11T04:50:00Z"))).toBe(true);
  });
  it("lunas: ditahan sampai kitchen_release_at", () => {
    expect(isHeldFromKitchen({ ...base, payment_status: "paid" }, now)).toBe(true);
    expect(isHeldFromKitchen({ ...base, payment_status: "paid" }, new Date("2026-10-11T04:35:00Z"))).toBe(false);
  });
});

describe("label", () => {
  it("kode & label", () => {
    expect(isPickupCode(" pickup ")).toBe(true);
    expect(isPickupCode("T-01")).toBe(false);
    expect(pickupLabel("2026-10-11T05:00:00Z")).toBe("Pickup 12:00");
    expect(estimatePrepMinutes([0, 7, 18])).toBe(18);
    expect(estimatePrepMinutes([])).toBe(10);
  });
});
