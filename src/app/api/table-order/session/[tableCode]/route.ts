import { NextRequest, NextResponse } from "next/server";
import { getMemberSession } from "@/lib/member-portal/session";
import { loadTableByCode, loadVenueContext, tableLabel } from "@/lib/table-order/server";
import { getLoyaltyFeatures } from "@/lib/crm/loyalty-features-server";
import { loadStaticQris } from "@/lib/payments/static-qris";
import { getSetting } from "@/lib/settings/app-settings";
import { isPickupCode, PICKUP_PLACE_LABEL, PICKUP_SETTING_KEY } from "@/lib/table-order/pickup";

export const dynamic = "force-dynamic";

/**
 * GET /api/table-order/session/[tableCode] — konteks sesi self-order utk satu meja:
 * identitas meja (resolve qr_code / nomor meja → table_id), profil billing venue
 * (pajak/service yang berlaku), brand, ketersediaan QRIS, rate ARK, dan apakah
 * pemesan sedang login sebagai member (cookie portal member).
 *
 * Kode meja yang tidak terdaftar tetap boleh memesan (table_resolved=false) —
 * nomor meja disimpan di catatan order supaya kasir tetap tahu asalnya.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tableCode: string }> }
) {
  const { tableCode } = await params;
  const code = decodeURIComponent(tableCode || "").trim();

  if (!code) {
    return NextResponse.json({ success: false, error: "Kode meja wajib diisi" }, { status: 400 });
  }

  try {
    // Pickup tanpa meja (EPIC-053): kode khusus PICKUP, bukan meja.
    const pickup = isPickupCode(code);
    const [table, venue, member, loyalty, staticQris, pickupSetting] = await Promise.all([
      (pickup ? Promise.resolve(null) : loadTableByCode(code)).catch((error) => {
        console.warn("Table order table lookup warning:", error instanceof Error ? error.message : error);
        return null;
      }),
      loadVenueContext(),
      getMemberSession().catch(() => null),
      getLoyaltyFeatures(),
      loadStaticQris().catch(() => null),
      pickup ? getSetting(PICKUP_SETTING_KEY).catch(() => null) : Promise.resolve(null),
    ]);

    const inactiveTable = Boolean(table && table.is_active === false);

    return NextResponse.json({
      success: true,
      data: {
        table_id: table && !inactiveTable ? table.id : null,
        table_code: code.toUpperCase(),
        table_label: pickup ? PICKUP_PLACE_LABEL : tableLabel(inactiveTable ? null : table, code),
        table_area: table?.area ?? null,
        table_resolved: Boolean(table && !inactiveTable),
        status: table?.status ?? "available",
        order_type: pickup ? "takeaway" : "dine_in",
        mode: pickup ? "pickup" : "table",
        pickup_open: pickup ? pickupSetting === "true" : false,
        // Jam server utk menghitung pilihan jam ambil (jam HP bisa salah).
        server_now: new Date().toISOString(),
        brand_name: venue.brandName,
        billing: {
          profile: venue.billingProfileName,
          charges: venue.charges,
        },
        qris_available: venue.qrisAvailable,
        static_qris_available: staticQris?.available ?? false,
        static_qris_image_url: staticQris?.available ? staticQris.imageUrl : null,
        ark_rate: venue.arkRate,
        member_logged_in: Boolean(member),
        // Saklar fitur loyalty — UI menyembunyikan ARK Coin & info XP bila dimatikan.
        ark_enabled: loyalty.arkCoin,
        xp_enabled: loyalty.xp,
      },
    });
  } catch (error) {
    console.error("Table order session error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Gagal memuat sesi meja" },
      { status: 500 }
    );
  }
}
