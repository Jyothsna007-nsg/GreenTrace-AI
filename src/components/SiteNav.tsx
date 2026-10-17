"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf } from "lucide-react";

const links = [
  { label: "Farmer", href: "/dashboard/farmer" },
  { label: "Manufacturer", href: "/dashboard/manufacturer" },
  { label: "Distributor", href: "/dashboard/distributor" },
  { label: "Retailer", href: "/dashboard/retailer" },
  { label: "Consumer", href: "/dashboard/consumer" },
];
export function SiteNav() {
  const pathname = usePathname();
  return <header className="site-header"><nav className="nav-inner">
    <Link href="/" className="brand"><Leaf size={21} strokeWidth={2.1}/><span>FarmTrace</span></Link>
    <div className="nav-links">
      {links.map(link => <Link key={link.href} href={link.href} className={`nav-link ${pathname === link.href ? "active" : ""}`}>{link.label}</Link>)}
      <Link href="/track" className={`scan-link ${pathname === "/track" ? "scan-active" : ""}`}>Scan QR</Link>
    </div>
  </nav></header>;
}
