"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

/**
 * Kasir mobile dirender khusus klien: keranjang & pilihan tersimpan di
 * localStorage HP kasir dibaca saat inisialisasi state (tanpa mismatch SSR).
 */
export const MobileKasirClient = dynamic(
  () => import("./mobile-kasir-app").then((mod) => mod.MobileKasirApp),
  {
    ssr: false,
    loading: () => (
      <main className="flex min-h-dvh items-center justify-center bg-gray-50 text-sm font-semibold text-gray-500">
        <Loader2 className="mr-2 size-5 animate-spin" /> Memuat kasir…
      </main>
    ),
  }
);
