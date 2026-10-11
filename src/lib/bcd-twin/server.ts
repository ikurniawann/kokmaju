/**
 * Snapshot live BCD Twin dari database. Memakai ulang ringkasan Desktop
 * (omzet, tim, keputusan, stok menipis, CRM) lalu menambah data khusus peta:
 * order terbaru per kanal, antrean bar/dapur, meja, GoFood, procurement,
 * tagihan member. Tiap bagian gagal-sendiri: dicatat di `failed`, sisanya jalan.
 */

import { query, queryOne } from "@/lib/db";
import { buildDesktopOverview, todayJakarta } from "@/lib/desktop/overview";
import { parseSalesTarget, SALES_TARGET_SETTING_KEY } from "@/lib/dashboard/sales-target";
import { getSetting } from "@/lib/settings/app-settings";
import { listMemberBills } from "@/lib/pos/member-bill-server";
import { TABLE_ORDER_TAG } from "@/lib/table-order/server";
import type { TwinChannel, TwinOrder, TwinSnapshot } from "./types";

const TERMINAL = "('cancelled','voided','merged')";

async function attempt<T>(name: string, failed: string[], fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[bcd-twin] ${name}:`, error);
    failed.push(name);
    return fallback;
  }
}

/** Kanal order: self-order meja (penanda special_requests), GoFood, atau kasir. */
export function orderChannel(row: { special_requests: string | null; payment_method: string | null; is_gofood: boolean }): TwinChannel {
  if (row.is_gofood || String(row.payment_method || "").toLowerCase() === "gofood") return "gofood";
  if (String(row.special_requests || "").startsWith(TABLE_ORDER_TAG)) return "self_order";
  return "kasir";
}

async function recentOrders(day: string): Promise<TwinOrder[]> {
  const rows = await query<{
    id: string;
    order_number: string | null;
    queue_number: string | null;
    order_type: string | null;
    status: string;
    payment_status: string;
    payment_method: string | null;
    special_requests: string | null;
    total: number;
    items: number;
    table_label: string | null;
    customer: string | null;
    at: string;
    is_gofood: boolean;
  }>(
    `SELECT o.id, o.order_number, o.queue_number, o.order_type::text AS order_type,
            o.status::text AS status, o.payment_status::text AS payment_status,
            o.payment_method, o.special_requests, o.total_amount::float8 AS total,
            (SELECT COALESCE(sum(i.quantity), 0)::int FROM pos.pos_order_items i WHERE i.order_id = o.id) AS items,
            COALESCE(t.name, t.table_number) AS table_label,
            COALESCE(c.name, o.contact_name) AS customer,
            COALESCE(o.ordered_at, o.created_at) AS at,
            EXISTS (SELECT 1 FROM pos.gofood_orders g WHERE g.pos_order_id = o.id) AS is_gofood
       FROM pos.pos_orders o
       -- pos_orders.table_id bertipe text, pos_tables.id uuid.
       LEFT JOIN pos.pos_tables t ON t.id::text = o.table_id
       LEFT JOIN pos.pos_customers c ON c.id = o.customer_id
      WHERE COALESCE(o.ordered_at, o.created_at) >= ($1::date::timestamp AT TIME ZONE 'Asia/Jakarta')
        AND o.status NOT IN ${TERMINAL}
      ORDER BY COALESCE(o.ordered_at, o.created_at) DESC
      LIMIT 12`,
    [day]
  );
  return rows.map((row) => ({
    id: row.id,
    number: row.order_number || row.id.slice(0, 8),
    queue: row.queue_number,
    channel: orderChannel(row),
    orderType: row.order_type === "takeaway" ? "takeaway" : row.order_type === "delivery" ? "delivery" : "dine_in",
    status: row.status,
    paid: row.payment_status === "paid",
    total: Number(row.total) || 0,
    items: Number(row.items) || 0,
    table: row.table_label,
    customer: row.customer,
    at: new Date(row.at).toISOString(),
  }));
}

async function kitchenQueue(day: string) {
  const row = await queryOne<{ pending: number; preparing: number; ready: number; bar: number; kitchen: number }>(
    `SELECT count(*) FILTER (WHERE COALESCE(i.kitchen_status, 'pending') = 'pending')::int AS pending,
            count(*) FILTER (WHERE i.kitchen_status = 'preparing')::int AS preparing,
            count(*) FILTER (WHERE i.kitchen_status = 'ready')::int AS ready,
            count(*) FILTER (WHERE COALESCE(i.kitchen_status, 'pending') IN ('pending','preparing') AND lower(COALESCE(i.station, '')) = 'bar')::int AS bar,
            count(*) FILTER (WHERE COALESCE(i.kitchen_status, 'pending') IN ('pending','preparing') AND lower(COALESCE(i.station, '')) <> 'bar')::int AS kitchen
       FROM pos.pos_order_items i
       JOIN pos.pos_orders o ON o.id = i.order_id
      WHERE COALESCE(o.ordered_at, o.created_at) >= ($1::date::timestamp AT TIME ZONE 'Asia/Jakarta')
        AND o.status NOT IN ${TERMINAL} AND o.status NOT IN ('served','completed')`,
    [day]
  );
  return {
    pending: Number(row?.pending) || 0,
    preparing: Number(row?.preparing) || 0,
    ready: Number(row?.ready) || 0,
    bar: Number(row?.bar) || 0,
    kitchen: Number(row?.kitchen) || 0,
  };
}

async function tableState() {
  const row = await queryOne<{ total: number; occupied: number; billing: number; guests: number }>(
    `WITH aktif AS (
       SELECT o.table_id, max(o.pre_settled_at) AS pre_settled_at, COALESCE(sum(o.guest_count), 0) AS guests
         FROM pos.pos_orders o
        WHERE o.table_id IS NOT NULL AND o.payment_status <> 'paid' AND o.status NOT IN ${TERMINAL}
        GROUP BY o.table_id
     )
     SELECT (SELECT count(*) FROM pos.pos_tables WHERE is_active)::int AS total,
            (SELECT count(*) FROM aktif)::int AS occupied,
            (SELECT count(*) FROM aktif WHERE pre_settled_at IS NOT NULL)::int AS billing,
            (SELECT COALESCE(sum(guests), 0) FROM aktif)::int AS guests`
  );
  return {
    total: Number(row?.total) || 0,
    occupied: Number(row?.occupied) || 0,
    billing: Number(row?.billing) || 0,
    guests: Number(row?.guests) || 0,
  };
}

async function procurement(day: string) {
  const [counts, recent] = await Promise.all([
    queryOne<{ pr: number; draft: number; open: number; grn: number }>(
      `SELECT (SELECT count(*) FROM purchasing.purchase_requests WHERE status IN ('draft','pending_head','pending_finance','pending_direksi'))::int AS pr,
              (SELECT count(*) FROM purchasing.purchase_orders WHERE deleted_at IS NULL AND status = 'draft')::int AS draft,
              (SELECT count(*) FROM purchasing.purchase_orders WHERE deleted_at IS NULL AND status IN ('approved','sent','partially_received'))::int AS open,
              (SELECT count(*) FROM purchasing.grn WHERE tanggal_penerimaan = $1::date)::int AS grn`,
      [day]
    ),
    query<{ nomor_po: string | null; status: string; total: number }>(
      `SELECT nomor_po, status, COALESCE(total, 0)::float8 AS total
         FROM purchasing.purchase_orders
        WHERE deleted_at IS NULL AND status NOT IN ('cancelled','closed')
        ORDER BY created_at DESC LIMIT 4`
    ),
  ]);
  return {
    prPending: Number(counts?.pr) || 0,
    poDraft: Number(counts?.draft) || 0,
    poOpen: Number(counts?.open) || 0,
    grnToday: Number(counts?.grn) || 0,
    recent: recent.map((po) => ({ number: po.nomor_po || "PO", status: po.status, total: Number(po.total) || 0 })),
  };
}

export async function buildTwinSnapshot(): Promise<TwinSnapshot> {
  const failed: string[] = [];
  const day = todayJakarta();

  const [overview, orders, kitchen, tables, proc, outStock, members, revenueMonth, target, bills, outlet] =
    await Promise.all([
      attempt("ringkasan", failed, () => buildDesktopOverview("today"), null),
      attempt("order", failed, () => recentOrders(day), [] as TwinOrder[]),
      attempt("dapur", failed, () => kitchenQueue(day), { pending: 0, preparing: 0, ready: 0, bar: 0, kitchen: 0 }),
      attempt("meja", failed, tableState, { total: 0, occupied: 0, billing: 0, guests: 0 }),
      attempt("procurement", failed, () => procurement(day), { prPending: 0, poDraft: 0, poOpen: 0, grnToday: 0, recent: [] }),
      attempt("stok", failed, async () => {
        const row = await queryOne<{ n: number }>(
          `SELECT count(*)::int AS n FROM inventory.inventory WHERE is_active AND qty_available <= 0`
        );
        return Number(row?.n) || 0;
      }, 0),
      attempt("member", failed, async () => {
        const row = await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM pos.pos_customers WHERE is_active`);
        return Number(row?.n) || 0;
      }, 0),
      attempt("omzet bulan", failed, async () => {
        const row = await queryOne<{ omzet: number }>(
          `SELECT COALESCE(sum(total_amount), 0)::float8 AS omzet FROM pos.pos_orders
            WHERE payment_status = 'paid' AND status NOT IN ${TERMINAL}
              AND COALESCE(ordered_at, created_at) >= (date_trunc('month', $1::date)::timestamp AT TIME ZONE 'Asia/Jakarta')`,
          [day]
        );
        return Number(row?.omzet) || 0;
      }, 0),
      attempt("target", failed, async () => parseSalesTarget(await getSetting(SALES_TARGET_SETTING_KEY)).bulananRp, null as number | null),
      attempt("tagihan", failed, () => listMemberBills(""), []),
      attempt("outlet", failed, async () => {
        const row = await queryOne<{ name: string }>(`SELECT name FROM configuration.companies ORDER BY created_at LIMIT 1`);
        return row?.name || "BCD Coffee";
      }, "BCD Coffee"),
    ]);

  const pulse = overview?.pulsaBisnis;
  const team = overview?.timHariIni;
  const crm = overview?.member;
  const low = overview?.stokMenipis;
  for (const section of overview?.gagal ?? []) failed.push(section);

  return {
    mode: "live",
    generatedAt: new Date().toISOString(),
    outlet,
    sales: {
      revenueToday: pulse?.hariIni.omzet ?? 0,
      ordersToday: pulse?.hariIni.pesanan ?? 0,
      avgTicket: pulse?.hariIni.rataRata ?? 0,
      revenueYesterday: pulse?.kemarin.omzet ?? 0,
      trend7: (pulse?.tujuhHari ?? []).map((day) => day.omzet),
    },
    orders,
    kitchen,
    tables: { ...tables, guests: Math.max(tables.guests, overview?.tamuDiMeja?.tamu ?? 0) },
    selfOrder: { pending: orders.filter((o) => o.channel === "self_order" && o.status === "pending").length },
    gofood: {
      today: orders.filter((o) => o.channel === "gofood").length,
      active: orders.filter((o) => o.channel === "gofood" && !["served", "completed"].includes(o.status)).length,
    },
    inventory: {
      low: low?.jumlah ?? 0,
      out: outStock,
      items: (low?.teratas ?? []).slice(0, 6).map((item) => ({ name: item.bahan, value: item.tersedia, note: `min ${item.minimum}` })),
    },
    procurement: { ...proc, poDraft: Math.max(proc.poDraft, overview?.perluKeputusan?.poDraft ?? 0) },
    hr: {
      active: team?.aktif ?? 0,
      present: team?.hadir ?? 0,
      late: team?.terlambat ?? 0,
      leave: team?.cuti ?? 0,
      notYet: team?.belum ?? 0,
    },
    marketing: {
      members,
      newMembers7d: crm?.memberBaru7Hari ?? 0,
      xp7d: crm?.xpTerdistribusi7Hari ?? 0,
      rewards7d: crm?.rewardDitukar7Hari ?? 0,
    },
    finance: {
      revenueMonth,
      targetMonth: target && target > 0 ? target : null,
      memberBillsOutstanding: bills.reduce((sum, bill) => sum + bill.balance.outstanding, 0),
      memberBillsCount: bills.filter((bill) => bill.balance.outstanding > 0).length,
      pendingDecisions: overview?.perluKeputusan?.total ?? 0,
    },
    failed: [...new Set(failed)],
  };
}
