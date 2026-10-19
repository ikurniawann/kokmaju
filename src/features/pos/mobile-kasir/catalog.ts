/**
 * Kasir mobile (owner KoMa 2026-10-19) — tampilan ala self-order meja, tapi
 * dipakai KASIR: katalog dari `/api/pos/products` (stall aktif, sama dengan
 * kasir desktop) dan transaksi lewat checkout kasir (`usePosCheckout`).
 *
 * Modul ini murni (tanpa I/O): memetakan produk POS ke bentuk menu self-order
 * supaya komponen `MenuItemRow`/`VariantSheet` bisa dipakai ulang, lalu
 * memetakan baris keranjang self-order kembali ke `PosCartItem` kasir.
 */

import type { Product } from "@/lib/pos-api";
import type { PosCartItem } from "@/hooks/use-pos-cart";
import { normalizeTableOrderProduct, type TableOrderProduct } from "@/lib/table-order/menu";
import type { CartLine } from "@/lib/table-order/pricing";

export type KasirProduct = TableOrderProduct & {
  warehouseId: string | null;
  warehouseName: string | null;
};

/**
 * Produk yang bisa dijual dari kasir mobile. Gift card (nominal diketik) dan
 * merchandise ber-SKU (pilih varian stok) butuh alur khusus kasir desktop,
 * jadi tidak ditampilkan di sini.
 */
export function isMobileSellable(product: Product): boolean {
  if (!product.is_active || !product.is_available) return false;
  if (product.product_kind === "gift_card") return false;
  if (product.product_kind === "merchandise" && (product.skus?.length ?? 0) > 0) return false;
  return true;
}

export function toKasirProduct(product: Product): KasirProduct {
  const base = normalizeTableOrderProduct({
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    base_price: product.base_price,
    image_url: product.image_url,
    xp_points: 0,
    station: product.station,
    category_id: product.category_id ?? product.category?.name ?? null,
    category_name: product.category?.name ?? null,
    variants: (product.variants ?? []).map((variant) => ({
      id: variant.id,
      name: variant.name,
      price_adjustment: variant.price_adjustment,
      is_active: variant.is_active,
    })),
    modifier_groups: (product.modifiers ?? [])
      .map((link) => link.modifier_group)
      .filter((group) => Boolean(group?.id))
      .map((group) => ({
        id: group.id,
        name: group.name,
        min_selection: group.min_selection,
        max_selection: group.max_selection,
        modifiers: group.modifiers,
      })),
  });
  return {
    ...base,
    warehouseId: product.warehouse_id ?? product.stall_warehouse_id ?? null,
    warehouseName: product.warehouse_name ?? product.stall_name ?? null,
  };
}

/**
 * Urut seperti papan menu: kategori menurut display_order POS (lalu nama),
 * produk menurut nama. Kategori di layar mengikuti urutan kemunculan pertama.
 */
export function buildKasirCatalog(products: Product[]): KasirProduct[] {
  const order = (product: Product) => product.category?.display_order ?? Number.MAX_SAFE_INTEGER;
  return products
    .filter(isMobileSellable)
    .sort(
      (a, b) =>
        order(a) - order(b) ||
        (a.category?.name ?? "").localeCompare(b.category?.name ?? "", "id") ||
        a.name.localeCompare(b.name, "id")
    )
    .map(toKasirProduct);
}

/**
 * Baris keranjang → item checkout kasir. Selisih harga varian & add-on dipecah
 * seperti kasir desktop (server memvalidasi unit_price + penyesuaian).
 * Produk yang sudah hilang dari katalog → null (dibuang dari keranjang).
 */
export function toPosCartItem(line: CartLine, product: KasirProduct | undefined): PosCartItem | null {
  if (!product) return null;
  const variant = line.variantId ? product.variants.find((entry) => entry.id === line.variantId) : null;
  const selected = new Set(line.modifierIds ?? []);
  const modifierPriceAdj = product.modifierGroups
    .flatMap((group) => group.modifiers)
    .filter((modifier) => selected.has(modifier.id))
    .reduce((sum, modifier) => sum + modifier.priceAdjustment, 0);
  return {
    id: line.cartId,
    productId: line.productId,
    name: line.name,
    price: line.unitPrice,
    quantity: line.quantity,
    // Satu-satunya varian = varian bawaan, bukan pilihan → tidak dicetak.
    variantName: variant && product.variants.length > 1 ? variant.name : undefined,
    variantPriceAdj: variant?.priceAdjustment ?? 0,
    modifierNames: line.modifierNames?.length ? [...line.modifierNames] : undefined,
    modifierPriceAdj,
    imageUrl: line.image ?? undefined,
    station: product.station,
    warehouse_id: product.warehouseId ?? undefined,
    warehouse_name: product.warehouseName,
    stallName: product.warehouseName ?? undefined,
  };
}

export function toPosCart(cart: CartLine[], products: KasirProduct[]): PosCartItem[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  return cart
    .map((line) => toPosCartItem(line, byId.get(line.productId)))
    .filter((item): item is PosCartItem => Boolean(item));
}

/** Catatan order: nama pemanggil (antrian) + catatan bebas kasir. */
export function buildOrderNotes(customerName: string, note: string): string {
  const parts = [];
  const name = customerName.trim();
  if (name) parts.push(`Atas nama: ${name}`);
  const extra = note.trim();
  if (extra) parts.push(extra);
  return parts.join(" · ");
}

/**
 * Tombol nominal cepat utk tunai: uang pas + pecahan rupiah terdekat di atas
 * total (5rb/10rb/20rb/50rb/100rb), maksimal 4 pilihan, unik & terurut.
 */
export function quickCashAmounts(total: number): number[] {
  const amount = Math.max(0, Math.round(total));
  if (amount === 0) return [0];
  const steps = [5_000, 10_000, 20_000, 50_000, 100_000];
  const values = new Set<number>([amount]);
  for (const step of steps) {
    const rounded = Math.ceil(amount / step) * step;
    if (rounded > amount) values.add(rounded);
    if (values.size >= 4) break;
  }
  return [...values].sort((a, b) => a - b).slice(0, 4);
}

export type KasirPaymentOption = {
  code: string;
  name: string;
  /** Nilai `paymentMethod` utk checkout kasir (alur bawaan). */
  method: "cash" | "credit_card";
  kind: "cash" | "static_qris" | "manual";
};

type CatalogPaymentMethod = {
  code: string;
  name: string;
  handler: string;
  is_active: boolean;
  sort_order: number;
};

/**
 * Metode bayar kasir mobile dari master Metode Bayar. Hanya alur yang bisa
 * diselesaikan di HP tanpa perangkat/flow tambahan: tunai, QRIS manual (kode
 * `static_qris` — pelanggan scan QRIS venue di standee/layar, kasir
 * konfirmasi; TANPA payment gateway, tetap muncul walau gambar QRIS belum
 * diunggah — owner 2026-10-19), dan metode manual non-tunai (EDC, transfer).
 * QRIS dinamis Xendit, ARK Coin, gelang NFC, gift card, dan FOC (wajib PIN
 * supervisor) tetap di kasir desktop.
 */
export function kasirPaymentOptions(
  methods: CatalogPaymentMethod[],
  opts: { isFoc: (code: string, name: string) => boolean }
): KasirPaymentOption[] {
  return [...methods]
    .filter((method) => method.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap((method): KasirPaymentOption[] => {
      if (opts.isFoc(method.code, method.name)) return [];
      if (method.code === "static_qris") {
        return [{ code: method.code, name: method.name, method: "credit_card", kind: "static_qris" }];
      }
      if (method.handler === "cash") return [{ code: method.code, name: method.name, method: "cash", kind: "cash" }];
      if (method.handler === "credit") {
        return [{ code: method.code, name: method.name, method: "credit_card", kind: "manual" }];
      }
      return [];
    });
}

/**
 * Lebar batang barcode hiasan struk animasi (1–3 px), deterministik dari
 * nomor order supaya struk yang sama selalu tampil sama. Bukan barcode
 * yang bisa dipindai — hanya ornamen layar.
 */
export function receiptBarcodeBars(seed: string, count = 44): number[] {
  let hash = 2166136261;
  for (const char of seed || "KOMA") {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    hash = (Math.imul(hash ^ (hash >>> 15), 2246822507) + i) >>> 0;
    bars.push(1 + (hash % 3));
  }
  return bars;
}
