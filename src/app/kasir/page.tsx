import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { requireUser } from "@/lib/auth/require-user";
import { loadGrantedMenuCodesForUser } from "@/lib/iam/has-menu";
import { hasAnyIamMenuPrefix } from "@/lib/iam/match";
import { IAM } from "@/lib/iam/prefixes";
import { canAccessPath, isFullAccessRole } from "@/lib/iam/access";
import { brandName } from "@/lib/branding";
import { MobileKasirClient } from "@/features/pos/mobile-kasir";

// Kasir mobile layar penuh (kokmaju.reddie.id/kasir): di LUAR /dashboard/pos
// layout supaya tanpa sidebar/navbar (pola sama KDS fullscreen). Gerbang akses
// = gerbang layout POS.
export default async function Page() {
  const user = await requireUser();
  const grantedCodes = await loadGrantedMenuCodesForUser(user.id, user.role);
  const allowed =
    hasAnyIamMenuPrefix(grantedCodes, IAM.pos) ||
    (grantedCodes.length === 0 &&
      (isFullAccessRole(user.role) || canAccessPath(user.role, "/dashboard/pos")));
  if (!allowed) redirect("/dashboard");

  return (
    <>
      <MobileKasirClient cashierName={user.full_name || user.email} brandName={brandName()} />
      <Toaster position="top-center" richColors />
    </>
  );
}
