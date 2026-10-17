"use client";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, CheckCircle2, Leaf, Search, ShieldCheck } from "lucide-react";
import { Batch, getBatches } from "@/lib/demo";

export default function TrackPage() {
 const params=useSearchParams(); const [batchId,setBatchId]=useState(""); const [batch,setBatch]=useState<Batch|null>(null); const [error,setError]=useState(""); const [camera,setCamera]=useState(false);
 useEffect(()=>{const id=params.get("id");if(id){setBatchId(id);const found=getBatches().find(b=>b.id===id);if(found)setBatch(found);}},[params]);
 function track(e:FormEvent){e.preventDefault();const found=getBatches().find(b=>b.id.toLowerCase()===batchId.trim().toLowerCase());setBatch(found||null);setError(found?"":"No matching batch found in this browser demo. Check the batch ID or register a batch first.");}
 return <main className="track-container">
  <div className="track-heading"><h1>Scan a product</h1><p>Point your camera at the QR code on the pack, or enter the batch ID.</p></div>
  <section className="scanner-card">
   {camera?<div className="camera-placeholder"><Camera size={34}/><strong>Camera scanner</strong><p>Camera-based QR scanning will be enabled in the scanner integration step.</p><button className="button button-outline-dark" onClick={()=>setCamera(false)}>Close camera panel</button></div>:<button className="camera-button" onClick={()=>setCamera(true)}><Camera size={21}/> Start camera</button>}
  </section>
  <form className="track-search" onSubmit={track}><input aria-label="Batch ID" value={batchId} onChange={e=>setBatchId(e.target.value)} placeholder="e.g. TOM-20261010-AB12"/><button className="button button-primary" type="submit"><Search size={17}/> Track</button></form>
  {error&&<p className="track-error" role="status">{error}</p>}
  {batch&&<section className="journey-card"><div className="journey-title"><div><p className="kicker">PRODUCT TRACEABILITY</p><h2>{batch.product}</h2><p>{batch.quantity} {batch.unit} · {batch.category}</p></div><span className="demo-pill">Demo record</span></div>
   <div className="proof-notice"><ShieldCheck size={20}/><p><strong>Transparent record, not an organic certification.</strong><br/>This local demo shows information entered by participants. It does not independently verify organic status, food safety, or certification validity.</p></div>
   <div className="product-facts"><div><span>Batch ID</span><strong>{batch.id}</strong></div><div><span>Farm</span><strong>{batch.farmName}</strong></div><div><span>Farm location</span><strong>{batch.location}</strong></div><div><span>Harvest date</span><strong>{batch.harvestDate||"Not provided"}</strong></div><div><span>Certification reference</span><strong>{batch.certification||"Not provided"}</strong></div></div>
   <h3 className="journey-subtitle">Farm-to-shelf journey</h3><div className="timeline">{batch.events.map((ev,i)=><div className="timeline-item" key={i}><span className="timeline-dot"><CheckCircle2 size={16}/></span><div className="timeline-content"><div className="timeline-top"><h3>{ev.type}</h3><time>{ev.date}</time></div><p>{ev.location}</p>{ev.notes&&<p className="muted">{ev.notes}</p>}<small>Recorded by {ev.actor}</small></div></div>)}</div>
   <div className="proof-notice"><Leaf size={19}/><p>Integrity status: <strong>browser demo record</strong>. A confirmed blockchain transaction and transaction hash will appear here only after the wallet and smart contract are connected.</p></div>
  </section>}
 </main>;
}
