import type { Metadata } from "next";
import { BcdTwinPage } from "@/features/bcd-twin/components/bcd-twin-page";

export const metadata: Metadata = { title: "KoMa Twin" };

export default function Page() {
  return <BcdTwinPage />;
}
