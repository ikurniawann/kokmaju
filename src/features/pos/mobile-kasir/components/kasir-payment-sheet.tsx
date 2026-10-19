"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import { Banknote, CreditCard, Delete, Loader2, QrCode } from "lucide-react";
import { BottomSheet } from "@/features/table-order/components/sheet";
import { formatRupiah } from "@/lib/table-order/menu";
import { quickCashAmounts, type KasirPaymentOption } from "../catalog";

const KIND_ICON = { cash: Banknote, static_qris: QrCode, manual: CreditCard } as const;

export type KasirPaymentSubmit = { option: KasirPaymentOption; cashReceived: number };

/**
 * Bayar di HP kasir: pilih metode → tunai (keypad + nominal cepat + kembalian),
 * Static QRIS (tampilkan QR ke pelanggan, kasir konfirmasi), atau non-tunai
 * manual (EDC/transfer, kasir konfirmasi).
 */
export function KasirPaymentSheet({
  open,
  onClose,
  total,
  options,
  staticQrisImageUrl,
  submitting,
  error,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  total: number;
  options: KasirPaymentOption[];
  staticQrisImageUrl: string | null;
  submitting: boolean;
  error: string | null;
  onSubmit: (value: KasirPaymentSubmit) => void;
}) {
  if (!open) return null;
  return (
    <PaymentBody
      key={`${total}-${options.map((option) => option.code).join(",")}`}
      onClose={onClose}
      total={total}
      options={options}
      staticQrisImageUrl={staticQrisImageUrl}
      submitting={submitting}
      error={error}
      onSubmit={onSubmit}
    />
  );
}

function PaymentBody({
  onClose,
  total,
  options,
  staticQrisImageUrl,
  submitting,
  error,
  onSubmit,
}: Omit<Parameters<typeof KasirPaymentSheet>[0], "open">) {
  const [code, setCode] = useState(options[0]?.code ?? "");
  const [cashText, setCashText] = useState("");
  const selected = options.find((option) => option.code === code) ?? options[0];
  const cash = Number(cashText || 0);
  const quick = useMemo(() => quickCashAmounts(total), [total]);
  const isCash = selected?.kind === "cash";
  const change = isCash ? cash - total : 0;
  const cashShort = isCash && cash < total;

  function pressKey(key: string) {
    setCashText((current) => {
      if (key === "del") return current.slice(0, -1);
      const next = `${current}${key}`.replace(/^0+/, "");
      return next.length > 9 ? current : next;
    });
  }

  const confirmLabel = !selected
    ? "Tidak ada metode bayar"
    : isCash
      ? cashShort
        ? `Kurang ${formatRupiah(total - cash)}`
        : `Terima tunai · kembali ${formatRupiah(change)}`
      : selected.kind === "static_qris"
        ? "Pembayaran QRIS sudah masuk"
        : `Konfirmasi ${selected.name}`;

  return (
    <BottomSheet
      open
      onClose={submitting ? () => undefined : onClose}
      title="Pembayaran"
      footer={
        <div className="space-y-2">
          {error && <p className="text-center text-xs font-semibold text-red-600">{error}</p>}
          <button
            type="button"
            disabled={!selected || cashShort || submitting}
            onClick={() => selected && onSubmit({ option: selected, cashReceived: isCash ? cash : total })}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-black/10 disabled:opacity-50"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="rounded-2xl bg-primary/5 p-4 text-center">
        <div className="text-xs font-semibold text-gray-600">Total tagihan</div>
        <div className="mt-1 text-3xl font-black tracking-tight text-gray-900">{formatRupiah(total)}</div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {options.map((option) => {
          const Icon = KIND_ICON[option.kind];
          const active = option.code === selected?.code;
          return (
            <button
              key={option.code}
              type="button"
              onClick={() => setCode(option.code)}
              className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition ${
                active ? "bg-primary text-white shadow" : "bg-white text-gray-700 ring-1 ring-gray-200"
              }`}
            >
              <Icon className="size-4" />
              {option.name}
            </button>
          );
        })}
      </div>

      {isCash && (
        <div className="mt-4">
          <div className="flex items-end justify-between rounded-2xl border border-gray-200 px-4 py-3">
            <span className="text-xs font-semibold text-gray-500">Uang diterima</span>
            <span className="text-2xl font-black text-gray-900">{formatRupiah(cash)}</span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {quick.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setCashText(String(amount))}
                className="h-10 rounded-xl bg-amber-50 text-xs font-bold text-amber-800 ring-1 ring-amber-200"
              >
                {amount === total ? "Uang pas" : formatRupiah(amount).replace("Rp", "").trim()}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "del"].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => pressKey(key)}
                className="flex h-12 items-center justify-center rounded-xl bg-gray-100 text-lg font-bold text-gray-900 active:bg-gray-200"
                aria-label={key === "del" ? "Hapus angka" : key}
              >
                {key === "del" ? <Delete className="size-5" /> : key}
              </button>
            ))}
          </div>
          {!cashShort && cash > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-800">
              <span className="text-sm font-semibold">Kembalian</span>
              <span className="text-xl font-black">{formatRupiah(change)}</span>
            </div>
          )}
        </div>
      )}

      {selected?.kind === "static_qris" && (
        <div className="mt-4 text-center">
          {staticQrisImageUrl ? (
            <img
              src={staticQrisImageUrl}
              alt="QRIS"
              className="mx-auto w-full max-w-[280px] rounded-2xl border border-gray-200 bg-white p-2"
            />
          ) : null}
          <p className="mt-2 text-xs leading-relaxed text-gray-600">
            Tunjukkan QR ke pelanggan. Tekan konfirmasi setelah notifikasi dana {formatRupiah(total)} masuk.
          </p>
        </div>
      )}

      {selected?.kind === "manual" && (
        <p className="mt-4 rounded-2xl bg-gray-50 p-4 text-center text-xs leading-relaxed text-gray-600">
          Proses pembayaran {formatRupiah(total)} di mesin/rekening {selected.name}, lalu tekan konfirmasi.
        </p>
      )}
    </BottomSheet>
  );
}
