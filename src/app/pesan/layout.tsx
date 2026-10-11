import type { Metadata, Viewport } from "next";
import { brandName } from "@/lib/branding";
import { CUSTOMER_APP_THEME } from "@/lib/table-order/pwa";

export const metadata: Metadata = {
  title: brandName(),
  description: "Pesan dari meja atau ambil di kasir, kartu member & ARK Coin.",
  robots: { index: false, follow: false },
  manifest: "/pesan/manifest.webmanifest",
  appleWebApp: { capable: true, title: brandName(), statusBarStyle: "default" },
  icons: { apple: "/app-icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: CUSTOMER_APP_THEME,
};

/** Aplikasi pelanggan PWA (owner 2026-10-11) — beranda /pesan & pickup /pesan/ambil. */
export default function CustomerAppLayout({ children }: { children: React.ReactNode }) {
  return children;
}
