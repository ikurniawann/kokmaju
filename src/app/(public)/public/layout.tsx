import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hubungi KoMa",
  description: "Kirim permintaan penawaran acara, katering, atau kerja sama ke KoMa.",
};

export default function PublicFormLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
