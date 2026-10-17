"use client";
import Link from "next/link";
import { ArrowRight, Sprout, Factory, Truck, Store, ScanLine } from "lucide-react";

const roles = [
  { step:"Step 1", name:"Farmer", desc:"Register harvested batches", href:"/dashboard/farmer", Icon:Sprout },
  { step:"Step 2", name:"Manufacturer", desc:"Process & package batches", href:"/dashboard/manufacturer", Icon:Factory },
  { step:"Step 3", name:"Distributor", desc:"Dispatch & deliver shipments", href:"/dashboard/distributor", Icon:Truck },
  { step:"Step 4", name:"Retailer", desc:"Receive stock & print QR codes", href:"/dashboard/retailer", Icon:Store },
  { step:"Step 5", name:"Consumer", desc:"Scan & verify a product", href:"/dashboard/consumer", Icon:ScanLine },
];
export default function Home() {
  return <main className="page-container home-page">
    <section className="hero">
      <p className="eyebrow hero-eyebrow">FARM → FACTORY → TRUCK → SHELF</p>
      <h1>Know exactly where your<br className="desktop-break"/> organic food has been.</h1>
      <p className="hero-copy">Every handover is recorded with a tamper-evident fingerprint. Scan the QR<br className="desktop-break"/> code on the pack to see the full journey.</p>
      <div className="hero-actions"><Link className="button button-light" href="/dashboard/farmer">Register a batch <ArrowRight size={17}/></Link><Link className="button button-outline" href="/track">Scan a product</Link></div>
    </section>
    <section className="roles-section">
      <h2>Choose your role</h2>
      <div className="role-grid">{roles.map(({step,name,desc,href,Icon})=><Link className="role-card" href={href} key={name}>
        <span className="step-label">{step}</span><Icon className="role-icon" size={27}/><h3>{name}</h3><p>{desc}</p>
      </Link>)}</div>
    </section>
    <p className="demo-note">Demo mode · Records are stored in this browser until the database and blockchain are connected.</p>
  </main>;
}
