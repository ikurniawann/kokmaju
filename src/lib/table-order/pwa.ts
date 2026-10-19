/**
 * Aplikasi pelanggan PWA (owner 2026-10-11): self-order + pickup + kartu
 * member yang bisa dipasang di layar utama HP. Scope "/" supaya link
 * /table-order/<meja> & /member yang dibuka dari aplikasi tetap di dalamnya.
 */
export const CUSTOMER_APP_START = "/pesan";
export const CUSTOMER_APP_THEME = "#d8301d";
export const CUSTOMER_SW_URL = "/sw-pelanggan.js";

export function customerAppManifest(brand: string) {
  const name = brand.trim() || "KoMa";
  return {
    id: CUSTOMER_APP_START,
    name,
    short_name: name.length > 12 ? name.split(/\s+/)[0] : name,
    description: `Pesan ${name} dari meja atau ambil di kasir, kartu member & ARK Coin.`,
    start_url: `${CUSTOMER_APP_START}?source=pwa`,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: CUSTOMER_APP_THEME,
    lang: "id",
    categories: ["food", "shopping"],
    icons: [
      { src: "/app-icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Pesan ambil (pickup)", url: `${CUSTOMER_APP_START}/ambil`, icons: [{ src: "/app-icons/icon-192.png", sizes: "192x192" }] },
      { name: "Kartu member", url: `${CUSTOMER_APP_START}?kartu=1`, icons: [{ src: "/app-icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

/** Kode meja dari hasil scan QR: URL /table-order/<kode> atau kode polos. */
export function tableCodeFromScan(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const match = value.match(/\/table-order\/([^/?#\s]+)/i);
  if (match) return decodeURIComponent(match[1]).toUpperCase();
  if (/^https?:\/\//i.test(value)) return null;
  return /^[A-Za-z0-9._-]{1,40}$/.test(value) ? value.toUpperCase() : null;
}

/** iPhone/iPad Safari tidak punya tombol pasang otomatis → tampilkan panduan "Bagikan → Tambah ke Layar Utama". */
export function needsIosInstallHint(userAgent: string, standalone: boolean) {
  if (standalone) return false;
  const ios = /iPhone|iPad|iPod/i.test(userAgent);
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV|Line\//i.test(userAgent);
  return ios && !otherBrowser;
}
