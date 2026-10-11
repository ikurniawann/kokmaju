"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, LogOut, X } from "lucide-react";
import { idrToArkDisplay } from "@/lib/pos/loyalty-settings";
import { memberQrValue } from "@/lib/pos/customer-search";
import {
  createHangingState,
  dragAngle,
  isAtRest,
  stepHanging,
  type HangingState,
} from "@/lib/table-order/hanging-physics";
import { formatRupiah } from "@/lib/table-order/menu";
import type { MemberProfile } from "../api";
import { lockPageScroll } from "./sheet";
import "./member-card-screen.css";

const STRING_PX = 54;
const TAG_STRING_PX = 26;
const BOKEH = [
  { left: "8%", top: "18%", size: 120, delay: "0s" },
  { left: "70%", top: "8%", size: 160, delay: "-3s" },
  { left: "78%", top: "58%", size: 110, delay: "-5s" },
  { left: "-6%", top: "64%", size: 150, delay: "-7s" },
];

function Leaf({ left, flip }: { left: string; flip?: boolean }) {
  return (
    <svg className="mcs-leaf" style={{ left, transform: flip ? "scaleX(-1)" : undefined }} viewBox="0 0 34 22" aria-hidden>
      <path d="M2 18 C 8 2, 26 0, 32 4 C 28 16, 12 22, 2 18 Z" fill="#5f9b4f" />
      <path d="M4 17 C 12 12, 22 8, 31 5" stroke="#3f7a35" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

/**
 * Kartu member self-order layar penuh (owner 2026-10-11): kartu jatuh &
 * berayun pada tali dari rel kayu, bisa ditarik jari lalu memantul; tag
 * "Total belanja" ikut berayun di bawahnya. QR = ID member (dipindai kasir
 * ke Find Customer).
 */
export function MemberCardScreen({
  open,
  member,
  arkEnabled,
  xpEnabled,
  busy,
  onClose,
  onLogout,
}: {
  open: boolean;
  member: MemberProfile | null;
  arkEnabled: boolean;
  xpEnabled: boolean;
  busy: boolean;
  onClose: () => void;
  onLogout: () => void;
}) {
  const hangRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const physics = useRef<HangingState>(createHangingState());
  const drag = useRef<{ pointerId: number; startX: number; arm: number; last: number; lastAt: number; velocity: number } | null>(null);
  const [reduced] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    if (!open) return;
    const unlock = lockPageScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      unlock();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    physics.current = reduced ? createHangingState(0, 0) : createHangingState();
    let raf = 0;
    let last = performance.now();
    let breezeIn = 3.5;
    const frame = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      let state = stepHanging(physics.current, dt, Boolean(drag.current));
      // Angin sepoi: dorongan kecil saat hampir diam, supaya kartu "hidup".
      breezeIn -= dt;
      if (!reduced && !drag.current && breezeIn <= 0) {
        breezeIn = 3 + Math.random() * 3;
        if (isAtRest(state) || Math.abs(state.card.velocity) < 0.05) {
          state = { ...state, card: { ...state.card, velocity: state.card.velocity + (Math.random() - 0.5) * 0.35 } };
        }
      }
      physics.current = state;
      if (hangRef.current) {
        hangRef.current.style.transform = `translateY(${state.drop.y.toFixed(1)}px) rotate(${state.card.angle.toFixed(4)}rad)`;
      }
      if (tagRef.current) tagRef.current.style.transform = `rotate(${state.tag.angle.toFixed(4)}rad)`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [open, reduced]);

  if (!open || !member) return null;

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (reduced) return;
    const card = event.currentTarget;
    card.setPointerCapture(event.pointerId);
    const rect = hangRef.current?.getBoundingClientRect();
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX - physics.current.card.angle * (rect?.height ?? 400),
      arm: rect?.height ?? 400,
      last: physics.current.card.angle,
      lastAt: performance.now(),
      velocity: 0,
    };
  };
  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    const angle = dragAngle(event.clientX - d.startX, d.arm);
    const now = performance.now();
    const dt = Math.max(1, now - d.lastAt) / 1000;
    d.velocity = d.velocity * 0.6 + ((angle - d.last) / dt) * 0.4;
    d.last = angle;
    d.lastAt = now;
    physics.current = { ...physics.current, card: { angle, velocity: 0 } };
  };
  const onPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    drag.current = null;
    // Dilepas → berayun dgn kecepatan geseran terakhir.
    physics.current = { ...physics.current, card: { ...physics.current.card, velocity: Math.max(-6, Math.min(6, d.velocity)) } };
  };

  const since = member.member_since
    ? new Date(member.member_since).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" })
    : null;

  return (
    <div className="mcs" role="dialog" aria-modal="true" aria-label="Kartu member">
      <div className="mcs-bokeh" aria-hidden>
        {BOKEH.map((b, i) => (
          <span key={i} style={{ left: b.left, top: b.top, width: b.size, height: b.size, animationDelay: b.delay }} />
        ))}
      </div>
      <header className="mcs-head">
        <h2>Kartu Member</h2>
        <button type="button" className="mcs-close" onClick={onClose} aria-label="Tutup kartu member">
          <X className="size-5" />
        </button>
      </header>

      <div className="mcs-stage">
        <div className="mcs-rail" aria-hidden />
        <Leaf left="12%" />
        <Leaf left="26%" flip />
        <Leaf left="68%" />
        <Leaf left="82%" flip />

        <div ref={hangRef} className="mcs-hang" style={{ transform: "translateY(-900px)" }}>
          <div className="mcs-string" style={{ height: STRING_PX }} />
          <div className="mcs-clip" />
          <article
            className="mcs-card"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div className="mcs-brand">
              <span>BCD COFFEE · MEMBER</span>
              {member.tier ? <span className="mcs-tier">{member.tier.name.toUpperCase()}</span> : null}
            </div>
            <div className="mcs-who">
              <div className="mcs-avatar">{member.name.trim().charAt(0).toUpperCase() || "M"}</div>
              <div className="min-w-0">
                <div className="mcs-name">{member.name}</div>
                <div className="mcs-phone">{member.phone}</div>
              </div>
            </div>
            <div className="mcs-qr">
              <QRCodeSVG value={memberQrValue(member.id)} size={150} level="M" fgColor="#0f1430" />
            </div>
            <div className="mcs-qr-caption">Tunjukkan QR ini ke kasir</div>
            {since ? <div className="mcs-since">Member sejak {since}</div> : null}

            <div ref={tagRef} className="mcs-tag-hang">
              <div className="mcs-string" style={{ height: TAG_STRING_PX }} />
              <div className="mcs-tag">
                <small>TOTAL BELANJA</small>
                <b>{formatRupiah(member.total_spent)}</b>
                <span>{member.visit_count.toLocaleString("id-ID")} kunjungan</span>
              </div>
            </div>
          </article>
        </div>
      </div>

      <footer className="mcs-foot">
        {(arkEnabled || xpEnabled) && (
          <div className="mcs-stats">
            {arkEnabled ? (
              <div className="mcs-stat">
                <small>Saldo ARK Coin</small>
                <b>{idrToArkDisplay(member.ark_coin_balance, member.ark_rate)}</b>
              </div>
            ) : null}
            {xpEnabled ? (
              <div className="mcs-stat">
                <small>Total XP</small>
                <b>{new Intl.NumberFormat("id-ID").format(member.total_xp)}</b>
              </div>
            ) : null}
          </div>
        )}
        <div className="mcs-hint">Geser kartu untuk mengayunkan · harga member berlaku otomatis</div>
        <button type="button" className="mcs-logout" onClick={onLogout} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
          Keluar dari akun member
        </button>
      </footer>
    </div>
  );
}
