"use client";

import { TableOrderApp } from "@/features/table-order/components/table-order-app";
import { PICKUP_CODE } from "@/lib/table-order/pickup";

/** /pesan/ambil — pesan pickup tanpa meja: bayar dulu, pilih jam ambil (EPIC-053). */
export default function PickupOrderPage() {
  return <TableOrderApp tableCode={PICKUP_CODE} homeHref="/pesan" />;
}
