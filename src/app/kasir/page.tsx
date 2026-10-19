import { redirect } from "next/navigation";
import { MOBILE_KASIR_ROUTE } from "@/features/pos/mobile-kasir/constants";

/** Alias pendek kasir mobile: kokmaju.reddie.id/kasir */
export default function KasirShortcut() {
  redirect(MOBILE_KASIR_ROUTE);
}
