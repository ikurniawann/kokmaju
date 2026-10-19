"use client";

import { useState } from "react";
import type { AnimatedReceipt } from "@/lib/pos/receipt-animation";
import { receiptBarcodeBars } from "../catalog";
import "./pay-receipt-animation.css";

const rp = (n: number) => `${n < 0 ? "-" : ""}${Math.abs(Math.round(n)).toLocaleString("id-ID")}`;

/**
 * Animasi struk keluar dari printer (referensi reel PathLink "Pay → Receipt",
 * revisi owner: muncul dari printer + potong kertas). Layar printer "Rp …" →
 * "✓ LUNAS", kertas keluar dari celah, pisau memotong, struk lepas. Ganti
 * `key` untuk memutar ulang (mis. tiap Cetak struk). Ketuk untuk melewati.
 * Hanya tampilan layar — kertas asli tetap dari printer thermal.
 */
export function PayReceiptAnimation({
  receipt,
  brandLine,
  subLine,
  cashierName,
  paidAt,
  amountLabel,
}: {
  receipt: AnimatedReceipt;
  /** Judul struk, mis. "GEROBAK KOMA". */
  brandLine: string;
  /** Baris kecil di bawah judul, mis. nama stall. */
  subLine?: string | null;
  cashierName?: string | null;
  paidAt: Date;
  /** Nominal di layar printer sebelum berubah jadi "LUNAS", mis. "Rp 26.400". */
  amountLabel: string;
}) {
  const [instant, setInstant] = useState(false);
  const total = receipt.totals.find((line) => line.strong)?.amount ?? 0;
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
        <div className="prx-feed" aria-hidden>
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
              <div key={index} className="prx-row">
                <span className="n">
                  {item.qty}× {item.name}
                  {item.detail ? <span className="d">{item.detail}</span> : null}
                </span>
                <span className="a">{rp(item.amount)}</span>
              </div>
            ))}
            {receipt.hiddenItems ? (
              <div className="prx-row muted">
                <span className="n">+{receipt.hiddenItems} item lain</span>
              </div>
            ) : null}
            <hr className="prx-rule" />
            {receipt.totals.map((line) => (
              <div
                key={line.label}
                className={`prx-row${line.strong ? " strong" : ""}${line.tone ? ` ${line.tone}` : ""}`}
              >
                <span className="n">{line.strong ? line.label.toUpperCase() : line.label}</span>
                <span className="a">{line.strong ? `Rp ${rp(line.amount)}` : rp(line.amount)}</span>
              </div>
            ))}
            {receipt.method ? (
              <div className="prx-row muted" style={{ marginTop: 4 }}>
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

        <div className="prx-printer" aria-hidden>
          <div className="prx-slot">
            <i className="prx-blade" />
          </div>
          <div className="prx-flash" />
          <div className="prx-face">
            <div className="prx-lcd">
              <span className="prx-lcd-pay">{amountLabel}</span>
              <span className="prx-lcd-paid">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.2 4.2L19 7" />
                </svg>
                LUNAS
              </span>
            </div>
            <div className="prx-side">
              <span className="prx-logo">KoMa</span>
              <span className="prx-led" />
            </div>
          </div>
          <span className="prx-press" />
        </div>
      </div>
    </div>
  );
}
