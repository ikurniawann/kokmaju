"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  History,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  Store,
  UserRound,
  UtensilsCrossed,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePosProducts } from "@/hooks/use-pos-products";
import { usePosCheckout } from "@/hooks/use-pos-checkout";
import { usePosShift } from "@/hooks/use-pos-shift";
import { useResolvedBillingProfile } from "@/features/pos/billing-settings";
import { usePaymentMethods, usePosStaticQris } from "@/features/pos/payment-methods";
import {
  calculateBillCharges,
  DEFAULT_BILLING_CHARGES,
  resolveEnabledOptionalCodes,
} from "@/lib/pos/billing-settings";
import { DEFAULT_POS_PAYMENT_METHODS, isFocPaymentMethod } from "@/lib/pos/payment-methods";
import { formatPaymentMethodLabel } from "@/features/pos/reports/utils/transaction-labels";
import { printThermalReceipt, type ReceiptPayload } from "@/components/pos/PrintReceipt";
import { receiptFromPayload } from "@/lib/pos/receipt-animation";
import { unlockReceiptAudio } from "../receipt-sound";
import {
  buildCategories,
  filterProducts,
  formatRupiah,
  groupBySection,
  UNCATEGORIZED_ID,
  type SelectedModifier,
  type TableOrderProduct,
  type TableOrderVariant,
} from "@/lib/table-order/menu";
import {
  addToCart,
  adjustCartQuantity,
  directDecrementLine,
  productLines,
  productQuantity,
  type CartLine,
} from "@/lib/table-order/pricing";
import { BottomSheet } from "@/features/table-order/components/sheet";
import { MenuItemRow } from "@/features/table-order/components/menu-item-row";
import { VariantSheet } from "@/features/table-order/components/variant-sheet";
import { DecrementSheet } from "@/features/table-order/components/decrement-sheet";
import { flyToCart } from "@/features/table-order/fly-to-cart";
import "@/features/table-order/components/fly-to-cart.css";
import {
  buildKasirCatalog,
  buildOrderNotes,
  kasirPaymentOptions,
  toPosCart,
  type KasirPaymentOption,
} from "../catalog";
import { KasirCartSheet, type KasirOrderType } from "./kasir-cart-sheet";
import { KasirPaymentSheet, type KasirPaymentSubmit } from "./kasir-payment-sheet";
import { KasirSuccess, type KasirSale } from "./kasir-success";
import { KasirHistorySheet } from "./kasir-history-sheet";

const HERO_IMAGE = "/bg-kokmaju.webp";
/** Sama dengan kasir desktop — shift & order dicatat per sesi login di server. */
const CASHIER_ID = "00000000-0000-0000-0000-000000000001";
const CART_STORAGE_KEY = "kokmaju-kasir-mobile-cart";

type StallOption = { id: string; name: string; code: string };
type StallInfo = { active: StallOption | null; stalls: StallOption[]; canSwitch: boolean };

const STALL_QUERY_KEY = ["auth", "stall-options", "kasir-mobile"] as const;

async function fetchStallInfo(): Promise<StallInfo | null> {
  const res = await fetch("/api/auth/stall-options", { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return {
    active: json.data?.active ?? null,
    stalls: json.data?.stalls ?? [],
    canSwitch: Boolean(json.data?.can_switch),
  };
}

function readStoredCart(): { cart: CartLine[]; orderType: KasirOrderType } {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as { cart?: CartLine[]; orderType?: KasirOrderType }) : null;
    return {
      cart: Array.isArray(parsed?.cart) ? parsed.cart : [],
      orderType: parsed?.orderType === "takeaway" ? "takeaway" : "dine_in",
    };
  } catch {
    return { cart: [], orderType: "dine_in" };
  }
}

const FALLBACK_CASH: KasirPaymentOption = { code: "cash", name: "Tunai", method: "cash", kind: "cash" };

export function MobileKasirApp({ cashierName, brandName }: { cashierName: string; brandName: string }) {
  const {
    products: posProducts,
    loading,
    error: loadError,
    stallBlockedReason,
    isOfflineFallback,
    refetch,
  } = usePosProducts();
  const products = useMemo(() => buildKasirCatalog(posProducts), [posProducts]);

  const [stored] = useState(readStoredCart);
  const [rawCart, setCart] = useState<CartLine[]>(stored.cart);
  const [orderType, setOrderType] = useState<KasirOrderType>(stored.orderType);
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [variantProduct, setVariantProduct] = useState<TableOrderProduct | null>(null);
  const [decrementProduct, setDecrementProduct] = useState<TableOrderProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [menuJumpOpen, setMenuJumpOpen] = useState(false);
  const [stallOpen, setStallOpen] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [sale, setSale] = useState<KasirSale | null>(null);
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null);
  const [printing, setPrinting] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const [toastText, setToastText] = useState<string | null>(null);
  const [switchingStall, setSwitchingStall] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToastText(message);
    window.setTimeout(() => setToastText(null), 1800);
  }, []);

  // ---- keranjang tersimpan di HP (aman dari refresh tak sengaja) ----------
  // Komponen ini hanya dirender di klien (lihat kasir-client.tsx), jadi
  // localStorage aman dibaca di initializer.
  useEffect(() => {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ cart: rawCart, orderType }));
    } catch {
      // abaikan — keranjang tetap ada di memori
    }
  }, [rawCart, orderType]);

  // Baris yang produknya sudah tidak dijual (stall lain / dinonaktifkan) disembunyikan.
  const cart = useMemo(() => {
    if (loading && products.length === 0) return rawCart;
    const sellable = new Set(products.map((product) => product.id));
    return rawCart.filter((line) => sellable.has(line.productId));
  }, [rawCart, products, loading]);

  // ---- stall aktif --------------------------------------------------------
  const queryClient = useQueryClient();
  const stallQuery = useQuery({ queryKey: STALL_QUERY_KEY, queryFn: fetchStallInfo, staleTime: 30_000 });
  const stall = stallQuery.data ?? null;

  async function switchStall(id: string) {
    setSwitchingStall(id);
    try {
      const res = await fetch("/api/auth/active-stall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouse_id: id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Gagal mengganti stall");
      // Katalog per stall berbeda → keranjang lama tidak berlaku.
      setCart([]);
      setStallOpen(false);
      await Promise.all([queryClient.invalidateQueries({ queryKey: STALL_QUERY_KEY }), refetch()]);
      showToast("Stall diganti");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengganti stall");
    } finally {
      setSwitchingStall(null);
    }
  }

  // ---- shift (hanya bila fitur shift diaktifkan) ---------------------------
  const { enabled: shiftEnabled, isActive: hasShift, loading: shiftLoading, shift, openShift } =
    usePosShift(CASHIER_ID);
  const [openingCash, setOpeningCash] = useState("");
  const [openingShift, setOpeningShift] = useState(false);
  async function submitOpenShift() {
    setOpeningShift(true);
    const res = await openShift(Number(openingCash || 0));
    setOpeningShift(false);
    if (res.success) {
      setShiftOpen(false);
      showToast("Shift dibuka");
    } else {
      toast.error(res.error || "Gagal membuka shift");
    }
  }

  // ---- harga & pembayaran -------------------------------------------------
  const billingQuery = useResolvedBillingProfile({});
  const charges = billingQuery.data?.charges?.length ? billingQuery.data.charges : DEFAULT_BILLING_CHARGES;
  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0), [cart]);
  const bill = useMemo(
    () =>
      calculateBillCharges({
        subtotalAfterDiscount: subtotal,
        charges,
        enabledOptionalCodes: resolveEnabledOptionalCodes(charges, true, true),
      }),
    [subtotal, charges]
  );
  const totalItems = cart.reduce((sum, line) => sum + line.quantity, 0);

  const methodsQuery = usePaymentMethods(true);
  const staticQrisQuery = usePosStaticQris(true);
  const staticQrisImageUrl = staticQrisQuery.data?.available ? staticQrisQuery.data.imageUrl : null;
  const paymentOptions = useMemo(() => {
    const source = methodsQuery.data?.length ? methodsQuery.data : DEFAULT_POS_PAYMENT_METHODS;
    const options = kasirPaymentOptions(source, {
      isFoc: (code, name) => isFocPaymentMethod(code, name),
    });
    return options.length ? options : [FALLBACK_CASH];
  }, [methodsQuery.data]);

  const { checkout, submitting } = usePosCheckout();
  const blockedReason =
    shiftEnabled && !shiftLoading && !hasShift ? "Buka shift dulu sebelum menerima pembayaran." : null;

  async function submitPayment({ option, cashReceived }: KasirPaymentSubmit) {
    // Masih di dalam klik "konfirmasi" → izinkan audio utk suara struk nanti.
    unlockReceiptAudio();
    const items = toPosCart(cart, products);
    if (items.length === 0) return;
    setPayError(null);
    const notes = buildOrderNotes(customerName, note);
    const result = await checkout({
      cart: items,
      orderType,
      selectedTable: null,
      selectedCustomer: null,
      paymentMethod: option.method,
      cashReceived: String(cashReceived),
      includeTax: true,
      notes,
      arkToUse: 0,
      shiftId: shift?.id ?? null,
      billCharges: bill,
      paymentStatus: "paid",
      paymentMethodCode: option.code,
      paymentMethodName: option.name,
    });
    if (!result.success) {
      setPayError(result.error || "Pembayaran gagal");
      return;
    }
    const methodLabel = formatPaymentMethodLabel(option.method, { code: option.code, name: option.name });
    const payload: ReceiptPayload = {
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      checkoutNumber: result.checkoutNumber,
      queueNumber: result.queueNumber ?? null,
      orderType,
      table: null,
      items,
      notes,
      total: result.total,
      change: result.change,
      paymentMethod: methodLabel,
      customerName: customerName.trim() || undefined,
      stallName: stall?.active?.name ?? null,
      subtotal,
      discountAmount: 0,
      taxAmount: bill.tax_amount,
      chargesBreakdown: bill.breakdown,
    };
    setReceipt(payload);
    setReplayKey((key) => key + 1);
    setSale({
      orderNumber: result.checkoutNumber || result.orderNumber || null,
      queueNumber: result.queueNumber ?? null,
      total: result.total,
      change: Math.max(0, result.change),
      methodLabel,
      itemCount: totalItems,
      customerName: customerName.trim(),
      paidAt: new Date(),
      receipt: receiptFromPayload(payload, methodLabel),
    });
    setPayOpen(false);
    setCartOpen(false);
    setCart([]);
    setCustomerName("");
    setNote("");
    window.scrollTo({ top: 0 });
  }

  async function printReceipt() {
    if (!receipt) return;
    // Putar ulang animasi (+ suara) sambil struk dikirim ke printer.
    unlockReceiptAudio();
    setReplayKey((key) => key + 1);
    setPrinting(true);
    try {
      await printThermalReceipt(receipt, "CUSTOMER");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mencetak struk");
    } finally {
      setPrinting(false);
    }
  }

  // ---- menu ---------------------------------------------------------------
  const categories = useMemo(() => buildCategories(products), [products]);
  const filtered = useMemo(() => filterProducts(products, { query }), [products, query]);
  const sections = useMemo(() => groupBySection(filtered, categories), [filtered, categories]);
  const sectionRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (sale || sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveCategory(visible.target.getAttribute("data-category"));
      },
      { rootMargin: "-140px 0px -60% 0px", threshold: 0 }
    );
    sectionRefs.current.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [sections, sale]);

  const pendingJumpRef = useRef<string | null>(null);
  useEffect(() => {
    if (menuJumpOpen || !pendingJumpRef.current) return;
    const id = pendingJumpRef.current;
    pendingJumpRef.current = null;
    const frame = requestAnimationFrame(() => {
      sectionRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [menuJumpOpen]);

  function scrollToCategory(id: string) {
    setActiveCategory(id);
    if (menuJumpOpen) {
      pendingJumpRef.current = id;
      setMenuJumpOpen(false);
      return;
    }
    sectionRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const cartBarRef = useRef<HTMLButtonElement>(null);
  const flySourceRef = useRef<HTMLElement | null>(null);
  function animateAdd(product: TableOrderProduct, source: HTMLElement | null) {
    flyToCart({ source, image: product.image ?? null, label: product.name, getTarget: () => cartBarRef.current });
  }

  function handleAdd(product: TableOrderProduct, source: HTMLElement | null = null) {
    if (product.customizable) {
      flySourceRef.current = source;
      setVariantProduct(product);
      return;
    }
    setCart((current) => addToCart(current, product));
    animateAdd(product, source);
  }

  function handleAddVariant(
    product: TableOrderProduct,
    variant: TableOrderVariant | null,
    quantity: number,
    modifiers: SelectedModifier[]
  ) {
    setCart((current) => addToCart(current, product, variant, quantity, modifiers));
    setVariantProduct(null);
    const source = flySourceRef.current;
    flySourceRef.current = null;
    window.setTimeout(() => animateAdd(product, source), 220);
    showToast(`${product.name} ditambahkan`);
  }

  function handleDecrement(product: TableOrderProduct) {
    const cartId = directDecrementLine(cart, product.id);
    if (cartId) {
      setCart((current) => adjustCartQuantity(current, cartId, -1));
      return;
    }
    if (productLines(cart, product.id).length > 1) setDecrementProduct(product);
  }

  // ---- render -------------------------------------------------------------
  if (sale) {
    return (
      <KasirSuccess
        sale={sale}
        brandLine={`GEROBAK ${brandName.toUpperCase()}`}
        stallName={stall?.active?.name ?? null}
        cashierName={cashierName}
        replayKey={replayKey}
        printing={printing}
        onPrint={() => void printReceipt()}
        onNewSale={() => {
          setSale(null);
          setReceipt(null);
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  const stallBlocked = Boolean(stallBlockedReason) && products.length === 0;

  return (
    <main className="min-h-dvh bg-gray-50 pb-28 text-gray-900">
      <div className="mx-auto max-w-md">
        {/* Hero */}
        <div className="relative h-44 overflow-hidden">
          <img src={HERO_IMAGE} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/5 to-gray-50" />
          <div className="absolute inset-x-4 top-4 flex items-center justify-between">
            <div className="flex size-11 items-center justify-center rounded-full bg-white/95 shadow">
              <img src="/logos/kokmaju-icon.png?v=koma" alt={brandName} className="size-8 rounded-lg object-contain" />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSearchOpen((open) => !open);
                  setQuery("");
                }}
                className="flex size-11 items-center justify-center rounded-full bg-white/95 text-gray-800 shadow"
                aria-label="Cari menu"
              >
                {searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
              </button>
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="flex size-11 items-center justify-center rounded-full bg-white/95 text-primary shadow"
                aria-label="Transaksi hari ini"
              >
                <History className="size-5" />
              </button>
              <a
                href="/api/auth/logout"
                className="flex size-11 items-center justify-center rounded-full bg-white/95 text-gray-800 shadow"
                aria-label="Keluar"
              >
                <LogOut className="size-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Kartu kasir (menumpang hero) */}
        <div className="relative -mt-16 px-4">
          <div className="rounded-2xl bg-white p-4 shadow-lg shadow-black/5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-[15px] font-bold leading-snug text-gray-900">{brandName} — Kasir</h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-gray-600">
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700">
                    {isOfflineFallback ? "OFFLINE" : "ONLINE"}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="inline-flex items-center gap-1">
                    <UserRound className="size-3.5 text-primary" />
                    {cashierName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void refetch()}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600"
                aria-label="Muat ulang menu"
              >
                <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 border-t border-dashed border-gray-200 pt-3">
              <button
                type="button"
                onClick={() => setStallOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-primary px-3 text-xs font-bold text-primary"
              >
                <Store className="size-4" />
                {stall?.active?.name ?? "Pilih stall"}
                {stall?.canSwitch && <ChevronRight className="size-3.5" />}
              </button>
              {shiftEnabled && (
                <button
                  type="button"
                  onClick={() => !hasShift && setShiftOpen(true)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold ${
                    hasShift ? "border border-gray-200 text-gray-700" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  <Wallet className="size-4" />
                  {shiftLoading ? "Cek shift…" : hasShift ? "Shift aktif" : "Buka shift"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sticky: pencarian + kategori */}
        <div className="sticky top-0 z-20 mt-4 bg-gray-50/95 backdrop-blur">
          {(searchOpen || query) && (
            <div className="px-4 pt-3">
              <div className="flex h-11 items-center gap-2 rounded-full bg-white px-4 shadow-sm ring-1 ring-gray-200">
                <Search className="size-4 text-gray-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari menu…"
                  className="h-full flex-1 bg-transparent text-sm outline-none"
                />
                {query && (
                  <button type="button" onClick={() => setQuery("")} aria-label="Bersihkan">
                    <X className="size-4 text-gray-400" />
                  </button>
                )}
              </div>
            </div>
          )}
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
              {categories.map((category) => {
                const active = activeCategory === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => scrollToCategory(category.id)}
                    className={`h-9 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition ${
                      active ? "bg-primary text-white shadow" : "bg-white text-gray-700 ring-1 ring-gray-200"
                    }`}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Daftar menu */}
        <div className="mt-1 bg-white">
          {loading && products.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-gray-500">
              <Loader2 className="size-5 animate-spin" /> Memuat menu…
            </div>
          ) : loadError ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm font-semibold text-red-700">{loadError}</p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="mt-4 h-10 rounded-full bg-primary px-5 text-sm font-bold text-white"
              >
                Muat ulang
              </button>
            </div>
          ) : stallBlocked ? (
            <div className="px-6 py-14 text-center">
              <Store className="mx-auto size-10 text-gray-300" />
              <p className="mt-3 text-sm font-bold text-gray-800">
                {stallBlockedReason === "no_stall" || stallBlockedReason === "no_stall_assignment"
                  ? "Akun ini belum ditempatkan di stall"
                  : "Pilih stall untuk mulai berjualan"}
              </p>
              {stall?.canSwitch && (
                <button
                  type="button"
                  onClick={() => setStallOpen(true)}
                  className="mt-4 h-10 rounded-full bg-primary px-5 text-sm font-bold text-white"
                >
                  Pilih stall
                </button>
              )}
            </div>
          ) : products.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <UtensilsCrossed className="mx-auto size-10 text-gray-300" />
              <p className="mt-3 text-sm font-bold text-gray-800">Menu belum tersedia</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Belum ada produk aktif di stall ini. Admin: tambahkan produk di Dashboard → POS → Products.
              </p>
            </div>
          ) : sections.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-500">Tidak ada menu yang cocok dengan “{query}”.</div>
          ) : (
            sections.map((section) => (
              <section
                key={section.category.id}
                data-category={section.category.id}
                ref={(element) => {
                  if (element) sectionRefs.current.set(section.category.id, element);
                  else sectionRefs.current.delete(section.category.id);
                }}
                className="scroll-mt-32"
              >
                <h2 className="px-4 pb-1 pt-5 text-lg font-bold text-gray-900">
                  {section.category.id === UNCATEGORIZED_ID ? "Lainnya" : section.category.name}
                </h2>
                {section.products.map((product) => (
                  <MenuItemRow
                    key={product.id}
                    product={product}
                    quantity={productQuantity(cart, product.id)}
                    locked={false}
                    onAdd={(source) => handleAdd(product, source)}
                    onIncrement={(source) => handleAdd(product, source)}
                    onDecrement={() => handleDecrement(product)}
                  />
                ))}
              </section>
            ))
          )}
        </div>
      </div>

      {/* Tombol "Menu" mengambang */}
      {categories.length > 1 && !cartOpen && (
        <button
          type="button"
          onClick={() => setMenuJumpOpen(true)}
          className={`fixed left-1/2 z-30 inline-flex h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-white shadow-xl shadow-black/20 ${
            cart.length > 0 ? "bottom-24" : "bottom-6"
          }`}
        >
          <UtensilsCrossed className="size-4" /> Menu
        </button>
      )}

      {/* Bar keranjang */}
      {cart.length > 0 && (
        <div className="tor-cart-bar fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <button
            ref={cartBarRef}
            type="button"
            onClick={() => setCartOpen(true)}
            className="mx-auto flex h-13 w-full max-w-md items-center justify-between rounded-2xl bg-primary px-4 py-3 text-left text-white shadow-lg shadow-black/10"
          >
            <span>
              <span className="block text-xs text-white/75">
                <span data-cart-count>{totalItems}</span> item ·{" "}
                {orderType === "dine_in" ? "Makan di tempat" : "Bawa pulang"}
              </span>
              <span className="block text-base font-bold">{formatRupiah(bill.total)}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-bold">
              Bayar <ChevronRight className="size-4" />
            </span>
          </button>
        </div>
      )}

      {toastText && (
        <div className="pointer-events-none fixed inset-x-0 bottom-40 z-40 flex justify-center px-4">
          <div className="rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-lg">{toastText}</div>
        </div>
      )}

      <VariantSheet product={variantProduct} onClose={() => setVariantProduct(null)} onAdd={handleAddVariant} />

      <DecrementSheet
        productName={decrementProduct?.name ?? null}
        lines={decrementProduct ? productLines(cart, decrementProduct.id) : []}
        onQuantity={(cartId, delta) => setCart((current) => adjustCartQuantity(current, cartId, delta))}
        onClose={() => setDecrementProduct(null)}
      />

      <KasirCartSheet
        open={cartOpen && !payOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        subtotal={subtotal}
        bill={bill}
        orderType={orderType}
        onOrderType={setOrderType}
        customerName={customerName}
        onCustomerName={setCustomerName}
        note={note}
        onNote={setNote}
        onQuantity={(cartId, delta) => setCart((current) => adjustCartQuantity(current, cartId, delta))}
        onClear={() => {
          setCart([]);
          setCartOpen(false);
        }}
        onPay={() => {
          setPayError(null);
          setPayOpen(true);
        }}
        blockedReason={blockedReason}
      />

      <KasirPaymentSheet
        open={payOpen}
        onClose={() => setPayOpen(false)}
        total={bill.total}
        options={paymentOptions}
        staticQrisImageUrl={staticQrisImageUrl}
        submitting={submitting}
        error={payError}
        onSubmit={(value) => void submitPayment(value)}
      />

      <KasirHistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} />

      <BottomSheet open={menuJumpOpen} onClose={() => setMenuJumpOpen(false)} title="Kategori menu">
        <ul className="divide-y divide-gray-100">
          {categories.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                onClick={() => scrollToCategory(category.id)}
                className="flex w-full items-center justify-between py-3 text-left"
              >
                <span className="text-sm font-semibold text-gray-900">{category.name}</span>
                <span className="text-xs text-gray-500">{category.count} menu</span>
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>

      <BottomSheet open={stallOpen} onClose={() => setStallOpen(false)} title="Stall aktif">
        {!stall?.canSwitch ? (
          <p className="py-6 text-center text-sm text-gray-600">
            {stall?.active ? `Akun ini berjualan di ${stall.active.name}.` : "Akun ini belum ditempatkan di stall."}{" "}
            Hubungi admin untuk mengganti penempatan.
          </p>
        ) : (
          <ul className="space-y-2">
            {stall.stalls.map((option) => {
              const active = stall.active?.id === option.id;
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    disabled={Boolean(switchingStall) || active}
                    onClick={() => void switchStall(option.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition ${
                      active ? "bg-primary/5 ring-primary" : "bg-white ring-gray-200"
                    }`}
                  >
                    {switchingStall === option.id ? (
                      <Loader2 className="size-5 animate-spin text-primary" />
                    ) : (
                      <Store className={`size-5 ${active ? "text-primary" : "text-gray-400"}`} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-gray-900">{option.name}</span>
                      <span className="block truncate text-xs text-gray-500">{option.code}</span>
                    </span>
                    {active && <span className="text-xs font-bold text-primary">Aktif</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </BottomSheet>

      <BottomSheet
        open={shiftOpen}
        onClose={() => setShiftOpen(false)}
        title="Buka shift"
        footer={
          <button
            type="button"
            disabled={openingShift}
            onClick={() => void submitOpenShift()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-white disabled:opacity-60"
          >
            {openingShift && <Loader2 className="size-4 animate-spin" />} Buka shift
          </button>
        }
      >
        <label className="block">
          <span className="text-xs font-bold text-gray-700">Modal awal di laci (Rp)</span>
          <input
            inputMode="numeric"
            value={openingCash}
            onChange={(event) => setOpeningCash(event.target.value.replace(/\D/g, "").slice(0, 9))}
            placeholder="0"
            className="mt-1 h-12 w-full rounded-xl border border-gray-200 px-3 text-lg font-bold outline-none focus:border-primary"
          />
        </label>
      </BottomSheet>
    </main>
  );
}
