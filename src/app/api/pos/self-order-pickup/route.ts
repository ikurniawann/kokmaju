import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePosMenu } from "@/lib/api/auth";
import { IAM } from "@/lib/iam/prefixes";
import { getSetting, setSetting } from "@/lib/settings/app-settings";
import { PICKUP_SETTING_KEY } from "@/lib/table-order/pickup";

export const dynamic = "force-dynamic";

/**
 * Saklar buka/tutup pesanan pickup self-order (owner 2026-10-11, EPIC-053) —
 * bisa diubah kasir/admin POS saat ramai atau tutup.
 * GET → { enabled } · PUT { enabled } → simpan.
 */
export async function GET() {
  const pos = await requirePosMenu(IAM.pos);
  if (pos.error) return pos.error;
  return NextResponse.json({ success: true, data: { enabled: (await getSetting(PICKUP_SETTING_KEY)) === "true" } });
}

const bodySchema = z.object({ enabled: z.boolean() });

export async function PUT(request: NextRequest) {
  const pos = await requirePosMenu(IAM.pos);
  if (pos.error) return pos.error;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Data tidak valid" }, { status: 400 });
  try {
    await setSetting(PICKUP_SETTING_KEY, parsed.data.enabled ? "true" : "false");
    return NextResponse.json({ success: true, data: { enabled: parsed.data.enabled } });
  } catch (error) {
    console.error("[self-order-pickup] simpan gagal:", error);
    return NextResponse.json({ success: false, error: "Gagal menyimpan" }, { status: 500 });
  }
}
