"use client";

import { CheckCircle2, Printer, Plus } from "lucide-react";
import { formatRupiah } from "@/lib/table-order/menu";

export type KasirSale = {
  orderNumber: string | null;
  queueNumber: string | null;
  total: number;
  change: number;
  methodLabel: string;
  itemCount: number;
  customerName: string;
};

/** Layar setelah bayar: nomor antrian besar, kembalian, cetak struk, transaksi baru. */
export function KasirSuccess({
  sale,
  printing,
  onPrint,
  onNewSale,
}: {
  sale: KasirSale;
  printing: boolean;
  onPrint: () => void;
  onNewSale: () => void;
}) {
  return (
    <main className="flex min-h-dvh flex-col bg-gray-50 text-gray-900">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="size-12 text-emerald-600" />
          </div>
          <h1 className="mt-4 text-xl font-black">Pembayaran berhasil</h1>
          <p className="mt-1 text-sm text-gray-500">
            {sale.itemCount} item · {sale.methodLabel}
            {sale.customerName ? ` · ${sale.customerName}` : ""}
          </p>
        </div>

        {(sale.queueNumber || sale.orderNumber) && (
          <div className="mt-6 rounded-3xl bg-primary px-5 py-6 text-center text-white shadow-lg shadow-black/10">
            <div className="text-xs font-semibold uppercase tracking-widest text-white/75">
              {sale.queueNumber ? "Nomor antrian" : "Nomor pesanan"}
            </div>
            <div className="mt-1 text-5xl font-black tracking-tight">{sale.queueNumber || sale.orderNumber}</div>
            {sale.queueNumber && sale.orderNumber && (
              <div className="mt-2 text-xs text-white/75">{sale.orderNumber}</div>
            )}
          </div>
        )}

        <dl className="mt-5 space-y-2 rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-gray-100">
          <div className="flex justify-between">
            <dt className="text-gray-600">Total</dt>
            <dd className="font-bold">{formatRupiah(sale.total)}</dd>
          </div>
          {sale.change > 0 && (
            <div className="flex justify-between text-base">
              <dt className="font-semibold text-emerald-700">Kembalian</dt>
              <dd className="font-black text-emerald-700">{formatRupiah(sale.change)}</dd>
            </div>
          )}
        </dl>

        <div className="mt-auto space-y-3 pt-8">
          <button
            type="button"
            onClick={onPrint}
            disabled={printing}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary text-sm font-bold text-primary disabled:opacity-60"
          >
            <Printer className="size-4" /> {printing ? "Mencetak…" : "Cetak struk"}
          </button>
          <button
            type="button"
            onClick={onNewSale}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-black/10"
          >
            <Plus className="size-4" /> Transaksi baru
          </button>
        </div>
      </div>
    </main>
  );
}
