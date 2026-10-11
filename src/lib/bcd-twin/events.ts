/**
 * Peristiwa yang memicu animasi di peta BCD Twin — dari selisih dua snapshot
 * (mode live) atau langsung dari simulator (mode demo).
 */

import type { TwinOrder, TwinSnapshot } from "./types";

export type TwinEvent =
  | { type: "order_new"; order: TwinOrder }
  | { type: "order_ready"; order: TwinOrder }
  | { type: "order_served"; order: TwinOrder }
  | { type: "order_paid"; order: TwinOrder }
  | { type: "po_created"; count: number }
  | { type: "goods_received"; count: number }
  | { type: "member_new"; count: number }
  | { type: "staff_checkin"; count: number };

const READY = new Set(["ready"]);
const SERVED = new Set(["served", "completed"]);

/** Peristiwa baru antara snapshot sebelumnya dan sekarang (live polling). */
export function diffSnapshots(prev: TwinSnapshot | null, next: TwinSnapshot): TwinEvent[] {
  if (!prev) return [];
  const events: TwinEvent[] = [];
  const before = new Map(prev.orders.map((order) => [order.id, order]));
  // Terlama dulu → animasi muncul sesuai urutan kejadian.
  for (const order of [...next.orders].reverse()) {
    const old = before.get(order.id);
    if (!old) {
      events.push({ type: "order_new", order });
      continue;
    }
    if (!READY.has(old.status) && READY.has(order.status)) events.push({ type: "order_ready", order });
    if (!SERVED.has(old.status) && SERVED.has(order.status)) events.push({ type: "order_served", order });
    if (!old.paid && order.paid) events.push({ type: "order_paid", order });
  }
  const poBefore = prev.procurement.poDraft + prev.procurement.poOpen;
  const poAfter = next.procurement.poDraft + next.procurement.poOpen;
  if (poAfter > poBefore) events.push({ type: "po_created", count: poAfter - poBefore });
  if (next.procurement.grnToday > prev.procurement.grnToday) {
    events.push({ type: "goods_received", count: next.procurement.grnToday - prev.procurement.grnToday });
  }
  if (next.marketing.members > prev.marketing.members) {
    events.push({ type: "member_new", count: next.marketing.members - prev.marketing.members });
  }
  if (next.hr.present > prev.hr.present) events.push({ type: "staff_checkin", count: next.hr.present - prev.hr.present });
  return events;
}
