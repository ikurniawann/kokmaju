/**
 * Mode demo KoMa Twin — simulator coffee shop deterministik (seed) utk
 * presentasi saat data produksi masih sepi. Menghasilkan TwinSnapshot yang
 * sama bentuknya dgn mode live + daftar peristiwa utk animasi.
 */

import type { TwinEvent } from "./events";
import type { TwinChannel, TwinOrder, TwinSnapshot } from "./types";

/** RNG deterministik (mulberry32) — demo bisa diulang & diuji. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MENU = [
  { name: "Iced Light", price: 25000 },
  { name: "Iced Bold", price: 23000 },
  { name: "Dirty Latte", price: 25000 },
  { name: "Iced Magic", price: 25000 },
  { name: "Hot Black", price: 25000 },
  { name: "1 Litre Iced Bold", price: 90000 },
  { name: "Iced Apple Black", price: 28000 },
  { name: "Croissant Butter", price: 22000 },
];
const NAMES = ["Rina", "Dimas", "Sari", "Budi", "Ayu", "Fajar", "Nadia", "Raka", "Putri", "Yoga", "Tasya", "Galih"];
const MATERIALS = [
  { name: "Biji Kopi House Blend", unit: "kg", stock: 9, min: 4, use: 0.02 },
  { name: "Susu UHT", unit: "L", stock: 30, min: 12, use: 0.18 },
  { name: "Palm Sugar Syrup", unit: "L", stock: 5, min: 2, use: 0.03 },
  { name: "Es Batu", unit: "kg", stock: 40, min: 15, use: 0.25 },
  { name: "Cup 16oz", unit: "pcs", stock: 260, min: 80, use: 1 },
  { name: "Croissant Frozen", unit: "pcs", stock: 24, min: 10, use: 0.12 },
];

/** Durasi tiap tahap (detik simulasi). */
const STAGE_SECONDS: Record<string, number> = { pending: 8, confirmed: 10, preparing: 45, ready: 18, served: 60 };
const NEXT: Record<string, string> = { pending: "confirmed", confirmed: "preparing", preparing: "ready", ready: "served", served: "completed" };

type DemoOrder = TwinOrder & { stageLeft: number };
type DemoMaterial = (typeof MATERIALS)[number] & { stock: number; onOrder: boolean };

export type DemoState = {
  rng: () => number;
  clock: number;
  seq: number;
  nextOrderIn: number;
  orders: DemoOrder[];
  revenueToday: number;
  ordersToday: number;
  materials: DemoMaterial[];
  poDraft: number;
  poOpen: number;
  grnToday: number;
  poLeadLeft: number | null;
  members: number;
  newMembers7d: number;
  present: number;
  startedAt: number;
};

export function createDemoState(seed = 2026, now = Date.now()): DemoState {
  return {
    rng: createRng(seed),
    clock: 0,
    seq: 40,
    nextOrderIn: 2,
    orders: [],
    revenueToday: 3_865_000,
    ordersToday: 137,
    materials: MATERIALS.map((m) => ({ ...m, onOrder: false })),
    poDraft: 1,
    poOpen: 2,
    grnToday: 1,
    poLeadLeft: null,
    members: 412,
    newMembers7d: 23,
    present: 7,
    startedAt: now,
  };
}

function pick<T>(rng: () => number, list: readonly T[]) {
  return list[Math.floor(rng() * list.length)];
}

function newOrder(state: DemoState): DemoOrder {
  const { rng } = state;
  const roll = rng();
  const channel: TwinChannel = roll < 0.5 ? "kasir" : roll < 0.8 ? "self_order" : "gofood";
  const lines = 1 + Math.floor(rng() * 3);
  let total = 0;
  for (let i = 0; i < lines; i++) total += pick(rng, MENU).price * (1 + Math.floor(rng() * 2));
  state.seq += 1;
  const queue = String(state.seq % 1000).padStart(3, "0");
  return {
    id: `demo-${state.seq}`,
    number: `POS-DEMO-${String(state.seq).padStart(4, "0")}`,
    queue,
    channel,
    orderType: channel === "gofood" ? "delivery" : rng() < 0.75 ? "dine_in" : "takeaway",
    status: "pending",
    // Kasir bayar di depan; self-order & GoFood lunas saat selesai.
    paid: channel === "kasir",
    total,
    items: lines,
    table: channel === "gofood" ? null : `5-${String(1 + Math.floor(rng() * 10)).padStart(2, "0")}`,
    customer: pick(rng, NAMES),
    at: new Date(state.startedAt + state.clock * 1000).toISOString(),
    stageLeft: STAGE_SECONDS.pending,
  };
}

function snapshotOrder(order: DemoOrder): TwinOrder {
  const rest: Partial<DemoOrder> = { ...order };
  delete rest.stageLeft;
  return rest as TwinOrder;
}

/** Majukan simulasi `dt` detik; kembalikan peristiwa yang terjadi. */
export function stepDemo(state: DemoState, dt: number): TwinEvent[] {
  const events: TwinEvent[] = [];
  const { rng } = state;
  state.clock += dt;

  state.nextOrderIn -= dt;
  if (state.nextOrderIn <= 0) {
    const order = newOrder(state);
    state.orders.unshift(order);
    state.ordersToday += 1;
    if (order.paid) {
      state.revenueToday += order.total;
      events.push({ type: "order_paid", order: snapshotOrder(order) });
    }
    events.push({ type: "order_new", order: snapshotOrder(order) });
    for (const material of state.materials) {
      material.stock = Math.max(0, +(material.stock - material.use * order.items).toFixed(2));
    }
    if (rng() < 0.12) {
      state.members += 1;
      state.newMembers7d += 1;
      events.push({ type: "member_new", count: 1 });
    }
    state.nextOrderIn = 6 + rng() * 10;
  }

  for (const order of state.orders) {
    if (order.status === "completed") continue;
    order.stageLeft -= dt;
    if (order.stageLeft > 0) continue;
    order.status = NEXT[order.status] ?? "completed";
    order.stageLeft = STAGE_SECONDS[order.status] ?? Infinity;
    if (order.status === "ready") events.push({ type: "order_ready", order: snapshotOrder(order) });
    if (order.status === "served") events.push({ type: "order_served", order: snapshotOrder(order) });
    if (order.status === "completed" && !order.paid) {
      order.paid = true;
      state.revenueToday += order.total;
      events.push({ type: "order_paid", order: snapshotOrder(order) });
    }
  }
  state.orders = state.orders.slice(0, 12);

  // Procurement: stok di bawah minimum → PO; ±40 dtk kemudian barang diterima.
  const short = state.materials.find((m) => m.stock <= m.min && !m.onOrder);
  if (short && state.poLeadLeft === null) {
    short.onOrder = true;
    state.poDraft += 1;
    state.poLeadLeft = 40;
    events.push({ type: "po_created", count: 1 });
  }
  if (state.poLeadLeft !== null) {
    state.poLeadLeft -= dt;
    if (state.poLeadLeft <= 0) {
      state.poLeadLeft = null;
      for (const material of state.materials.filter((m) => m.onOrder)) {
        material.stock = material.min * 3;
        material.onOrder = false;
      }
      state.poDraft = Math.max(0, state.poDraft - 1);
      state.grnToday += 1;
      events.push({ type: "goods_received", count: 1 });
    }
  }
  return events;
}

export function demoSnapshot(state: DemoState): TwinSnapshot {
  const orders = state.orders.map(snapshotOrder);
  const active = orders.filter((o) => !["served", "completed"].includes(o.status));
  const lineItems = (status: string) => active.filter((o) => o.status === status).reduce((sum, o) => sum + o.items, 0);
  const dineIn = orders.filter((o) => o.orderType === "dine_in" && !o.paid);
  const low = state.materials.filter((m) => m.stock <= m.min);
  return {
    mode: "demo",
    generatedAt: new Date(state.startedAt + state.clock * 1000).toISOString(),
    outlet: "KoMa (Demo)",
    sales: {
      revenueToday: state.revenueToday,
      ordersToday: state.ordersToday,
      avgTicket: state.ordersToday ? Math.round(state.revenueToday / state.ordersToday) : 0,
      revenueYesterday: 4_120_000,
      trend7: [3_480_000, 3_910_000, 4_380_000, 5_120_000, 4_760_000, 4_120_000, state.revenueToday],
    },
    orders,
    kitchen: {
      pending: lineItems("pending") + lineItems("confirmed"),
      preparing: lineItems("preparing"),
      ready: lineItems("ready"),
      bar: Math.ceil((lineItems("pending") + lineItems("confirmed") + lineItems("preparing")) * 0.7),
      kitchen: Math.floor((lineItems("pending") + lineItems("confirmed") + lineItems("preparing")) * 0.3),
    },
    tables: { total: 21, occupied: Math.min(21, 6 + dineIn.length), billing: Math.min(2, dineIn.length), guests: 14 + dineIn.length * 2 },
    selfOrder: { pending: orders.filter((o) => o.channel === "self_order" && o.status === "pending").length },
    gofood: { today: 18 + orders.filter((o) => o.channel === "gofood").length, active: active.filter((o) => o.channel === "gofood").length },
    inventory: {
      low: low.length,
      out: state.materials.filter((m) => m.stock <= 0).length,
      items: [...state.materials]
        .sort((a, b) => a.stock / a.min - b.stock / b.min)
        .slice(0, 6)
        .map((m) => ({ name: m.name, value: m.stock, unit: m.unit, note: `min ${m.min} ${m.unit}` })),
    },
    procurement: {
      prPending: 1,
      poDraft: state.poDraft,
      poOpen: state.poOpen,
      grnToday: state.grnToday,
      recent: [
        { number: "PO/2610/014", status: "sent", total: 2_450_000 },
        { number: "PO/2610/013", status: "approved", total: 980_000 },
      ],
    },
    hr: { active: 9, present: state.present, late: 1, leave: 1, notYet: Math.max(0, 9 - state.present - 1) },
    marketing: { members: state.members, newMembers7d: state.newMembers7d, xp7d: 18_400, rewards7d: 12 },
    finance: {
      revenueMonth: 41_200_000 + state.revenueToday,
      targetMonth: 120_000_000,
      memberBillsOutstanding: 1_250_000,
      memberBillsCount: 3,
      pendingDecisions: 4,
    },
    failed: [],
  };
}
