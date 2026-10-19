"use client";

import { useEffect, useState } from "react";
import type { AnimatedReceipt } from "@/lib/pos/receipt-animation";
import "./receipt-printer-animation.css";

const FEED_MS = 1900;

const rp = (n: number) => `${n < 0 ? "-" : ""}Rp ${Math.abs(Math.round(n)).toLocaleString("id-ID")}`;

/**
 * Struk keluar dari printer (animasi layar). Ganti `key` untuk memutar ulang
 * (mis. tiap tombol Print Struk ditekan). Ketuk untuk melewati animasi.
 */
export function ReceiptPrinterAnimation({
  receipt,
  size = "sm",
  title = "Pembayaran berhasil",
}: {
  receipt: AnimatedReceipt;
  size?: "sm" | "lg";
  title?: string;
}) {
  const [instant, setInstant] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setDone(true), FEED_MS + 300);
    return () => window.clearTimeout(id);
  }, []);

  // Baris struk muncul berurutan selama kertas keluar.
  const lines = receipt.items.length + receipt.totals.length + (receipt.hiddenItems ? 1 : 0);
  const step = Math.min(0.12, (FEED_MS / 1000 - 0.4) / Math.max(1, lines));
  const delay = (index: number) => ({ animationDelay: `${0.35 + step * index}s` });
  const totalsOffset = receipt.items.length + (receipt.hiddenItems ? 1 : 0);

  return (
    <div
      className={`rcpt${instant ? " instant" : ""}${done ? " done" : ""}`}
      data-size={size}
      role="img"
      aria-label={`${title}. Total ${rp(receipt.totals.find((t) => t.strong)?.amount ?? 0)}`}
      onClick={() => setInstant(true)}
    >
      <div className={`rcpt-printer${!instant && !done ? " printing" : ""}`} aria-hidden>
        <span className="rcpt-brand">KoMa</span>
        <span className="rcpt-led" />
      </div>
      <div className="rcpt-clip" aria-hidden>
        <div className="rcpt-paper">
          <div className="rcpt-check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.2 4.2L19 7" />
            </svg>
          </div>
          <div className="rcpt-title">{title}</div>
          <div className="rcpt-outlet">{receipt.outlet}</div>
          {receipt.queue ? (
            <div className="rcpt-queue">
              <small>ANTREAN</small>
              <b>{receipt.queue}</b>
            </div>
          ) : null}
          {receipt.orderNumber ? <div className="rcpt-meta">{receipt.orderNumber}</div> : null}
          <hr className="rcpt-rule" />
          {receipt.items.map((item, i) => (
            <div key={i} className="rcpt-row rcpt-line" style={delay(i)}>
              <span className="n">
                {item.qty}× {item.name}
                {item.detail ? <span className="d">{item.detail}</span> : null}
              </span>
              <span className="a">{rp(item.amount)}</span>
            </div>
          ))}
          {receipt.hiddenItems ? (
            <div className="rcpt-row rcpt-line muted" style={delay(receipt.items.length)}>
              <span className="n">+{receipt.hiddenItems} item lain</span>
            </div>
          ) : null}
          <hr className="rcpt-rule" />
          {receipt.totals.map((total, i) => (
            <div
              key={total.label}
              className={`rcpt-row rcpt-line${total.strong ? " strong" : ""}${total.tone ? ` ${total.tone}` : ""}`}
              style={delay(totalsOffset + i)}
            >
              <span className="n">{total.label}</span>
              <span className="a">{rp(total.amount)}</span>
            </div>
          ))}
          {receipt.method ? <div className="rcpt-meta" style={{ marginTop: 6 }}>Dibayar · {receipt.method}</div> : null}
          <div className="rcpt-bar" />
          <div className="rcpt-thanks">Terima kasih ☕</div>
        </div>
      </div>
    </div>
  );
}
