import type { Metadata, Viewport } from "next";
import { brandName } from "@/lib/branding";

export const metadata: Metadata = {
  title: `Kasir · ${brandName()}`,
  description: `Kasir mobile ${brandName()} — jual, terima tunai/QRIS, cetak struk dari HP.`,
  robots: { index: false, follow: false },
  // Bisa dipasang di layar utama HP kasir (PWA).
  manifest: "/manifest-kasir.webmanifest",
  appleWebApp: { capable: true, title: `Kasir ${brandName()}`, statusBarStyle: "default" },
  icons: { apple: "/app-icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#d8301d",
};

export default function MobileKasirLayout({ children }: { children: React.ReactNode }) {
  return children;
}
