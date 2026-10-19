"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bike,
  Box,
  ChartLine,
  Coffee,
  Expand,
  Home,
  Loader2,
  Megaphone,
  Minus,
  Pause,
  Play,
  Plus,
  Receipt,
  Truck,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { createDemoState, demoSnapshot, stepDemo, type DemoState } from "@/lib/bcd-twin/demo";
import { diffSnapshots, type TwinEvent } from "@/lib/bcd-twin/events";
import type { TwinOrder, TwinSnapshot } from "@/lib/bcd-twin/types";
import { summarizeZone, zoneById, ZONES, type ZoneDef, type ZoneId } from "@/lib/bcd-twin/zones";
import type { CafeScene } from "../scene/cafe-scene";
import "./bcd-twin.css";

const ZONE_ICON: Record<ZoneDef["icon"], LucideIcon> = {
  register: Receipt,
  cup: Coffee,
  table: UtensilsCrossed,
  bike: Bike,
  box: Box,
  truck: Truck,
  people: Users,
  megaphone: Megaphone,
  chart: ChartLine,
};

const STEPS = [
  { key: "pending", label: "Diterima" },
  { key: "confirmed", label: "Dikonfirmasi" },
  { key: "preparing", label: "Diracik" },
  { key: "ready", label: "Siap" },
  { key: "served", label: "Diantar" },
];
const STEP_INDEX: Record<string, number> = { pending: 0, confirmed: 1, preparing: 2, ready: 3, served: 4, completed: 5 };
const CHANNEL_LABEL: Record<TwinOrder["channel"], string> = { kasir: "Kasir", self_order: "Self-order", gofood: "GoFood" };
const SPEEDS = [1, 2, 4];
const LIVE_POLL_MS = 15_000;

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const rpShort = (n: number) =>
  n >= 1_000_000 ? `Rp ${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt` : rp(n);

async function fetchLiveSnapshot(): Promise<TwinSnapshot> {
  const response = await fetch("/api/dashboard/bcd-twin", { cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as { success?: boolean; data?: TwinSnapshot; error?: string };
  if (!response.ok || !body.data) throw new Error(body.error || "Gagal memuat data KoMa Twin");
  return body.data;
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta" });
}

export function BcdTwinPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CafeScene | null>(null);
  const pendingEvents = useRef<TwinEvent[]>([]);
  const prevLive = useRef<TwinSnapshot | null>(null);
  const demoRef = useRef<DemoState | null>(null);

  const [mode, setMode] = useState<"live" | "demo">("live");
  const [demoSnap, setDemoSnap] = useState<TwinSnapshot | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState<ZoneId | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const clock = useClock();

  const live = useQuery({
    queryKey: ["bcd-twin", "live"],
    queryFn: fetchLiveSnapshot,
    refetchInterval: mode === "live" ? LIVE_POLL_MS : false,
    enabled: mode === "live",
  });

  const snapshot = mode === "demo" ? demoSnap : live.data ?? null;

  const emit = useCallback((events: TwinEvent[]) => {
    if (!events.length) return;
    if (sceneRef.current) sceneRef.current.handleEvents(events);
    else pendingEvents.current.push(...events);
  }, []);

  // --- scene 3D (three.js dimuat hanya di halaman ini) ---
  useEffect(() => {
    let cancelled = false;
    let scene: CafeScene | null = null;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    import("../scene/cafe-scene")
      .then(({ CafeScene }) => {
        if (cancelled || !stageRef.current || !labelsRef.current) return;
        scene = new CafeScene(stageRef.current, labelsRef.current, {
          onSelect: (zone) => setSelected(zone),
          reducedMotion: reduced,
        });
        sceneRef.current = scene;
        setSceneReady(true);
        if (pendingEvents.current.length) {
          scene.handleEvents(pendingEvents.current.splice(0));
        }
      })
      .catch((error: unknown) => {
        console.error("[bcd-twin] scene:", error);
        setSceneError("Peta 3D tidak bisa dimuat di perangkat ini (WebGL).");
      });

    const html = document.documentElement;
    const observer = new MutationObserver(() => sceneRef.current?.applyTheme());
    observer.observe(html, { attributes: true, attributeFilter: ["data-theme"] });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onMedia = () => sceneRef.current?.applyTheme();
    media.addEventListener("change", onMedia);

    return () => {
      cancelled = true;
      observer.disconnect();
      media.removeEventListener("change", onMedia);
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Snapshot → scene (warna lampu, pin, meja).
  useEffect(() => {
    if (snapshot && sceneReady) sceneRef.current?.setSnapshot(snapshot);
  }, [snapshot, sceneReady]);

  // Live: animasikan selisih antar polling.
  useEffect(() => {
    if (mode !== "live" || !live.data) return;
    emit(diffSnapshots(prevLive.current, live.data));
    prevLive.current = live.data;
  }, [live.data, mode, emit]);

  // Demo: simulator berjalan di klien.
  useEffect(() => {
    if (mode !== "demo") return;
    if (!demoRef.current) demoRef.current = createDemoState(Date.now() % 100000);
    const state = demoRef.current;
    setDemoSnap(demoSnapshot(state));
    if (paused) return;
    const TICK = 250;
    let sinceUi = 0;
    const id = window.setInterval(() => {
      const events = stepDemo(state, (TICK / 1000) * speed);
      emit(events);
      sinceUi += TICK;
      if (events.length || sinceUi >= 1000) {
        sinceUi = 0;
        setDemoSnap(demoSnapshot(state));
      }
    }, TICK);
    return () => window.clearInterval(id);
  }, [mode, paused, speed, emit]);

  const switchMode = (next: "live" | "demo") => {
    if (next === mode) return;
    prevLive.current = null;
    setOrderId(null);
    setMode(next);
  };

  const selectZone = (zone: ZoneId | null) => {
    setSelected(zone);
    sceneRef.current?.select(zone, Boolean(zone));
  };

  const toggleFullscreen = () => {
    const root = rootRef.current;
    if (!root) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.requestFullscreen?.();
  };

  const orders = snapshot?.orders ?? [];
  const trackedOrder = orders.find((o) => o.id === orderId) ?? orders[0] ?? null;

  const kpis = useMemo(() => {
    if (!snapshot) return [];
    const queue = snapshot.kitchen.pending + snapshot.kitchen.preparing;
    return [
      { zone: "kasir" as ZoneId, icon: Receipt, label: "Omzet hari ini", value: rpShort(snapshot.sales.revenueToday), tone: "" },
      { zone: "kasir" as ZoneId, icon: Coffee, label: "Order hari ini", value: snapshot.sales.ordersToday.toLocaleString("id-ID"), tone: "" },
      { zone: "bar" as ZoneId, icon: UtensilsCrossed, label: "Antrean bar", value: String(queue), tone: queue > 15 ? "bad" : queue > 8 ? "warn" : "" },
      { zone: "seating" as ZoneId, icon: Users, label: "Meja terisi", value: `${snapshot.tables.occupied}/${snapshot.tables.total}`, tone: "" },
      { zone: "gudang" as ZoneId, icon: Box, label: "Stok menipis", value: String(snapshot.inventory.low), tone: snapshot.inventory.out ? "bad" : snapshot.inventory.low ? "warn" : "" },
      { zone: "hrd" as ZoneId, icon: Users, label: "Tim hadir", value: `${snapshot.hr.present}/${snapshot.hr.active}`, tone: snapshot.hr.late ? "warn" : "" },
    ];
  }, [snapshot]);

  const quietLive = mode === "live" && snapshot && snapshot.sales.ordersToday === 0 && snapshot.orders.length === 0;

  return (
    <div ref={rootRef} className="bcd-twin h-[calc(100dvh-7.5rem)] min-h-[560px]">
      <div ref={stageRef} className="tw-stage" aria-label="Peta 3D KoMa" />
      <div ref={labelsRef} className="tw-labels" />
      {!sceneReady && !sceneError ? (
        <div className="tw-loading">
          <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Menyiapkan coffee shop…</span>
        </div>
      ) : null}
      {sceneError ? <div className="tw-loading">{sceneError}</div> : null}

      <header className="tw-top">
        <div className="tw-card tw-brand">
          <div className="tw-logo"><Coffee className="h-[18px] w-[18px]" /></div>
          <div>
            <b>KoMa Twin</b>
            <small>{snapshot?.outlet ?? "KoMa"} · coffee shop live</small>
          </div>
        </div>
        <div className="tw-card tw-seg" role="group" aria-label="Sumber data">
          <button type="button" aria-pressed={mode === "live"} onClick={() => switchMode("live")}>Live</button>
          <button type="button" aria-pressed={mode === "demo"} onClick={() => switchMode("demo")}>Mode demo</button>
        </div>
        <div className="tw-spacer" />
        <div className="tw-card tw-chip clock">
          <span className={`tw-live${mode === "demo" ? " demo" : ""}`} />
          <div>
            <b>{clock}</b>
            <small>
              {mode === "demo"
                ? paused ? "Simulasi dijeda" : `Simulasi · ${speed}×`
                : live.isFetching ? "Memperbarui…" : `Live · tiap ${LIVE_POLL_MS / 1000} dtk`}
            </small>
          </div>
        </div>
        <button type="button" className="tw-card tw-iconbtn" onClick={toggleFullscreen} title="Layar penuh" aria-label="Layar penuh">
          <Expand className="h-4 w-4" />
        </button>
      </header>

      <section className="tw-kpis" aria-label="Ringkasan">
        {kpis.map((kpi) => (
          <button key={kpi.label} type="button" className="tw-card tw-kpi" data-tone={kpi.tone} onClick={() => selectZone(kpi.zone)}>
            <span className="ico"><kpi.icon className="h-4 w-4" /></span>
            <span><b>{kpi.value}</b><small>{kpi.label}</small></span>
          </button>
        ))}
      </section>

      {live.error && mode === "live" ? (
        <div className="tw-card tw-banner">{(live.error as Error).message}</div>
      ) : quietLive ? (
        <div className="tw-card tw-banner">
          Belum ada transaksi hari ini — peta akan bergerak saat order masuk.
          <button type="button" onClick={() => switchMode("demo")}>Coba mode demo</button>
        </div>
      ) : null}

      <nav className="tw-card tw-ctl" aria-label="Kontrol peta">
        <button type="button" className="tw-iconbtn" onClick={() => sceneRef.current?.zoom(0.75)} aria-label="Perbesar" title="Perbesar"><Plus className="h-4 w-4" /></button>
        <button type="button" className="tw-iconbtn" onClick={() => sceneRef.current?.zoom(1.33)} aria-label="Perkecil" title="Perkecil"><Minus className="h-4 w-4" /></button>
        <button type="button" className="tw-iconbtn" onClick={() => { selectZone(null); sceneRef.current?.goHome(); }} aria-label="Tampilan awal" title="Tampilan awal"><Home className="h-4 w-4" /></button>
        {mode === "demo" ? (
          <>
            <hr />
            <button type="button" className="tw-iconbtn" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Lanjutkan simulasi" : "Jeda simulasi"} title={paused ? "Lanjut" : "Jeda"}>
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button
              type="button"
              className="tw-iconbtn text-[12px] font-bold"
              onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])}
              aria-label="Kecepatan simulasi"
              title="Kecepatan simulasi"
            >
              {speed}×
            </button>
          </>
        ) : null}
      </nav>

      <aside className="tw-side">
        <div className="tw-card tw-detail">
          {snapshot ? (
            selected ? (
              <ZoneDetail zone={zoneById(selected)!} snapshot={snapshot} onBack={() => selectZone(null)} />
            ) : (
              <Overview snapshot={snapshot} onSelect={selectZone} />
            )
          ) : (
            <div className="flex items-center gap-2 py-8 text-sm" style={{ color: "var(--tw-muted)" }}>
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat data…
            </div>
          )}
        </div>
      </aside>

      <section className="tw-card tw-trace" aria-label="Alur pesanan">
        <div className="min-w-0 flex-1">
          <div className="tw-eyebrow">
            Alur pesanan{trackedOrder ? ` · ${trackedOrder.queue ? `Antrean ${trackedOrder.queue}` : trackedOrder.number} · ${CHANNEL_LABEL[trackedOrder.channel]}` : ""}
          </div>
          {trackedOrder ? (
            <div className="tw-steps mt-2">
              {STEPS.map((step, i) => {
                const at = STEP_INDEX[trackedOrder.status] ?? 0;
                const cls = i < at ? "done" : i === at ? "cur" : "";
                return (
                  <div key={step.key} className={`tw-step ${cls}`}>
                    <span className="dot">{i < at ? "✓" : i + 1}</span>
                    <span className="mt-1">{step.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-xs" style={{ color: "var(--tw-muted)" }}>Belum ada order hari ini.</p>
          )}
        </div>
        <div className="tw-orders" aria-label="Order terbaru">
          {orders.slice(0, 8).map((order) => (
            <button key={order.id} type="button" aria-pressed={trackedOrder?.id === order.id} onClick={() => setOrderId(order.id)}>
              <b>{order.queue ?? order.number.slice(-4)}</b>
              {CHANNEL_LABEL[order.channel]} · {order.paid ? "lunas" : "belum bayar"}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: "ok" | "warn" | "bad" | "idle" }) {
  const label = { ok: "Normal", warn: "Perlu perhatian", bad: "Kritis", idle: "Sepi" }[status];
  return <span className={`tw-pill ${status === "idle" ? "" : status}`}>{label}</span>;
}

function Overview({ snapshot, onSelect }: { snapshot: TwinSnapshot; onSelect: (zone: ZoneId) => void }) {
  const max = Math.max(1, ...snapshot.sales.trend7);
  return (
    <div>
      <div className="tw-eyebrow">{snapshot.mode === "demo" ? "Mode demo · data simulasi" : "Ringkasan hari ini"}</div>
      <h2>{rp(snapshot.sales.revenueToday)}</h2>
      <p style={{ color: "var(--tw-muted)" }}>
        {snapshot.sales.ordersToday.toLocaleString("id-ID")} order · kemarin {rpShort(snapshot.sales.revenueYesterday)}
      </p>
      <div className="tw-spark" aria-label="Omzet 7 hari">
        {snapshot.sales.trend7.map((value, i) => (
          <span key={i} style={{ height: `${Math.max(6, (value / max) * 100)}%` }} title={rp(value)} />
        ))}
      </div>
      {snapshot.failed.length ? (
        <p className="mt-2 text-[11px]" style={{ color: "var(--tw-warn)" }}>Sebagian data gagal dimuat: {snapshot.failed.join(", ")}</p>
      ) : null}
      <div className="tw-eyebrow mt-4 mb-1">Divisi · klik untuk detail</div>
      {ZONES.map((zone) => {
        const summary = summarizeZone(zone.id, snapshot);
        const Icon = ZONE_ICON[zone.icon];
        return (
          <button key={zone.id} type="button" className="tw-row" onClick={() => onSelect(zone.id)}>
            <span className="flex min-w-0 items-center gap-2">
              <Icon className="h-4 w-4 shrink-0" style={{ color: "var(--tw-coffee)" }} />
              <span className="min-w-0">
                <span className="t block truncate">{zone.name}</span>
                <span className="m block truncate">{summary.headline}</span>
              </span>
            </span>
            <StatusPill status={summary.status} />
          </button>
        );
      })}
    </div>
  );
}

function ZoneDetail({ zone, snapshot, onBack }: { zone: ZoneDef; snapshot: TwinSnapshot; onBack: () => void }) {
  const summary = summarizeZone(zone.id, snapshot);
  const Icon = ZONE_ICON[zone.icon];
  return (
    <div>
      <button type="button" onClick={onBack} className="mb-2 text-[11px] font-semibold" style={{ color: "var(--tw-accent)" }}>
        ‹ Semua divisi
      </button>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "var(--tw-accent-soft)", color: "var(--tw-accent)" }}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="tw-eyebrow">{zone.division}</div>
          <h2>{zone.name}</h2>
          <StatusPill status={summary.status} />
        </div>
      </div>
      <p className="mt-3 font-semibold">{summary.headline}</p>
      <div className="tw-grid">
        {summary.kpis.map((kpi) => (
          <div key={kpi.label} className="tw-stat">
            <small>{kpi.label}</small>
            <b>{kpi.value}</b>
          </div>
        ))}
      </div>
      <ZoneList zone={zone.id} snapshot={snapshot} />
      <Link href={zone.href} className="tw-link">
        Buka {zone.division} <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function ZoneList({ zone, snapshot }: { zone: ZoneId; snapshot: TwinSnapshot }) {
  const statusText: Record<string, string> = {
    pending: "Diterima", confirmed: "Dikonfirmasi", preparing: "Diracik", ready: "Siap", served: "Diantar", completed: "Selesai",
  };
  let rows: { key: string; t: string; m: string; right: string }[] = [];
  if (zone === "kasir" || zone === "bar" || zone === "gofood" || zone === "seating") {
    const list = snapshot.orders.filter((o) =>
      zone === "gofood" ? o.channel === "gofood"
        : zone === "seating" ? o.orderType === "dine_in"
        : zone === "bar" ? !["served", "completed"].includes(o.status)
        : true
    );
    rows = list.slice(0, 6).map((o) => ({
      key: o.id,
      t: `${o.queue ? `#${o.queue}` : o.number} · ${o.customer ?? CHANNEL_LABEL[o.channel]}`,
      m: `${CHANNEL_LABEL[o.channel]} · ${o.items} item${o.table ? ` · meja ${o.table}` : ""} · ${statusText[o.status] ?? o.status}`,
      right: o.paid ? rp(o.total) : "belum bayar",
    }));
  } else if (zone === "gudang") {
    rows = snapshot.inventory.items.map((item) => ({
      key: item.name,
      t: item.name,
      m: item.note ?? "",
      right: `${item.value.toLocaleString("id-ID")}${item.unit ? ` ${item.unit}` : ""}`,
    }));
  } else if (zone === "procurement") {
    rows = snapshot.procurement.recent.map((po) => ({ key: po.number, t: po.number, m: po.status, right: rp(po.total) }));
  }
  if (!rows.length) return null;
  return (
    <div>
      <div className="tw-eyebrow mb-1">Terbaru</div>
      {rows.map((row) => (
        <div key={row.key} className="tw-row">
          <span className="min-w-0">
            <span className="t block truncate">{row.t}</span>
            <span className="m block truncate">{row.m}</span>
          </span>
          <span className="shrink-0 font-mono text-[12px] font-bold">{row.right}</span>
        </div>
      ))}
    </div>
  );
}
