import { redirect } from "next/navigation";
import { MOBILE_KASIR_ROUTE } from "@/features/pos/mobile-kasir/constants";

/** Alamat lama kasir mobile → alamat utama /kasir. */
export default function LegacyKasirRoute() {
  redirect(MOBILE_KASIR_ROUTE);
}
