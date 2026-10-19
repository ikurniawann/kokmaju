"use client";

import { Printer, Plus } from "lucide-react";
import type { AnimatedReceipt } from "@/lib/pos/receipt-animation";
import { formatRupiah } from "@/lib/table-order/menu";
import { PayReceiptAnimation } from "./pay-receipt-animation";

export type KasirSale = {
  orderNumber: string | null;
  queueNumber: string | null;
  total: number;
  change: number;
  methodLabel: string;
  itemCount: number;
  customerName: string;
  paidAt: Date;
  receipt: AnimatedReceipt;
};

/**
 * Layar setelah bayar: animasi "Bayar → Struk" (diputar ulang tiap Cetak
 * struk lewat `replayKey`), kembalian, cetak struk, transaksi baru.
 */
export function KasirSuccess({
  sale,
  brandLine,
  stallName,
  cashierName,
  replayKey,
  printing,
  onPrint,
  onNewSale,
}: {
  sale: KasirSale;
  brandLine: string;
  stallName: string | null;
  cashierName: string;
  replayKey: number;
  printing: boolean;
  onPrint: () => void;
  onNewSale: () => void;
}) {
  return (
    <main className="flex min-h-dvh flex-col bg-gray-100 text-gray-900">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6">
        <div className="text-center">
          <h1 className="text-lg font-black">Pembayaran berhasil</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            {sale.itemCount} item · {sale.methodLabel}
            {sale.customerName ? ` · ${sale.customerName}` : ""}
          </p>
        </div>

        <div className="mt-4">
          <PayReceiptAnimation
            key={replayKey}
            receipt={sale.receipt}
            brandLine={brandLine}
            subLine={stallName}
            cashierName={cashierName}
            paidAt={sale.paidAt}
            payLabel={`Bayar ${formatRupiah(sale.total)}`}
          />
        </div>

        {sale.change > 0 && (
          <div className="mt-5 flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-800 ring-1 ring-emerald-100">
            <span className="text-sm font-semibold">Kembalian</span>
            <span className="text-xl font-black">{formatRupiah(sale.change)}</span>
          </div>
        )}

        <div className="mt-auto space-y-3 pt-6">
          <button
            type="button"
            onClick={onPrint}
            disabled={printing}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary bg-white text-sm font-bold text-primary disabled:opacity-60"
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
