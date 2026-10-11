import type { Metadata, Viewport } from "next";
import { brandName } from "@/lib/branding";

export const metadata: Metadata = {
  title: `Pesan dari Meja · ${brandName()}`,
  description: "Pesan menu langsung dari meja lewat QR — bayar QRIS, ARK Coin, atau di kasir.",
  robots: { index: false, follow: false },
  // Bisa dipasang sbg aplikasi pelanggan (PWA, owner 2026-10-11) dari halaman meja.
  manifest: "/pesan/manifest.webmanifest",
  appleWebApp: { capable: true, title: brandName(), statusBarStyle: "default" },
  icons: { apple: "/app-icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#1d1dcc",
};

export default function TableOrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
