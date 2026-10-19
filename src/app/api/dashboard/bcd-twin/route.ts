import { NextResponse } from "next/server";
import { requirePosMenu } from "@/lib/api/auth";
import { IAM } from "@/lib/iam/prefixes";
import { buildTwinSnapshot } from "@/lib/bcd-twin/server";

export const dynamic = "force-dynamic";

/** GET /api/dashboard/bcd-twin — snapshot live coffee shop (owner/admin, menu bcd-twin). */
export async function GET() {
  const guard = await requirePosMenu(IAM.bcdTwin);
  if (guard.error) return guard.error;
  try {
    return NextResponse.json({ success: true, data: await buildTwinSnapshot() });
  } catch (error) {
    console.error("[bcd-twin] snapshot:", error);
    return NextResponse.json({ success: false, error: "Gagal memuat data KoMa Twin" }, { status: 500 });
  }
}
