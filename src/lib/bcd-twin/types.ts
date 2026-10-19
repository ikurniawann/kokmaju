/**
 * KoMa Twin (owner 2026-10-11) — satu "snapshot" keadaan coffee shop yang
 * dirender jadi peta 3D. Mode live mengisinya dari database; mode demo dari
 * simulator — keduanya berbentuk sama supaya satu jalur render.
 */

export type TwinChannel = "kasir" | "self_order" | "gofood";

export type TwinOrder = {
  id: string;
  number: string;
  queue: string | null;
  channel: TwinChannel;
  orderType: "dine_in" | "takeaway" | "delivery";
  /** pending | confirmed | preparing | ready | served | completed | cancelled | voided */
  status: string;
  paid: boolean;
  total: number;
  items: number;
  table: string | null;
  customer: string | null;
  at: string;
};

export type TwinNamedValue = { name: string; value: number; unit?: string | null; note?: string | null };

export type TwinSnapshot = {
  mode: "live" | "demo";
  generatedAt: string;
  outlet: string;
  sales: {
    revenueToday: number;
    ordersToday: number;
    avgTicket: number;
    revenueYesterday: number;
    /** Omzet 7 hari terakhir, terlama → terbaru. */
    trend7: number[];
  };
  /** Order hari ini, terbaru di depan (maks 12). */
  orders: TwinOrder[];
  kitchen: { pending: number; preparing: number; ready: number; bar: number; kitchen: number };
  tables: { total: number; occupied: number; billing: number; guests: number };
  selfOrder: { pending: number };
  gofood: { today: number; active: number };
  inventory: { low: number; out: number; items: TwinNamedValue[] };
  procurement: {
    prPending: number;
    poDraft: number;
    poOpen: number;
    grnToday: number;
    recent: { number: string; status: string; total: number }[];
  };
  hr: { active: number; present: number; late: number; leave: number; notYet: number };
  marketing: { members: number; newMembers7d: number; xp7d: number; rewards7d: number };
  finance: {
    revenueMonth: number;
    targetMonth: number | null;
    memberBillsOutstanding: number;
    memberBillsCount: number;
    pendingDecisions: number;
  };
  /** Bagian yang gagal dimuat (mode live) — UI menandainya, bukan angka nol palsu. */
  failed: string[];
};
