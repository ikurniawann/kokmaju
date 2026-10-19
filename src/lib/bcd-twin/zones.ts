/**
 * Area (divisi) di peta KoMa Twin + aturan status & KPI tiap area dari
 * snapshot. Murni — dipakai scene 3D (warna lampu/pin) dan panel detail.
 */

import type { TwinSnapshot } from "./types";

export type ZoneId =
  | "kasir"
  | "bar"
  | "seating"
  | "gofood"
  | "gudang"
  | "procurement"
  | "hrd"
  | "marketing"
  | "finance";

export type ZoneStatus = "ok" | "warn" | "bad" | "idle";

export type ZoneDef = {
  id: ZoneId;
  name: string;
  division: string;
  /** Halaman sistem yang mengelola area ini. */
  href: string;
  /** Ikon panel (kunci set ikon halaman). */
  icon: "register" | "cup" | "table" | "bike" | "box" | "truck" | "people" | "megaphone" | "chart";
};

export const ZONES: readonly ZoneDef[] = [
  { id: "kasir", name: "Kasir & Self-order", division: "Point of Sales", href: "/dashboard/pos/orders", icon: "register" },
  { id: "bar", name: "Bar & Dapur", division: "Produksi (KDS)", href: "/dashboard/pos/kds", icon: "cup" },
  { id: "seating", name: "Area Duduk", division: "Restaurant · Meja", href: "/dashboard/pos/restaurant-tablet", icon: "table" },
  { id: "gofood", name: "Pickup Ojol", division: "GoFood / Delivery", href: "/dashboard/pos/gofood", icon: "bike" },
  { id: "gudang", name: "Gudang & Chiller", division: "Inventory", href: "/dashboard/product/inventory/stock", icon: "box" },
  { id: "procurement", name: "Dock Penerimaan", division: "Procurement", href: "/dashboard/product/purchasing/po", icon: "truck" },
  { id: "hrd", name: "Ruang HRD", division: "HRD · Absensi", href: "/dashboard/hris", icon: "people" },
  { id: "marketing", name: "Marketing & CRM", division: "Member · Loyalty", href: "/dashboard/crm/members", icon: "megaphone" },
  { id: "finance", name: "Finance", division: "Omzet · Tagihan", href: "/dashboard/pos/member-bills", icon: "chart" },
];

export const zoneById = (id: string) => ZONES.find((zone) => zone.id === id);

export type ZoneKpi = { label: string; value: string };
export type ZoneSummary = { status: ZoneStatus; headline: string; kpis: ZoneKpi[] };

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const num = (n: number) => Math.round(n).toLocaleString("id-ID");

export function summarizeZone(id: ZoneId, s: TwinSnapshot): ZoneSummary {
  switch (id) {
    case "kasir": {
      const open = s.orders.filter((o) => !o.paid).length;
      return {
        status: s.selfOrder.pending > 3 ? "warn" : s.sales.ordersToday ? "ok" : "idle",
        headline: s.selfOrder.pending ? `${s.selfOrder.pending} self-order menunggu "Dibuat"` : `${num(s.sales.ordersToday)} order hari ini`,
        kpis: [
          { label: "Omzet hari ini", value: rp(s.sales.revenueToday) },
          { label: "Order", value: num(s.sales.ordersToday) },
          { label: "Rata-rata", value: rp(s.sales.avgTicket) },
          { label: "Belum dibayar", value: num(open) },
        ],
      };
    }
    case "bar": {
      const queue = s.kitchen.pending + s.kitchen.preparing;
      return {
        status: queue > 15 ? "bad" : queue > 8 ? "warn" : queue ? "ok" : "idle",
        headline: queue ? `${queue} item dalam antrean` : "Antrean kosong",
        kpis: [
          { label: "Menunggu", value: num(s.kitchen.pending) },
          { label: "Diracik", value: num(s.kitchen.preparing) },
          { label: "Siap diantar", value: num(s.kitchen.ready) },
          { label: "Bar / Dapur", value: `${s.kitchen.bar} / ${s.kitchen.kitchen}` },
        ],
      };
    }
    case "seating": {
      const pct = s.tables.total ? Math.round((s.tables.occupied / s.tables.total) * 100) : 0;
      return {
        status: pct >= 90 ? "warn" : s.tables.occupied ? "ok" : "idle",
        headline: `${s.tables.occupied}/${s.tables.total} meja terisi · ${pct}%`,
        kpis: [
          { label: "Tamu duduk", value: num(s.tables.guests) },
          { label: "Minta bill", value: num(s.tables.billing) },
          { label: "Kosong", value: num(Math.max(0, s.tables.total - s.tables.occupied)) },
        ],
      };
    }
    case "gofood":
      return {
        status: s.gofood.active > 4 ? "warn" : s.gofood.active ? "ok" : "idle",
        headline: s.gofood.active ? `${s.gofood.active} order ojol aktif` : "Tidak ada ojol menunggu",
        kpis: [
          { label: "Order GoFood hari ini", value: num(s.gofood.today) },
          { label: "Aktif", value: num(s.gofood.active) },
        ],
      };
    case "gudang":
      return {
        status: s.inventory.out > 0 ? "bad" : s.inventory.low > 0 ? "warn" : "ok",
        headline: s.inventory.out ? `${s.inventory.out} bahan HABIS` : s.inventory.low ? `${s.inventory.low} bahan menipis` : "Stok aman",
        kpis: [
          { label: "Menipis", value: num(s.inventory.low) },
          { label: "Habis", value: num(s.inventory.out) },
        ],
      };
    case "procurement": {
      const waiting = s.procurement.prPending + s.procurement.poDraft;
      return {
        status: waiting ? "warn" : s.procurement.poOpen ? "ok" : "idle",
        headline: waiting ? `${waiting} PR/PO menunggu persetujuan` : `${s.procurement.poOpen} PO dalam pengiriman`,
        kpis: [
          { label: "PR menunggu", value: num(s.procurement.prPending) },
          { label: "PO draft", value: num(s.procurement.poDraft) },
          { label: "PO berjalan", value: num(s.procurement.poOpen) },
          { label: "Diterima hari ini", value: num(s.procurement.grnToday) },
        ],
      };
    }
    case "hrd":
      return {
        status: s.hr.late > 0 || s.hr.notYet > 0 ? "warn" : s.hr.present ? "ok" : "idle",
        headline: `${s.hr.present}/${s.hr.active} hadir`,
        kpis: [
          { label: "Hadir", value: num(s.hr.present) },
          { label: "Terlambat", value: num(s.hr.late) },
          { label: "Cuti", value: num(s.hr.leave) },
          { label: "Belum absen", value: num(s.hr.notYet) },
        ],
      };
    case "marketing":
      return {
        status: s.marketing.members ? "ok" : "idle",
        headline: `${num(s.marketing.members)} member · +${s.marketing.newMembers7d} minggu ini`,
        kpis: [
          { label: "Member", value: num(s.marketing.members) },
          { label: "Baru 7 hari", value: num(s.marketing.newMembers7d) },
          { label: "XP dibagikan", value: num(s.marketing.xp7d) },
          { label: "Reward ditukar", value: num(s.marketing.rewards7d) },
        ],
      };
    case "finance": {
      const target = s.finance.targetMonth;
      const pct = target ? Math.round((s.finance.revenueMonth / target) * 100) : null;
      return {
        status: s.finance.pendingDecisions > 0 ? "warn" : "ok",
        headline: pct === null ? `${rp(s.finance.revenueMonth)} bulan ini` : `${pct}% dari target bulan ini`,
        kpis: [
          { label: "Omzet bulan ini", value: rp(s.finance.revenueMonth) },
          { label: "Target", value: target ? rp(target) : "—" },
          { label: "Tagihan member", value: rp(s.finance.memberBillsOutstanding) },
          { label: "Perlu keputusan", value: num(s.finance.pendingDecisions) },
        ],
      };
    }
  }
}
