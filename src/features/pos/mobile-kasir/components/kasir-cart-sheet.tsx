"use client";

/* eslint-disable @next/next/no-img-element */

import { Minus, Plus, Trash2 } from "lucide-react";
import { BottomSheet } from "@/features/table-order/components/sheet";
import { formatRupiah } from "@/lib/table-order/menu";
import type { CartLine } from "@/lib/table-order/pricing";
import type { BillChargesResult } from "@/lib/pos/billing-settings";

export type KasirOrderType = "dine_in" | "takeaway";

export function KasirCartSheet({
  open,
  onClose,
  cart,
  subtotal,
  bill,
  orderType,
  onOrderType,
  customerName,
  onCustomerName,
  note,
  onNote,
  onQuantity,
  onClear,
  onPay,
  blockedReason,
}: {
  open: boolean;
  onClose: () => void;
  cart: CartLine[];
  subtotal: number;
  bill: BillChargesResult;
  orderType: KasirOrderType;
  onOrderType: (value: KasirOrderType) => void;
  customerName: string;
  onCustomerName: (value: string) => void;
  note: string;
  onNote: (value: string) => void;
  onQuantity: (cartId: string, delta: number) => void;
  onClear: () => void;
  onPay: () => void;
  /** Alasan tombol Bayar dimatikan (mis. shift belum dibuka). */
  blockedReason?: string | null;
}) {
  const totalItems = cart.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`Pesanan (${totalItems} item)`}
      footer={
        <div className="space-y-2">
          {blockedReason && <p className="text-center text-xs font-semibold text-red-600">{blockedReason}</p>}
          <button
            type="button"
            onClick={onPay}
            disabled={cart.length === 0 || Boolean(blockedReason)}
            className="flex h-13 w-full items-center justify-between rounded-2xl bg-primary px-5 py-3 text-white shadow-lg shadow-black/10 disabled:opacity-50"
          >
            <span className="text-sm font-bold">Bayar</span>
            <span className="text-lg font-black">{formatRupiah(bill.total)}</span>
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-2 rounded-full bg-gray-100 p-1 text-sm font-semibold">
        {(
          [
            ["dine_in", "Makan di tempat"],
            ["takeaway", "Bawa pulang"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onOrderType(value)}
            className={`h-9 rounded-full transition ${orderType === value ? "bg-primary text-white shadow" : "text-gray-600"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-bold text-gray-700">Nama pelanggan (untuk dipanggil)</span>
        <input
          value={customerName}
          onChange={(event) => onCustomerName(event.target.value)}
          placeholder="Opsional, mis. Budi"
          maxLength={40}
          className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-primary"
        />
      </label>

      <ul className="mt-4 divide-y divide-gray-100">
        {cart.map((line) => (
          <li key={line.cartId} className="flex items-start gap-3 py-3">
            {line.image ? (
              <img src={line.image} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
            ) : (
              <div className="size-12 shrink-0 rounded-xl bg-primary/10" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold leading-snug text-gray-900">{line.name}</div>
              {Boolean(line.variantName || line.modifierNames?.length) && (
                <div className="mt-0.5 text-xs text-gray-500">
                  {[line.variantName, ...(line.modifierNames ?? [])].filter(Boolean).join(", ")}
                </div>
              )}
              <div className="mt-1 text-sm font-semibold text-gray-800">{formatRupiah(line.unitPrice * line.quantity)}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onQuantity(line.cartId, -1)}
                className="flex size-8 items-center justify-center rounded-full border border-primary text-primary"
                aria-label={`Kurangi ${line.name}`}
              >
                {line.quantity === 1 ? <Trash2 className="size-4" /> : <Minus className="size-4" />}
              </button>
              <span className="w-5 text-center text-sm font-bold">{line.quantity}</span>
              <button
                type="button"
                onClick={() => onQuantity(line.cartId, 1)}
                className="flex size-8 items-center justify-center rounded-full bg-primary text-white"
                aria-label={`Tambah ${line.name}`}
              >
                <Plus className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <label className="mt-2 block">
        <span className="text-xs font-bold text-gray-700">Catatan pesanan</span>
        <textarea
          value={note}
          onChange={(event) => onNote(event.target.value)}
          placeholder="Mis. tidak pedas, sambal dipisah"
          rows={2}
          maxLength={200}
          className="mt-1 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </label>

      <dl className="mt-4 space-y-1.5 rounded-2xl bg-gray-50 p-4 text-sm">
        <div className="flex justify-between text-gray-600">
          <dt>Subtotal</dt>
          <dd>{formatRupiah(subtotal)}</dd>
        </div>
        {bill.breakdown.map((line) => (
          <div key={line.code} className="flex justify-between text-gray-600">
            <dt>{line.name}</dt>
            <dd>{formatRupiah(line.amount)}</dd>
          </div>
        ))}
        <div className="flex justify-between border-t border-dashed border-gray-200 pt-2 text-base font-black text-gray-900">
          <dt>Total</dt>
          <dd>{formatRupiah(bill.total)}</dd>
        </div>
      </dl>

      {cart.length > 0 && (
        <button type="button" onClick={onClear} className="mt-3 w-full text-center text-xs font-semibold text-red-600">
          Kosongkan keranjang
        </button>
      )}
    </BottomSheet>
  );
}
