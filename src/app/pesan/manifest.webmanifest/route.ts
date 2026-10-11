import { NextResponse } from "next/server";
import { brandName } from "@/lib/branding";
import { loadVenueContext } from "@/lib/table-order/server";
import { customerAppManifest } from "@/lib/table-order/pwa";

export const dynamic = "force-dynamic";

/** GET /pesan/manifest.webmanifest — manifest PWA aplikasi pelanggan (nama brand dari DB). */
export async function GET() {
  const name = await loadVenueContext()
    .then((venue) => venue.brandName)
    .catch(() => brandName());
  return new NextResponse(JSON.stringify(customerAppManifest(name)), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
