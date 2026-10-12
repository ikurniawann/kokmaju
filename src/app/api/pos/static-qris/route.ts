import { NextResponse } from "next/server";
import { requirePosMenu } from "@/lib/api/auth";
import { IAM } from "@/lib/iam/prefixes";
import { loadStaticQris } from "@/lib/payments/static-qris";

export const dynamic = "force-dynamic";

/**
 * GET /api/pos/static-qris — gambar QRIS statis venue utk modal bayar kasir
 * (owner 2026-10-12). Hak POS (bukan menu Settings) supaya kasir bisa memakai.
 */
export async function GET() {
  const pos = await requirePosMenu(IAM.pos);
  if (pos.error) return pos.error;
  try {
    const config = await loadStaticQris();
    return NextResponse.json({ success: true, data: { available: config.available, imageUrl: config.available ? config.imageUrl : null } });
  } catch (error) {
    console.error("[pos/static-qris] gagal:", error);
    return NextResponse.json({ success: false, error: "Gagal memuat Static QRIS" }, { status: 500 });
  }
}
