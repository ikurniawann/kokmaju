import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Careers | KoMa",
  description:
    "Explore open roles and apply to join the KoMa team.",
};

export default function CareerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
