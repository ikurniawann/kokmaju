import { describe, expect, it } from "vitest";
import { createDemoState, demoSnapshot, stepDemo } from "./demo";
import { diffSnapshots } from "./events";
import { summarizeZone, ZONES } from "./zones";
import { orderChannel } from "./server";
import type { TwinSnapshot } from "./types";

const run = (seconds: number, seed = 7) => {
  const state = createDemoState(seed, Date.UTC(2026, 9, 11, 2));
  const events = [];
  for (let t = 0; t < seconds; t += 0.5) events.push(...stepDemo(state, 0.5));
  return { state, events };
};

describe("mode demo", () => {
  it("deterministik per seed", () => {
    expect(demoSnapshot(run(120, 3).state)).toEqual(demoSnapshot(run(120, 3).state));
  });

  it("order lahir lalu melewati tahap sampai selesai & lunas", () => {
    const { events, state } = run(400);
    const types = new Set(events.map((e) => e.type));
    for (const t of ["order_new", "order_ready", "order_served", "order_paid"]) expect(types.has(t as never)).toBe(true);
    const snap = demoSnapshot(state);
    expect(snap.mode).toBe("demo");
    expect(snap.orders.length).toBeLessThanOrEqual(12);
    expect(snap.sales.ordersToday).toBeGreaterThan(137);
  });

  it("omzet hanya bertambah saat order dibayar", () => {
    const { events, state } = run(300);
    const paid = events.filter((e) => e.type === "order_paid").reduce((s, e) => s + (e.type === "order_paid" ? e.order.total : 0), 0);
    expect(state.revenueToday).toBe(3_865_000 + paid);
  });

  it("stok menipis memicu PO lalu barang diterima", () => {
    const { events } = run(1800);
    expect(events.some((e) => e.type === "po_created")).toBe(true);
    expect(events.some((e) => e.type === "goods_received")).toBe(true);
  });
});

describe("diffSnapshots (live)", () => {
  const base = demoSnapshot(createDemoState(1, 0));
  const order = { id: "o1", number: "POS-1", queue: "001", channel: "kasir" as const, orderType: "dine_in" as const, status: "pending", paid: false, total: 25000, items: 1, table: null, customer: null, at: "2026-10-11T02:00:00Z" };

  it("snapshot pertama tidak menganimasikan apa pun", () => {
    expect(diffSnapshots(null, base)).toEqual([]);
  });

  it("order baru, siap, diantar, lunas, PO, GRN, member, absen", () => {
    const a: TwinSnapshot = { ...base, orders: [order] };
    const b: TwinSnapshot = {
      ...base,
      orders: [{ ...order, status: "served", paid: true }, { ...order, id: "o2" }],
      procurement: { ...base.procurement, poDraft: base.procurement.poDraft + 1, grnToday: base.procurement.grnToday + 1 },
      marketing: { ...base.marketing, members: base.marketing.members + 2 },
      hr: { ...base.hr, present: base.hr.present + 1 },
    };
    const types = diffSnapshots(a, b).map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["order_new", "order_served", "order_paid", "po_created", "goods_received", "member_new", "staff_checkin"]));
    expect(types).not.toContain("order_ready");
  });
});

describe("zona", () => {
  it("semua area punya ringkasan & tautan menu", () => {
    const snap = demoSnapshot(run(60).state);
    for (const zone of ZONES) {
      const summary = summarizeZone(zone.id, snap);
      expect(summary.headline.length).toBeGreaterThan(0);
      expect(summary.kpis.length).toBeGreaterThan(0);
      expect(zone.href.startsWith("/dashboard/")).toBe(true);
    }
  });

  it("status: stok habis merah, antrean panjang kuning/merah, sepi = idle", () => {
    const snap = demoSnapshot(createDemoState(1, 0));
    expect(summarizeZone("gudang", { ...snap, inventory: { ...snap.inventory, out: 1 } }).status).toBe("bad");
    expect(summarizeZone("bar", { ...snap, kitchen: { ...snap.kitchen, pending: 10, preparing: 0 } }).status).toBe("warn");
    expect(summarizeZone("bar", { ...snap, kitchen: { ...snap.kitchen, pending: 20, preparing: 0 } }).status).toBe("bad");
    expect(summarizeZone("gofood", { ...snap, gofood: { today: 0, active: 0 } }).status).toBe("idle");
  });
});

describe("kanal order live", () => {
  it("self-order dari penanda special_requests, GoFood dari order GoFood", () => {
    expect(orderChannel({ special_requests: "Self-service table order T-01; payment=cashier", payment_method: null, is_gofood: false })).toBe("self_order");
    expect(orderChannel({ special_requests: null, payment_method: "gofood", is_gofood: false })).toBe("gofood");
    expect(orderChannel({ special_requests: null, payment_method: "cash", is_gofood: true })).toBe("gofood");
    expect(orderChannel({ special_requests: null, payment_method: "cash", is_gofood: false })).toBe("kasir");
  });
});
