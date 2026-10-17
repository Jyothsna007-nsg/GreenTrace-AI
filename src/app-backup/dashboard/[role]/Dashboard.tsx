"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Mic, Package, QrCode, Sprout } from "lucide-react";
import { Batch, EventRecord, getBatches, makeBatchId, saveBatch, updateBatch } from "@/lib/demo";
import { QRCodeSVG } from "qrcode.react";

type Role = "farmer" | "manufacturer" | "distributor" | "retailer" | "consumer";
const config: Record<Role,{title:string;subtitle:string;metric2:string;formTitle:string;event:string;right1:string;right2:string}> = {
 farmer:{title:"Farmer",subtitle:"Register harvested batches",metric2:"Registered by farmers",formTitle:"Register a harvested batch",event:"Harvested",right1:"Your batches",right2:""},
 manufacturer:{title:"Manufacturer",subtitle:"Process & package batches",metric2:"Waiting for you",formTitle:"Record a supply-chain event",event:"Processed",right1:"Incoming batches",right2:"Handled by you"},
 distributor:{title:"Distributor",subtitle:"Dispatch & deliver shipments",metric2:"Waiting for you",formTitle:"Record a supply-chain event",event:"Dispatched",right1:"Incoming batches",right2:"Handled by you"},
 retailer:{title:"Retailer",subtitle:"Receive stock & print QR codes",metric2:"Waiting for you",formTitle:"Record a supply-chain event",event:"Received at store",right1:"Incoming batches",right2:"Handled by you"},
 consumer:{title:"Consumer",subtitle:"Scan a product to see its full journey",metric2:"Products available",formTitle:"Explore a product",event:"",right1:"Products on shelves",right2:""},
};
const categories = ["Vegetables","Fruits","Grains","Pulses","Spices","Dairy","Other"];
const eventOptions: Record<Exclude<Role,"farmer"|"consumer">,string[]> = {
 manufacturer:["Processed","Packaged","Quality checked"],
 distributor:["Dispatched","In transit","Delivered to retailer"],
 retailer:["Received at store","Listed for sale"],
};
const prettyDate = (date:string) => date ? new Date(date+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "Date not recorded";

export default function Dashboard({ params }: { params: { role: string } }) {
 const role = params.role as Role; const c = config[role] || config.farmer;
 const [batches,setBatches] = useState<Batch[]>([]);
 const [message,setMessage] = useState(""); const [busy,setBusy] = useState(false);
 const [form,setForm] = useState({product:"",category:"Vegetables",quantity:"",unit:"kg",farmName:"",location:"",harvestDate:"",certification:"",farmerName:""});
 const [eventForm,setEventForm] = useState({batchId:"",event:c.event,date:new Date().toISOString().slice(0,10),quantity:"",location:"",notes:"",actor:""});
 useEffect(()=>{setBatches(getBatches());},[]);
 const handled = useMemo(()=>batches.filter(b=>b.events.some(e=>e.actor.toLowerCase()===(eventForm.actor||"").toLowerCase())),[batches,eventForm.actor]);
 const updateField = (key:string,value:string) => setForm(old=>({...old,[key]:value}));
 function register(e:FormEvent) {
   e.preventDefault(); setMessage("");
   if(!form.product.trim()||!form.quantity||!form.farmName.trim()||!form.location.trim()||!form.harvestDate||!form.farmerName.trim()) {setMessage("Please complete all required fields.");return;}
   const id=makeBatchId(form.product);
   const batch:Batch={...form,id,createdAt:new Date().toISOString(),events:[{type:"Harvested",date:form.harvestDate,location:form.location,notes:"Batch registered by farmer",actor:form.farmerName,quantity:`${form.quantity} ${form.unit}`}]};
   saveBatch(batch);setBatches(getBatches());setMessage(`Batch ${id} registered in demo mode. No blockchain transaction has been submitted.`);setForm({product:"",category:"Vegetables",quantity:"",unit:"kg",farmName:"",location:"",harvestDate:"",certification:"",farmerName:""});
 }
 function recordEvent(e:FormEvent) {
   e.preventDefault();setMessage("");
   const batch=batches.find(b=>b.id===eventForm.batchId);
   if(!batch){setMessage("Select a batch first. A farmer must register a batch before the next stage.");return;}
   if(!eventForm.actor.trim()||!eventForm.date||!eventForm.location.trim()){setMessage("Please enter your name, date, and location/destination.");return;}
   const record:EventRecord={type:eventForm.event,date:eventForm.date,location:eventForm.location,notes:eventForm.notes,actor:eventForm.actor,quantity:eventForm.quantity};
   updateBatch({...batch,events:[...batch.events,record]});setBatches(getBatches());setMessage(`${eventForm.event} event saved in demo mode. No blockchain transaction has been submitted.`);
 }
 if(role==="consumer") return <main className="page-container dashboard-page consumer-dashboard">
   <div className="page-heading"><p className="kicker">PRODUCT TRANSPARENCY</p><h1>Consumer</h1><p>Scan a product’s QR code to see its full journey — no wallet needed.</p></div>
   <Link href="/track" className="button button-primary open-scanner"><QrCode size={19}/> Open scanner</Link>
   <section className="section-block"><h2>Products on shelves</h2>{batches.filter(b=>b.events.some(ev=>ev.type==="Received at store"||ev.type==="Listed for sale")).length===0?<div className="empty-state">Nothing here yet.</div>:<div className="product-grid">{batches.filter(b=>b.events.some(ev=>ev.type==="Received at store"||ev.type==="Listed for sale")).map(b=><article className="batch-card" key={b.id}><div className="batch-card-top"><Package size={20}/><span className="status-pill">Traceable demo record</span></div><h3>{b.product}</h3><p>{b.quantity} {b.unit} · {b.category}</p><p className="muted">{b.farmName} · {b.location}</p><Link href={`/track?id=${encodeURIComponent(b.id)}`} className="text-link">View journey <ArrowUpRight size={15}/></Link></article>)}</div>}</section>
 </main>;
 const isFarmer=role==="farmer";
 const incoming=batches.filter(b=>!b.events.some(ev=>ev.type===c.event));
 const done=batches.filter(b=>b.events.some(ev=>ev.type===c.event)||b.events.length>1);
 return <main className="page-container dashboard-page">
   <div className="page-heading"><p className="kicker">DASHBOARD</p><h1>{c.title}</h1><p>{c.subtitle}</p></div>
   <section className="stats-grid">
     <div className="stat-card"><span>Total batches</span><strong>{batches.length}</strong></div>
     <div className="stat-card"><span>{c.metric2}</span><strong>{isFarmer?batches.length:incoming.length}</strong></div>
     <div className="stat-card"><span>Events you recorded</span><strong>{isFarmer?batches.reduce((n,b)=>n+b.events.length,0):done.reduce((n,b)=>n+b.events.length-1,0)}</strong></div>
     <div className="stat-card"><span>On blockchain</span><strong>0</strong></div>
   </section>
   <div className="dashboard-columns">
    <section className="form-card">
      <h2>{c.formTitle}</h2>
      {isFarmer?<form onSubmit={register} className="field-grid">
        <label>Product<input value={form.product} onChange={e=>updateField("product",e.target.value)} placeholder="e.g. Organic Tomatoes" required/></label>
        <label>Category<select value={form.category} onChange={e=>updateField("category",e.target.value)}>{categories.map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Quantity<input type="number" min="0.01" step="any" value={form.quantity} onChange={e=>updateField("quantity",e.target.value)} placeholder="500" required/></label>
        <label>Unit<select value={form.unit} onChange={e=>updateField("unit",e.target.value)}>{["kg","g","tonnes","litres","units","boxes"].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Farm name<input value={form.farmName} onChange={e=>updateField("farmName",e.target.value)} required/></label>
        <label>Farm location<input value={form.location} onChange={e=>updateField("location",e.target.value)} placeholder="Village, district, state" required/></label>
        <label>Harvest date<input type="date" value={form.harvestDate} onChange={e=>updateField("harvestDate",e.target.value)} required/></label>
        <label>Certification ref (optional)<input value={form.certification} onChange={e=>updateField("certification",e.target.value)} placeholder="Certificate ID"/></label>
        <label className="full-width">Your name<input value={form.farmerName} onChange={e=>updateField("farmerName",e.target.value)} required/></label>
        <button className="button button-primary submit-button" type="submit">Register batch</button>
      </form>:<form onSubmit={recordEvent} className="field-grid event-form">
        <label className="full-width">Batch<select value={eventForm.batchId} onChange={e=>setEventForm(v=>({...v,batchId:e.target.value}))}><option value="">{batches.length?"Select a batch":"No batches ready for you"}</option>{batches.map(b=><option key={b.id} value={b.id}>{b.product} — {b.id}</option>)}</select></label>
        <label>Event<select value={eventForm.event} onChange={e=>setEventForm(v=>({...v,event:e.target.value}))}>{eventOptions[role as Exclude<Role,"farmer"|"consumer">].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Date<input type="date" value={eventForm.date} onChange={e=>setEventForm(v=>({...v,date:e.target.value}))} required/></label>
        <label>Quantity (optional)<input value={eventForm.quantity} onChange={e=>setEventForm(v=>({...v,quantity:e.target.value}))} placeholder="e.g. 450 kg"/></label>
        <label>{role==="distributor"?"Destination":"Location"}<input value={eventForm.location} onChange={e=>setEventForm(v=>({...v,location:e.target.value}))} required/></label>
        <label className="full-width">Notes<textarea value={eventForm.notes} onChange={e=>setEventForm(v=>({...v,notes:e.target.value}))} rows={2}/></label>
        <label className="full-width">Your name<input value={eventForm.actor} onChange={e=>setEventForm(v=>({...v,actor:e.target.value}))} required/></label>
        <button className="button button-primary submit-button" type="submit">Record event</button>
      </form>}
      {message&&<p className={`form-message ${message.startsWith("Please")||message.startsWith("Select")?"error":""}`} role="status">{message}</p>}
      {isFarmer&&<div className="voice-assistant-note"><Mic size={17}/><span><strong>Voice-to-batch assistant</strong><small>Telugu voice registration will be connected in the AI integration step.</small></span></div>}
    </section>
    <div className="right-panels">
      <section className="section-block"><h2>{c.right1}</h2>{(isFarmer?batches:incoming).length===0?<div className="empty-state">Nothing here yet.</div>:<div className="batch-list">{(isFarmer?batches:incoming).map(b=><BatchRow key={b.id} batch={b}/>)}</div>}</section>
      {c.right2&&<section className="section-block"><h2>{c.right2}</h2>{done.length===0?<div className="empty-state">Nothing here yet.</div>:<div className="batch-list">{done.map(b=><BatchRow key={b.id} batch={b}/>)}</div>}</section>}
      {isFarmer&&batches.length>0&&<section className="section-block"><h2>Batch QR codes</h2><div className="qr-grid">{batches.map(b=><div className="qr-card" key={b.id}><QRCodeSVG value={`${typeof window!=="undefined"?window.location.origin:""}/track?id=${b.id}`} size={92}/><strong>{b.product}</strong><small>{b.id}</small><Link href={`/track?id=${b.id}`} className="text-link">Preview journey</Link></div>)}</div></section>}
    </div>
   </div>
   <p className="demo-note">Demo mode · Data is stored in this browser. “On blockchain” counts only confirmed on-chain transactions and remains 0 until wallet and contract integration.</p>
 </main>;
}
function BatchRow({batch}:{batch:Batch}) {
 return <article className="batch-row"><div className="batch-row-main"><span className="batch-icon"><Package size={18}/></span><div><h3>{batch.product}</h3><p>{batch.quantity} {batch.unit} · {batch.category}</p><small>{batch.id}</small></div></div><span className="event-count">{batch.events.length} event{batch.events.length===1?"":"s"}</span><Link className="text-link" href={`/track?id=${batch.id}`}>View <ArrowUpRight size={14}/></Link></article>;
}
