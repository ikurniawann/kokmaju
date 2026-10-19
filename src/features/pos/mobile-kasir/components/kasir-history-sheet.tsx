"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { BottomSheet } from "@/features/table-order/components/sheet";
import { getOrders } from "@/lib/pos-api";
import { formatRupiah } from "@/lib/table-order/menu";
import { formatPaymentMethodLabel } from "@/features/pos/reports/utils/transaction-labels";

type HistoryOrder = {
  id: string;
  order_number?: string | null;
  queue_number?: string | null;
  total_amount?: number | string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  payment_method_code?: string | null;
  payment_method_name?: string | null;
  status?: string | null;
  ordered_at?: string | null;
  created_at?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  paid: "Lunas",
  unpaid: "Belum bayar",
  partial: "Sebagian",
  refunded: "Refund",
};

function startOfTodayIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

/** Transaksi hari ini (stall aktif) — ringkas utk cek cepat di HP kasir. */
export function KasirHistorySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const historyQuery = useQuery({
    queryKey: ["pos", "kasir-mobile", "history"],
    queryFn: async () => (await getOrders({ date_from: startOfTodayIso(), limit: 50 })).data as HistoryOrder[],
    enabled: open,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const orders = open && !historyQuery.isFetching ? (historyQuery.data ?? null) : null;
  const error = historyQuery.error instanceof Error ? historyQuery.error.message : null;
  const paid = (orders ?? []).filter((order) => order.payment_status === "paid" && order.status !== "cancelled");
  const omzet = paid.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

  return (
    <BottomSheet open={open} onClose={onClose} title="Transaksi hari ini">
      {orders === null && !error ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" /> Memuat…
        </div>
      ) : error ? (
        <p className="py-10 text-center text-sm font-semibold text-red-600">{error}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-primary/5 p-3">
              <div className="text-xs text-gray-500">Transaksi lunas</div>
              <div className="text-xl font-black text-gray-900">{paid.length}</div>
            </div>
            <div className="rounded-2xl bg-primary/5 p-3">
              <div className="text-xs text-gray-500">Omzet</div>
              <div className="text-xl font-black text-gray-900">{formatRupiah(omzet)}</div>
            </div>
          </div>
          {orders && orders.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">Belum ada transaksi hari ini.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100">
              {(orders ?? []).map((order) => {
                const when = order.ordered_at || order.created_at;
                return (
                  <li key={order.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-gray-900">
                        {order.queue_number ? `#${order.queue_number} · ` : ""}
                        {order.order_number || order.id.slice(0, 8)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {when ? new Date(when).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : ""}
                        {" · "}
                        {formatPaymentMethodLabel(order.payment_method, {
                          code: order.payment_method_code,
                          name: order.payment_method_name,
                        })}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold text-gray-900">{formatRupiah(Number(order.total_amount || 0))}</div>
                      <div
                        className={`text-[11px] font-semibold ${
                          order.status === "cancelled"
                            ? "text-gray-400"
                            : order.payment_status === "paid"
                              ? "text-emerald-600"
                              : "text-amber-600"
                        }`}
                      >
                        {order.status === "cancelled"
                          ? "Batal"
                          : STATUS_LABEL[order.payment_status ?? ""] ?? order.payment_status ?? "-"}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </BottomSheet>
  );
}
