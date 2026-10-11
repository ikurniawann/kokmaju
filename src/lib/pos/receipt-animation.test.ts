import { describe, expect, it } from "vitest";
import { MAX_ANIMATED_ITEMS, receiptFromCfd, receiptFromPayload } from "./receipt-animation";

const payload = {
  orderNumber: "POS-20261011-0012",
  queueNumber: "012",
  items: [
    { name: "Iced Light", quantity: 2, price: 25000, modifierNames: ["Extra Shot"] },
    { name: "Croissant", quantity: 1, price: 22000, variantName: "Butter" },
  ],
  discountAmount: 7200,
  taxAmount: 0,
  chargesBreakdown: [{ amount: 6480, kind: "tax" }],
  total: 71280,
  change: 28720,
  receiptHeader: ["BCD Coffee Sukakarya", "Jl. Sukakarya"],
};

describe("receiptFromPayload", () => {
  it("item, rincian & total sesuai payload kasir", () => {
    const r = receiptFromPayload(payload, "Tunai");
    expect(r.outlet).toBe("BCD Coffee Sukakarya");
    expect(r.queue).toBe("012");
    expect(r.items[0]).toEqual({ qty: 2, name: "Iced Light", detail: "Extra Shot", amount: 50000 });
    expect(r.items[1].detail).toBe("Butter");
    expect(r.totals.map((t) => [t.label, t.amount])).toEqual([
      ["Subtotal", 72000],
      ["Diskon", -7200],
      ["Pajak & layanan", 6480],
      ["Total", 71280],
      ["Kembalian", 28720],
    ]);
    expect(r.method).toBe("Tunai");
  });

  it("tanpa diskon/pajak/kembalian → baris itu tidak muncul; item banyak diringkas", () => {
    const items = Array.from({ length: MAX_ANIMATED_ITEMS + 2 }, (_, i) => ({ name: `Item ${i}`, quantity: 1, price: 1000 }));
    const r = receiptFromPayload({ items, discountAmount: 0, taxAmount: 0, total: items.length * 1000, change: 0 }, null);
    expect(r.totals.map((t) => t.label)).toEqual(["Subtotal", "Total"]);
    expect(r.items).toHaveLength(MAX_ANIMATED_ITEMS);
    expect(r.hiddenItems).toBe(2);
    expect(r.outlet).toBe("BCD Coffee");
  });
});

describe("receiptFromCfd", () => {
  it("layar customer tanpa isi struk (payload lama) → null", () => {
    expect(receiptFromCfd({ total: 1000 })).toBeNull();
  });
  it("isi struk dari state done", () => {
    const r = receiptFromCfd({
      total: 50000,
      done_change: 0,
      done_receipt: { queue: "007", method: "QRIS", items: [{ name: "Iced Bold", qty: 2, unit_price: 25000 }], subtotal: 50000, discount: 0, extra: 0 },
    });
    expect(r?.queue).toBe("007");
    expect(r?.items[0].amount).toBe(50000);
    expect(r?.totals.find((t) => t.strong)?.amount).toBe(50000);
  });
});

describe("buildCfdDoneReceipt (layar customer)", () => {
  it("hanya item & angka — tanpa nama/nomor pelanggan; bolak-balik ke receiptFromCfd", async () => {
    const { buildCfdDoneReceipt } = await import("./cfd");
    const done = buildCfdDoneReceipt({ ...payload, customerName: "Budi Santoso", customerPhone: "081234" } as typeof payload, "Tunai");
    const json = JSON.stringify(done);
    expect(json).not.toContain("Budi");
    expect(json).not.toContain("081234");
    expect(done.extra).toBe(6480);
    const r = receiptFromCfd({ total: payload.total, done_change: payload.change, done_receipt: done });
    expect(r?.totals.find((t) => t.strong)?.amount).toBe(71280);
    expect(r?.items[0]).toEqual({ qty: 2, name: "Iced Light", detail: "Extra Shot", amount: 50000 });
  });
});

describe("shouldDeferDuringDoneHold (layar customer)", () => {
  it("state kosong sisa transaksi ditunda; pelanggan berikutnya menyela", async () => {
    const { shouldDeferDuringDoneHold, idleCfdState } = await import("./cfd");
    const idle = idleCfdState();
    const emptyPayment = { ...idle, status: "payment" as const };
    const nextCart = { ...idle, status: "cart" as const, items: [{ name: "Iced Bold", qty: 1, unit_price: 23000, line_total: 23000 }] };
    expect(shouldDeferDuringDoneHold(idle, 5000)).toBe(true);
    expect(shouldDeferDuringDoneHold(emptyPayment, 5000)).toBe(true);
    expect(shouldDeferDuringDoneHold(nextCart, 5000)).toBe(false);
    expect(shouldDeferDuringDoneHold(idle, 0)).toBe(false);
  });
});
