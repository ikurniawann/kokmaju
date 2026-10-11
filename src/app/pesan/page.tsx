import { Suspense } from "react";
import { CustomerHome } from "@/features/customer-app/components/customer-home";

/** /pesan — beranda aplikasi pelanggan (start_url PWA). */
export default function CustomerHomePage() {
  return (
    <Suspense fallback={null}>
      <CustomerHome />
    </Suspense>
  );
}
