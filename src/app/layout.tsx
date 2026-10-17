import type { Metadata } from "next";
import "./globals.css";
import { SiteNav } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "FarmTrace — Organic Food Traceability",
  description: "Trace organic food from farm to shelf with GreenTrace AI."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><SiteNav />{children}</body></html>;
}
