"use client";

import { useState } from "react";
import type { AnimatedReceipt } from "@/lib/pos/receipt-animation";
import { receiptBarcodeBars } from "../catalog";
import "./pay-receipt-animation.css";

const rp = (n: number) => `${n < 0 ? "-" : ""}${Math.abs(Math.round(n)).toLocaleString("id-ID")}`;

/** Detik mulai baris struk tampil (setelah kertas mulai naik). */
const LINES_START = 1.05;

/**
 * Animasi "Bayar → Struk" (referensi reel PathLink "Pay → Receipt"): tombol
 * bayar ditekan → jadi pil "Lunas" hijau → kertas struk naik keluar dari balik
 * tombol, baris muncul berurutan. Ganti `key` untuk memutar ulang (mis. tiap
 * Cetak struk). Ketuk untuk melewati. Hanya tampilan layar — kertas asli tetap
 * dari printer thermal.
 */
export function PayReceiptAnimation({
  receipt,
  brandLine,
  subLine,
  cashierName,
  paidAt,
  payLabel,
}: {
  receipt: AnimatedReceipt;
  /** Judul struk, mis. "GEROBAK KOMA". */
  brandLine: string;
  /** Baris kecil di bawah judul, mis. nama stall. */
  subLine?: string | null;
  cashierName?: string | null;
  paidAt: Date;
  /** Teks tombol sebelum berubah jadi "Lunas", mis. "Bayar Rp 26.400". */
  payLabel: string;
}) {
  const [instant, setInstant] = useState(false);
  const total = receipt.totals.find((line) => line.strong)?.amount ?? 0;
  const lineCount = receipt.items.length + (receipt.hiddenItems ? 1 : 0) + receipt.totals.length;
  const step = Math.min(0.11, 0.85 / Math.max(1, lineCount));
  const delay = (index: number) => ({ animationDelay: `${(LINES_START + step * index).toFixed(2)}s` });
  const totalsOffset = receipt.items.length + (receipt.hiddenItems ? 1 : 0);
  const bars = receiptBarcodeBars(receipt.orderNumber ?? "");
  const when = paidAt.toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className={`prx${instant ? " instant" : ""}`}
      role="img"
      aria-label={`Pembayaran lunas. Total Rp ${rp(total)}${receipt.queue ? `, antrian ${receipt.queue}` : ""}`}
      onClick={() => setInstant(true)}
    >
      <div className="prx-stage">
        <div className="prx-clip" aria-hidden>
          <div className="prx-paper">
            <div className="prx-head">
              <div className="prx-brand">{brandLine}</div>
              {subLine ? <div className="prx-sub">{subLine}</div> : null}
            </div>
            <div className="prx-meta">
              <span>{receipt.orderNumber ?? "-"}</span>
              <span>{when}</span>
            </div>
            {cashierName ? (
              <div className="prx-meta" style={{ marginTop: 2 }}>
                <span>Kasir</span>
                <span>{cashierName}</span>
              </div>
            ) : null}
            {receipt.queue ? (
              <div className="prx-queue">
                <small>NO. ANTRIAN</small>
                <b>{receipt.queue}</b>
              </div>
            ) : null}
            <hr className="prx-rule" />
            {receipt.items.map((item, index) => (
              <div key={index} className="prx-row prx-line" style={delay(index)}>
                <span className="n">
                  {item.qty}× {item.name}
                  {item.detail ? <span className="d">{item.detail}</span> : null}
                </span>
                <span className="a">{rp(item.amount)}</span>
              </div>
            ))}
            {receipt.hiddenItems ? (
              <div className="prx-row prx-line muted" style={delay(receipt.items.length)}>
                <span className="n">+{receipt.hiddenItems} item lain</span>
              </div>
            ) : null}
            <hr className="prx-rule" />
            {receipt.totals.map((line, index) => (
              <div
                key={line.label}
                className={`prx-row prx-line${line.strong ? " strong" : ""}${line.tone ? ` ${line.tone}` : ""}`}
                style={delay(totalsOffset + index)}
              >
                <span className="n">{line.strong ? line.label.toUpperCase() : line.label}</span>
                <span className="a">{line.strong ? `Rp ${rp(line.amount)}` : rp(line.amount)}</span>
              </div>
            ))}
            {receipt.method ? (
              <div className="prx-row prx-line muted" style={{ ...delay(lineCount), marginTop: 4 }}>
                <span className="n">Dibayar</span>
                <span className="a">{receipt.method}</span>
              </div>
            ) : null}
            <div className="prx-barcode">
              {bars.map((width, index) => (
                <i key={index} style={{ width }} />
              ))}
            </div>
            <div className="prx-thanks">TERIMA KASIH · SAMPAI JUMPA</div>
          </div>
        </div>

        <div className="prx-pill" aria-hidden>
          <span className="prx-pay">{payLabel}</span>
          <span className="prx-paid">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.2 4.2L19 7" />
            </svg>
            Lunas
          </span>
        </div>
      </div>
    </div>
  );
}
