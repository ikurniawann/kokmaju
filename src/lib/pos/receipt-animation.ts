/**
 * Isi struk utk animasi "printer" (owner 2026-10-11, referensi reel
 * "Receipt Animation"): dialog Print Struk kasir & Layar Customer. Hanya
 * tampilan di layar — struk kertas tetap dari printer thermal. Murni.
 */

export type AnimatedReceiptItem = { qty: number; name: string; detail: string | null; amount: number };
export type AnimatedReceiptTotal = { label: string; amount: number; strong?: boolean; tone?: "ok" | "muted" };

export type AnimatedReceipt = {
  outlet: string;
  queue: string | null;
  orderNumber: string | null;
  items: AnimatedReceiptItem[];
  /** Item di luar batas tampil — ditulis "+N item lain". */
  hiddenItems: number;
  totals: AnimatedReceiptTotal[];
  method: string | null;
};

/** Struk di layar dibatasi supaya animasi tetap ringkas di dialog/tablet. */
export const MAX_ANIMATED_ITEMS = 6;

type ItemSource = { name: string; quantity: number; price: number; variantName?: string | null; modifierNames?: string[] | null };

function toItems(items: ItemSource[]) {
  const mapped = items.map((item) => ({
    qty: Math.max(1, Math.round(Number(item.quantity) || 1)),
    name: item.name,
    detail: [item.variantName, ...(item.modifierNames ?? [])].filter(Boolean).join(", ") || null,
    amount: (Number(item.price) || 0) * (Number(item.quantity) || 1),
  }));
  return { items: mapped.slice(0, MAX_ANIMATED_ITEMS), hiddenItems: Math.max(0, mapped.length - MAX_ANIMATED_ITEMS) };
}

function buildTotals(input: {
  subtotal: number;
  discount: number;
  extra: number;
  total: number;
  change: number;
}): AnimatedReceiptTotal[] {
  const totals: AnimatedReceiptTotal[] = [{ label: "Subtotal", amount: input.subtotal, tone: "muted" }];
  if (input.discount > 0) totals.push({ label: "Diskon", amount: -input.discount, tone: "ok" });
  if (input.extra > 0) totals.push({ label: "Pajak & layanan", amount: input.extra, tone: "muted" });
  totals.push({ label: "Total", amount: input.total, strong: true });
  if (input.change > 0) totals.push({ label: "Kembalian", amount: input.change, tone: "ok" });
  return totals;
}

/** Dari payload struk kasir (dialog Print Struk). */
export function receiptFromPayload(
  payload: {
    orderNumber?: string;
    checkoutNumber?: string;
    queueNumber?: string | null;
    items: ItemSource[];
    subtotal?: number;
    discountAmount: number;
    taxAmount: number;
    chargesBreakdown?: Array<{ amount: number; kind?: string }>;
    total: number;
    change: number;
    receiptHeader?: string[];
  },
  methodLabel: string | null
): AnimatedReceipt {
  const { items, hiddenItems } = toItems(payload.items);
  const subtotal = payload.subtotal ?? payload.items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
  const charges = payload.chargesBreakdown?.length
    ? payload.chargesBreakdown.reduce((sum, line) => sum + (Number(line.amount) || 0), 0)
    : Number(payload.taxAmount) || 0;
  return {
    outlet: payload.receiptHeader?.find((line) => line.trim())?.trim() || "BCD Coffee",
    queue: payload.queueNumber ?? null,
    orderNumber: payload.checkoutNumber || payload.orderNumber || null,
    items,
    hiddenItems,
    totals: buildTotals({
      subtotal,
      discount: Number(payload.discountAmount) || 0,
      extra: Math.max(0, charges),
      total: Number(payload.total) || 0,
      change: Number(payload.change) || 0,
    }),
    method: methodLabel,
  };
}

/** Dari state Layar Customer (status done). */
export function receiptFromCfd(state: {
  done_receipt?: {
    outlet?: string | null;
    queue?: string | null;
    order_number?: string | null;
    method?: string | null;
    items: Array<{ name: string; qty: number; unit_price: number; detail?: string | null }>;
    subtotal: number;
    discount: number;
    extra: number;
  } | null;
  total: number;
  done_change?: number;
}): AnimatedReceipt | null {
  const receipt = state.done_receipt;
  if (!receipt) return null;
  const mapped = receipt.items.map((item) => ({
    qty: item.qty,
    name: item.name,
    detail: item.detail ?? null,
    amount: item.unit_price * item.qty,
  }));
  return {
    outlet: receipt.outlet || "BCD Coffee",
    queue: receipt.queue ?? null,
    orderNumber: receipt.order_number ?? null,
    items: mapped.slice(0, MAX_ANIMATED_ITEMS),
    hiddenItems: Math.max(0, mapped.length - MAX_ANIMATED_ITEMS),
    totals: buildTotals({
      subtotal: receipt.subtotal,
      discount: receipt.discount,
      extra: receipt.extra,
      total: state.total,
      change: state.done_change ?? 0,
    }),
    method: receipt.method ?? null,
  };
}
