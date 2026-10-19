import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/pos-api";
import { addToCart } from "@/lib/table-order/pricing";
import {
  buildKasirCatalog,
  buildOrderNotes,
  isMobileSellable,
  kasirPaymentOptions,
  quickCashAmounts,
  receiptBarcodeBars,
  toKasirProduct,
  toPosCart,
} from "./catalog";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    sku: "KOMA-01",
    name: "Ayam Geprek",
    base_price: 18000,
    is_active: true,
    is_available: true,
    category_id: "c1",
    category: { name: "Makanan" },
    station: "kitchen",
    warehouse_id: "w1",
    warehouse_name: "Gerobak 1",
    ...overrides,
  };
}

const sized = product({
  id: "p2",
  name: "Es Teh",
  base_price: 5000,
  variants: [
    { id: "v1", product_id: "p2", name: "Regular", group_name: "Ukuran", price_adjustment: 0, is_active: true },
    { id: "v2", product_id: "p2", name: "Jumbo", group_name: "Ukuran", price_adjustment: 3000, is_active: true },
  ],
  modifiers: [
    {
      id: "pm1",
      modifier_group: {
        id: "g1",
        name: "Topping",
        min_selection: 0,
        max_selection: 2,
        modifiers: [
          { id: "m1", name: "Boba", price_adjustment: 4000 },
          { id: "m2", name: "Jelly", price_adjustment: 2000 },
        ],
      },
    },
  ],
});

describe("isMobileSellable", () => {
  it("menjual produk aktif & tersedia", () => {
    expect(isMobileSellable(product())).toBe(true);
  });

  it("menyembunyikan produk nonaktif, habis, gift card, dan merchandise ber-SKU", () => {
    expect(isMobileSellable(product({ is_active: false }))).toBe(false);
    expect(isMobileSellable(product({ is_available: false }))).toBe(false);
    expect(isMobileSellable(product({ product_kind: "gift_card" }))).toBe(false);
    expect(
      isMobileSellable(product({ product_kind: "merchandise", skus: [{ id: "s1", sku: "S1", name: "M" }] }))
    ).toBe(false);
    expect(isMobileSellable(product({ product_kind: "merchandise", skus: [] }))).toBe(true);
  });
});

describe("toKasirProduct", () => {
  it("memetakan kategori, stall, varian & add-on", () => {
    const mapped = toKasirProduct(sized);
    expect(mapped.categoryName).toBe("Makanan");
    expect(mapped.warehouseId).toBe("w1");
    expect(mapped.variants.map((variant) => variant.name)).toEqual(["Regular", "Jumbo"]);
    expect(mapped.modifierGroups[0].modifiers).toHaveLength(2);
    expect(mapped.customizable).toBe(true);
    expect(mapped.xp).toBe(0);
  });

  it("produk tanpa pilihan tidak membuka sheet kustom", () => {
    expect(toKasirProduct(product()).customizable).toBe(false);
  });
});

describe("buildKasirCatalog", () => {
  it("mengurutkan kategori menurut display_order lalu nama produk", () => {
    const list = buildKasirCatalog([
      product({ id: "d1", name: "Es Teh", category_id: "cm", category: { name: "Minuman", display_order: 4 } }),
      product({ id: "a2", name: "Ayam Kremes", category_id: "ca", category: { name: "Ayam", display_order: 1 } }),
      product({ id: "a1", name: "Ayam Geprek", category_id: "ca", category: { name: "Ayam", display_order: 1 } }),
      product({ id: "n1", name: "Tanpa urutan", category_id: "cx", category: { name: "Lain" } }),
    ]);
    expect(list.map((item) => item.id)).toEqual(["a1", "a2", "d1", "n1"]);
  });
});

describe("toPosCart", () => {
  it("memecah harga varian & add-on seperti kasir desktop", () => {
    const catalog = buildKasirCatalog([sized]);
    const item = catalog[0];
    const cart = addToCart([], item, item.variants[1], 2, [
      { ...item.modifierGroups[0].modifiers[0], groupName: "Topping" },
    ]);
    const [line] = toPosCart(cart, catalog);
    expect(line.price).toBe(12000);
    expect(line.quantity).toBe(2);
    expect(line.variantName).toBe("Jumbo");
    expect(line.variantPriceAdj).toBe(3000);
    expect(line.modifierNames).toEqual(["Boba"]);
    expect(line.modifierPriceAdj).toBe(4000);
    expect(line.warehouse_id).toBe("w1");
    expect(line.station).toBe("kitchen");
  });

  it("varian tunggal tidak dicetak & produk yang hilang dibuang", () => {
    const single = toKasirProduct(
      product({
        variants: [{ id: "v1", product_id: "p1", name: "Regular", group_name: "", price_adjustment: 0, is_active: true }],
      })
    );
    const cart = addToCart(addToCart([], single), toKasirProduct(product({ id: "gone" })));
    const lines = toPosCart(cart, [single]);
    expect(lines).toHaveLength(1);
    expect(lines[0].variantName).toBeUndefined();
  });
});

describe("buildOrderNotes", () => {
  it("menggabungkan nama pemanggil dan catatan", () => {
    expect(buildOrderNotes(" Budi ", "pedas")).toBe("Atas nama: Budi · pedas");
    expect(buildOrderNotes("", " tanpa es ")).toBe("tanpa es");
    expect(buildOrderNotes("", "")).toBe("");
  });
});

describe("quickCashAmounts", () => {
  it("uang pas + pecahan terdekat di atas total", () => {
    expect(quickCashAmounts(23000)).toEqual([23000, 25000, 30000, 40000]);
    expect(quickCashAmounts(50000)).toEqual([50000, 60000, 100000]);
    expect(quickCashAmounts(0)).toEqual([0]);
  });
});

describe("kasirPaymentOptions", () => {
  const methods = [
    { code: "qris", name: "QRIS", handler: "qris", is_active: true, sort_order: 20 },
    { code: "cash", name: "Tunai", handler: "cash", is_active: true, sort_order: 10 },
    { code: "static_qris", name: "QRIS Statis", handler: "credit", is_active: true, sort_order: 25 },
    { code: "credit_card", name: "Debit / EDC", handler: "credit", is_active: true, sort_order: 30 },
    { code: "ark_coin", name: "ARK Coin", handler: "ark_wallet", is_active: true, sort_order: 40 },
    { code: "foc", name: "FOC", handler: "credit", is_active: true, sort_order: 50 },
    { code: "transfer", name: "Transfer", handler: "credit", is_active: false, sort_order: 60 },
  ];
  const isFoc = (code: string) => code === "foc";

  it("hanya tunai, Static QRIS, dan non-tunai manual — terurut", () => {
    expect(kasirPaymentOptions(methods, { staticQrisAvailable: true, isFoc }).map((m) => [m.code, m.kind])).toEqual([
      ["cash", "cash"],
      ["static_qris", "static_qris"],
      ["credit_card", "manual"],
    ]);
  });

  it("Static QRIS disembunyikan bila gambar QRIS belum diatur", () => {
    const codes = kasirPaymentOptions(methods, { staticQrisAvailable: false, isFoc }).map((m) => m.code);
    expect(codes).not.toContain("static_qris");
  });
});

describe("receiptBarcodeBars", () => {
  it("deterministik per nomor order, lebar 1–3", () => {
    const a = receiptBarcodeBars("POS-20261019-0001");
    expect(a).toHaveLength(44);
    expect(a.every((w) => w >= 1 && w <= 3)).toBe(true);
    expect(receiptBarcodeBars("POS-20261019-0001")).toEqual(a);
    expect(receiptBarcodeBars("POS-20261019-0002")).not.toEqual(a);
  });
});
