"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Download, IdCard, QrCode, Share, ShoppingBag, Sparkles, UserRound } from "lucide-react";
import { idrToArkDisplay } from "@/lib/pos/loyalty-settings";
import { formatRupiah } from "@/lib/table-order/menu";
import { isOrderActive, orderStatusText } from "@/lib/table-order/order-status";
import { formatPickupTime, PICKUP_CODE } from "@/lib/table-order/pickup";
import { tableCodeFromScan } from "@/lib/table-order/pwa";
import { storedOrderIds } from "@/lib/table-order/my-orders";
import { fetchMember, fetchOrder, fetchSession, logoutMember, type MemberProfile, type OrderData, type TableSession } from "@/features/table-order/api";
import { readTableState } from "@/features/table-order/storage";
import { MemberCardScreen } from "@/features/table-order/components/member-card-screen";
import { MemberSheet } from "@/features/table-order/components/member-sheet";
import { registerCustomerSw, useInstallPrompt } from "../install";
import { QrScanner } from "./qr-scanner";

/**
 * Beranda aplikasi pelanggan (PWA, owner 2026-10-11): pesan pickup (ambil di
 * kasir, bayar dulu, pilih jam), scan QR meja, kartu member, pesanan aktif.
 */
export function CustomerHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const install = useInstallPrompt();
  const [session, setSession] = useState<TableSession | null>(null);
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [memberView, setMemberView] = useState<"login" | "card" | null>(null);
  const [memberBusy, setMemberBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [wantCard, setWantCard] = useState(() => searchParams.get("kartu") === "1");

  const reloadMember = useCallback(async () => {
    const profile = await fetchMember().catch(() => null);
    setMember(profile);
    return profile;
  }, []);

  useEffect(() => {
    registerCustomerSw();
    let cancelled = false;
    void (async () => {
      const [nextSession, profile] = await Promise.all([fetchSession(PICKUP_CODE).catch(() => null), fetchMember().catch(() => null)]);
      if (cancelled) return;
      setSession(nextSession);
      setMember(profile);
      const ids = storedOrderIds(readTableState(PICKUP_CODE));
      const loaded = await Promise.all(ids.map((id) => fetchOrder(id).catch(() => null)));
      if (!cancelled) setOrders(loaded.filter((o): o is OrderData => Boolean(o && isOrderActive(o.status))));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pintasan "Kartu member" dari ikon aplikasi (?kartu=1).
  const memberReady = member !== null;
  if (wantCard && memberReady) {
    setWantCard(false);
    setMemberView("card");
  }

  const brandName = session?.brand_name || "BCD Coffee";
  const arkEnabled = session?.ark_enabled !== false;
  const xpEnabled = session?.xp_enabled !== false;
  const pickupOpen = Boolean(session?.pickup_open);

  const onScan = useCallback(
    (text: string) => {
      const code = tableCodeFromScan(text);
      setScanOpen(false);
      if (!code) {
        setScanError("Itu bukan QR meja. Scan QR yang tertempel di meja.");
        return;
      }
      router.push(`/table-order/${encodeURIComponent(code)}`);
    },
    [router]
  );

  async function logout() {
    setMemberBusy(true);
    try {
      await logoutMember();
      await reloadMember();
      setMemberView(null);
    } finally {
      setMemberBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-gray-50 pb-10 text-gray-900">
      <div className="mx-auto max-w-md">
        <header className="bg-primary px-5 pb-16 pt-[max(20px,env(safe-area-inset-top))] text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-white shadow">
                <img src="/logos/bcd-coffee-icon.png?v=bcd" alt="" className="size-8 object-contain" />
              </div>
              <div>
                <div className="text-lg font-black leading-tight">{brandName}</div>
                <div className="text-xs text-white/75">Pesan, ambil, kumpulkan poin</div>
              </div>
            </div>
            {install.canPrompt && (
              <button
                type="button"
                onClick={() => void install.install()}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-bold text-primary shadow"
              >
                <Download className="size-4" /> Pasang
              </button>
            )}
          </div>
        </header>

        <div className="-mt-10 space-y-4 px-4">
          {/* Member */}
          <button
            type="button"
            onClick={() => setMemberView(member ? "card" : "login")}
            className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-lg shadow-black/5"
          >
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              {member ? <IdCard className="size-6" /> : <UserRound className="size-6" />}
            </div>
            <div className="min-w-0 flex-1">
              {member ? (
                <>
                  <div className="truncate text-sm font-bold">{member.name}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-gray-500">
                    {member.tier ? <span className="font-semibold text-amber-600">{member.tier.name}</span> : null}
                    {arkEnabled ? <span>{idrToArkDisplay(member.ark_coin_balance, member.ark_rate)}</span> : null}
                    {xpEnabled ? <span>{new Intl.NumberFormat("id-ID").format(member.total_xp)} XP</span> : null}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-bold">Masuk member</div>
                  <div className="mt-0.5 text-xs text-gray-500">Harga member, ARK Coin & XP — cukup OTP WhatsApp</div>
                </>
              )}
            </div>
            <span className="shrink-0 text-xs font-bold text-primary">{member ? "Kartu" : "Masuk"}</span>
          </button>

          {/* Aksi utama */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/pesan/ambil"
              className="relative flex flex-col gap-3 rounded-2xl bg-primary p-4 text-white shadow-lg shadow-primary/20"
            >
              <ShoppingBag className="size-7" />
              <div>
                <div className="text-base font-black leading-tight">Pesan ambil</div>
                <div className="mt-0.5 text-xs text-white/80">{pickupOpen ? "Bayar dulu, pilih jam ambil" : "Sedang tutup"}</div>
              </div>
              {!pickupOpen && session ? (
                <span className="absolute right-3 top-3 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">TUTUP</span>
              ) : null}
            </Link>
            <button
              type="button"
              onClick={() => {
                setScanError(null);
                setScanOpen(true);
              }}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4 text-left shadow-lg shadow-black/5"
            >
              <QrCode className="size-7 text-primary" />
              <div>
                <div className="text-base font-black leading-tight">Scan QR meja</div>
                <div className="mt-0.5 text-xs text-gray-500">Makan di tempat, diantar ke meja</div>
              </div>
            </button>
          </div>
          {scanError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{scanError}</div>
          ) : null}

          {/* Pesanan pickup aktif */}
          {orders.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-bold text-gray-900">Pesanan pickup aktif</h2>
              <div className="space-y-2">
                {orders.map((order) => (
                  <Link
                    key={order.id}
                    href="/pesan/ambil"
                    className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm"
                  >
                    <div className="grid h-12 min-w-12 place-items-center rounded-xl bg-primary px-2 text-lg font-black text-white">
                      {order.queue_number || "—"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold">
                        {order.pickup_at ? `Ambil jam ${formatPickupTime(order.pickup_at)}` : "Pickup"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.status === "ready" ? "Siap diambil di kasir" : orderStatusText(order.status)} ·{" "}
                        {formatRupiah(order.total_amount)}
                        {order.payment_status !== "paid" ? " · belum dibayar" : ""}
                      </div>
                    </div>
                    <ChevronRight className="size-5 text-gray-400" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <Link href="/member" className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <Sparkles className="size-6 text-amber-500" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">Portal member</div>
              <div className="text-xs text-gray-500">Riwayat, reward, tier & saldo ARK</div>
            </div>
            <ChevronRight className="size-5 text-gray-400" />
          </Link>

          {install.iosHint && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-gray-700">
              <div className="font-bold text-gray-900">Pasang di iPhone</div>
              <p className="mt-1">
                Ketuk <Share className="inline size-4 align-text-bottom text-primary" /> <b>Bagikan</b> di Safari, lalu pilih{" "}
                <b>Tambah ke Layar Utama</b>.
              </p>
            </div>
          )}
        </div>
      </div>

      {scanOpen && <QrScanner onResult={onScan} onClose={() => setScanOpen(false)} />}

      <MemberSheet
        open={memberView === "login"}
        member={member}
        onClose={() => setMemberView(null)}
        onChanged={async () => {
          await reloadMember();
        }}
        arkEnabled={arkEnabled}
        xpEnabled={xpEnabled}
      />
      <MemberCardScreen
        open={memberView === "card"}
        member={member}
        brandName={brandName}
        arkEnabled={arkEnabled}
        xpEnabled={xpEnabled}
        busy={memberBusy}
        onClose={() => setMemberView(null)}
        onLogout={() => void logout()}
      />
    </main>
  );
}
