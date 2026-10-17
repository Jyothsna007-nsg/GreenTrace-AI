"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  Leaf,
  Package,
  QrCode,
  Sparkles,
} from "lucide-react";
import FarmerVoiceAssistant, {
  VoiceFarmerData,
} from "@/components/FarmerVoiceAssistant";
import {
  Batch,
  getBatches,
  makeBatchId,
  replaceBatchesCache,
} from "@/lib/demo";
import { QRCodeSVG } from "qrcode.react";
import {
  createBatchHash,
  recordBatchOnBlockchain,
} from "@/lib/blockchain/greenTrace";

type Role = "farmer" | "manufacturer" | "distributor" | "retailer" | "consumer";

type SupplyChainRole = "manufacturer" | "distributor" | "retailer";

type FreshChoiceResult = {
  batch: Batch;
  score: number;
  harvestScore: number;
  traceabilityScore: number;
  certificationScore: number;
  daysSinceHarvest: number | null;
  reasons: string[];
};

const config: Record<
  Role,
  {
    title: string;
    subtitle: string;
    metric2: string;
    formTitle: string;
    event: string;
    right1: string;
    right2: string;
  }
> = {
  farmer: {
    title: "Farmer",
    subtitle: "Register harvested batches",
    metric2: "Registered by farmers",
    formTitle: "Register a harvested batch",
    event: "Harvested",
    right1: "Your batches",
    right2: "",
  },

  manufacturer: {
    title: "Manufacturer",
    subtitle: "Process & package batches",
    metric2: "Waiting for you",
    formTitle: "Record a manufacturing event",
    event: "Processed",
    right1: "Incoming batches",
    right2: "Manufacturing complete",
  },

  distributor: {
    title: "Distributor",
    subtitle: "Dispatch & deliver shipments",
    metric2: "Waiting for you",
    formTitle: "Record a distribution event",
    event: "Dispatched",
    right1: "Incoming batches",
    right2: "Distribution complete",
  },

  retailer: {
    title: "Retailer",
    subtitle: "Receive stock & make products available",
    metric2: "Waiting for you",
    formTitle: "Record a retail event",
    event: "Received at store",
    right1: "Incoming batches",
    right2: "Ready for consumers",
  },

  consumer: {
    title: "Consumer",
    subtitle: "Scan a product to see its full journey",
    metric2: "Products available",
    formTitle: "Explore a product",
    event: "",
    right1: "Products on shelves",
    right2: "",
  },
};

const categories = [
  "Vegetables",
  "Fruits",
  "Grains",
  "Pulses",
  "Spices",
  "Dairy",
  "Other",
];

const eventOptions: Record<SupplyChainRole, string[]> = {
  manufacturer: ["Processed", "Quality checked", "Packaged"],
  distributor: ["Dispatched", "In transit", "Delivered to retailer"],
  retailer: ["Received at store", "Listed for sale"],
};

const fullJourneyEvents = [
  "Harvested",
  "Processed",
  "Quality checked",
  "Packaged",
  "Dispatched",
  "In transit",
  "Delivered to retailer",
  "Received at store",
  "Listed for sale",
];

function hasEvent(batch: Batch, eventType: string) {
  return batch.events.some((event) => event.type === eventType);
}

function getNextEvent(batch: Batch, role: SupplyChainRole): string | null {
  if (role === "manufacturer") {
    if (!hasEvent(batch, "Harvested")) {
      return null;
    }

    if (!hasEvent(batch, "Processed")) {
      return "Processed";
    }

    if (!hasEvent(batch, "Quality checked")) {
      return "Quality checked";
    }

    if (!hasEvent(batch, "Packaged")) {
      return "Packaged";
    }

    return null;
  }

  if (role === "distributor") {
    if (!hasEvent(batch, "Packaged")) {
      return null;
    }

    if (!hasEvent(batch, "Dispatched")) {
      return "Dispatched";
    }

    if (!hasEvent(batch, "In transit")) {
      return "In transit";
    }

    if (!hasEvent(batch, "Delivered to retailer")) {
      return "Delivered to retailer";
    }

    return null;
  }

  if (!hasEvent(batch, "Delivered to retailer")) {
    return null;
  }

  if (!hasEvent(batch, "Received at store")) {
    return "Received at store";
  }

  if (!hasEvent(batch, "Listed for sale")) {
    return "Listed for sale";
  }

  return null;
}

function isRoleComplete(batch: Batch, role: SupplyChainRole) {
  if (role === "manufacturer") {
    return hasEvent(batch, "Packaged");
  }

  if (role === "distributor") {
    return hasEvent(batch, "Delivered to retailer");
  }

  return hasEvent(batch, "Listed for sale");
}

// ======================================================
// FRESHCHOICE
// ======================================================

function getDaysSinceHarvest(harvestDate: string): number | null {
  if (!harvestDate) {
    return null;
  }

  const harvest = new Date(`${harvestDate}T00:00:00`);

  if (Number.isNaN(harvest.getTime())) {
    return null;
  }

  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const harvestDay = new Date(
    harvest.getFullYear(),
    harvest.getMonth(),
    harvest.getDate(),
  );

  const difference = today.getTime() - harvestDay.getTime();

  return Math.floor(difference / (1000 * 60 * 60 * 24));
}

function getHarvestScore(days: number | null) {
  if (days === null) {
    return 0;
  }

  if (days < 0) {
    return 0;
  }

  if (days <= 1) {
    return 40;
  }

  if (days <= 3) {
    return 35;
  }

  if (days <= 7) {
    return 30;
  }

  if (days <= 14) {
    return 20;
  }

  if (days <= 30) {
    return 10;
  }

  return 5;
}

function getFreshChoiceResult(batch: Batch): FreshChoiceResult {
  const daysSinceHarvest = getDaysSinceHarvest(batch.harvestDate);

  const harvestScore = getHarvestScore(daysSinceHarvest);

  const completedJourneyEvents = fullJourneyEvents.filter((eventType) =>
    hasEvent(batch, eventType),
  ).length;

  const traceabilityScore = Math.round(
    (completedJourneyEvents / fullJourneyEvents.length) * 40,
  );

  // A certification reference only means that a reference was provided.
  // It is not treated as independent proof that the product is certified.
  const certificationScore = batch.certification?.trim() ? 20 : 0;

  const score = harvestScore + traceabilityScore + certificationScore;

  const reasons: string[] = [];

  if (daysSinceHarvest !== null && daysSinceHarvest >= 0) {
    if (daysSinceHarvest === 0) {
      reasons.push("Harvest date is today");
    } else if (daysSinceHarvest === 1) {
      reasons.push("Harvested 1 day ago");
    } else {
      reasons.push(`Harvested ${daysSinceHarvest} days ago`);
    }
  }

  if (completedJourneyEvents === fullJourneyEvents.length) {
    reasons.push("Complete farm-to-shelf traceability journey");
  } else {
    reasons.push(
      `${completedJourneyEvents} of ${fullJourneyEvents.length} traceability stages recorded`,
    );
  }

  if (batch.certification?.trim()) {
    reasons.push("Certification reference provided");
  }

  return {
    batch,
    score,
    harvestScore,
    traceabilityScore,
    certificationScore,
    daysSinceHarvest,
    reasons,
  };
}

function compareFreshChoiceResults(a: FreshChoiceResult, b: FreshChoiceResult) {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  if (b.traceabilityScore !== a.traceabilityScore) {
    return b.traceabilityScore - a.traceabilityScore;
  }

  if (
    a.daysSinceHarvest !== null &&
    b.daysSinceHarvest !== null &&
    a.daysSinceHarvest !== b.daysSinceHarvest
  ) {
    return a.daysSinceHarvest - b.daysSinceHarvest;
  }

  return a.batch.product.localeCompare(b.batch.product);
}

// ======================================================
// DASHBOARD
// ======================================================

export default function Dashboard({ params }: { params: { role: string } }) {
  const role = params.role as Role;
  const c = config[role] || config.farmer;

  const [batches, setBatches] = useState<Batch[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    product: "",
    category: "Vegetables",
    quantity: "",
    unit: "kg",
    farmName: "",
    location: "",
    harvestDate: new Date().toLocaleDateString("en-CA"),
    certification: "",
    farmerName: "",
  });

  const [eventForm, setEventForm] = useState({
    batchId: "",
    event: c.event,
    date: new Date().toLocaleDateString("en-CA"),
    quantity: "",
    location: "",
    notes: "",
    actor: "",
  });

  const refreshBatches = useCallback(async () => {
    const response = await fetch("/api/batches", {
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Could not load batches from Supabase.");
    }

    const data = result as Batch[];

    replaceBatchesCache(data);
    setBatches(data);

    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBatches() {
      try {
        const response = await fetch("/api/batches", {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Could not load batches from Supabase.",
          );
        }

        if (!cancelled) {
          const data = result as Batch[];

          replaceBatchesCache(data);
          setBatches(data);
        }
      } catch (error) {
        console.error("Failed to load batches from Supabase:", error);

        if (!cancelled) {
          setBatches(getBatches());
        }
      }
    }

    void loadBatches();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateField = (key: string, value: string) => {
    setForm((old) => ({
      ...old,
      [key]: value,
    }));
  };

  const fillFormFromVoice = (data: VoiceFarmerData) => {
    setForm((old) => ({
      ...old,
      product: data.product ?? old.product,
      category: data.category ?? old.category,
      quantity: data.quantity ?? old.quantity,
      unit: data.unit ?? old.unit,
      farmName: data.farmName ?? old.farmName,
      location: data.location ?? old.location,
      harvestDate: data.harvestDate ?? old.harvestDate,
      certification: data.certification ?? old.certification,
      farmerName: data.farmerName ?? old.farmerName,
    }));
  };

  async function register(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMessage("");
    setBusy(true);

    try {
      if (
        !form.product.trim() ||
        !form.quantity ||
        Number(form.quantity) <= 0 ||
        !form.farmName.trim() ||
        !form.location.trim() ||
        !form.harvestDate ||
        !form.farmerName.trim()
      ) {
        setMessage("Please complete all required fields with valid values.");
        return;
      }

      const id = makeBatchId(form.product);

      console.log("NEW BATCH ID:", id);

      // ==================================================
      // STEP 1: SAVE BATCH TO SUPABASE
      // ==================================================

      const response = await fetch("/api/batches", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          ...form,
          id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to register batch.");
      }

      console.log("BATCH SAVED TO SUPABASE:", id);

      const batch: Batch = {
        ...form,
        id,
        createdAt: new Date().toISOString(),
        transactionHash: null,
        blockNumber: null,

        events: [
          {
            type: "Harvested",
            date: form.harvestDate,
            location: form.location,
            notes: "Batch registered by farmer",
            actor: form.farmerName,
            quantity: `${form.quantity} ${form.unit}`,
          },
        ],
      };

      console.log("REGISTERED BATCH:", batch);

      await refreshBatches();

      setMessage(`Batch ${id} saved to Supabase. Recording on Sepolia...`);

      // ==================================================
      // STEP 2: RECORD HASH ON SEPOLIA
      // ==================================================

      try {
        const blockchainData = {
          id,
          product: form.product.trim(),
          category: form.category,
          quantity: Number(form.quantity),
          unit: form.unit,
          farmName: form.farmName.trim(),
          location: form.location.trim(),
          harvestDate: form.harvestDate,
          certification: form.certification.trim(),
          farmerName: form.farmerName.trim(),
        };

        console.log("BLOCKCHAIN DATA:", blockchainData);

        const dataHash = createBatchHash(blockchainData);

        console.log("GENERATED DATA HASH:", dataHash);
        console.log("SENDING TRANSACTION TO SEPOLIA...");

        const transaction = await recordBatchOnBlockchain(id, dataHash);

        console.log("BLOCKCHAIN TRANSACTION:", transaction);

        // ==================================================
        // STEP 3: SAVE BLOCKCHAIN METADATA
        // ==================================================

        console.log("SAVING BLOCKCHAIN METADATA:", {
          batchId: id,
          transactionHash: transaction.transactionHash,
          blockNumber: transaction.blockNumber,
        });

        const blockchainResponse = await fetch("/api/batches/blockchain", {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            batchId: id,
            transactionHash: transaction.transactionHash,
            blockNumber: transaction.blockNumber,
          }),
        });

        console.log(
          "BLOCKCHAIN METADATA API STATUS:",
          blockchainResponse.status,
        );

        const blockchainResult = await blockchainResponse.json();

        console.log("BLOCKCHAIN METADATA API RESPONSE:", blockchainResult);

        if (!blockchainResponse.ok) {
          throw new Error(
            blockchainResult.error ||
              "Blockchain transaction succeeded, but saving its details to Supabase failed.",
          );
        }

        console.log("BLOCKCHAIN METADATA SAVED SUCCESSFULLY");

        await refreshBatches();

        setMessage(
          `Batch ${id} saved to Supabase and recorded on Sepolia. Transaction: ${transaction.transactionHash}`,
        );
      } catch (blockchainError) {
        console.error(
          "BLOCKCHAIN RECORDING OR METADATA ERROR:",
          blockchainError,
        );

        setMessage(
          `Batch ${id} is saved in Supabase, but blockchain recording or metadata saving failed. ${
            blockchainError instanceof Error
              ? blockchainError.message
              : "Please check the transaction before retrying."
          }`,
        );
      }

      setForm({
        product: "",
        category: "Vegetables",
        quantity: "",
        unit: "kg",
        farmName: "",
        location: "",
        harvestDate: new Date().toLocaleDateString("en-CA"),
        certification: "",
        farmerName: "",
      });
    } catch (error) {
      console.error("BATCH REGISTRATION ERROR:", error);

      setMessage(
        error instanceof Error ? error.message : "Could not save the batch.",
      );
    } finally {
      setBusy(false);
    }
  }

  // ======================================================
  // SUPPLY CHAIN
  // ======================================================

  const supplyChainRole =
    role === "manufacturer" || role === "distributor" || role === "retailer"
      ? role
      : null;

  const eligibleBatches = supplyChainRole
    ? batches.filter((batch) => getNextEvent(batch, supplyChainRole) !== null)
    : [];

  const completedBatches = supplyChainRole
    ? batches.filter((batch) => isRoleComplete(batch, supplyChainRole))
    : [];

  function selectEventBatch(selectedBatchId: string) {
    if (!supplyChainRole) {
      return;
    }

    const selectedBatch = batches.find((batch) => batch.id === selectedBatchId);

    const nextEvent = selectedBatch
      ? getNextEvent(selectedBatch, supplyChainRole)
      : eventOptions[supplyChainRole][0];

    setEventForm((old) => ({
      ...old,
      batchId: selectedBatchId,
      event: nextEvent || eventOptions[supplyChainRole][0],
    }));
  }

  async function recordEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMessage("");
    setBusy(true);

    try {
      if (!supplyChainRole) {
        setMessage("This role cannot record supply-chain events.");
        return;
      }

      const batch = batches.find((b) => b.id === eventForm.batchId);

      if (!batch) {
        setMessage(
          "Select a batch first. A farmer must register a batch before the next stage.",
        );
        return;
      }

      const expectedEvent = getNextEvent(batch, supplyChainRole);

      if (!expectedEvent) {
        setMessage("This batch has already completed this stage.");
        return;
      }

      if (eventForm.event !== expectedEvent) {
        setMessage(
          `The next required event for this batch is ${expectedEvent}.`,
        );
        return;
      }

      if (
        !eventForm.actor.trim() ||
        !eventForm.date ||
        !eventForm.location.trim()
      ) {
        setMessage("Please enter your name, date, and location/destination.");
        return;
      }

      const response = await fetch("/api/events", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          batchId: eventForm.batchId,
          event: expectedEvent,
          date: eventForm.date,
          location: eventForm.location,
          notes: eventForm.notes,
          actor: eventForm.actor,
          quantity: eventForm.quantity,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save event.");
      }

      const updatedBatches = await refreshBatches();

      const updatedBatch = updatedBatches.find(
        (item) => item.id === eventForm.batchId,
      );

      const nextEvent = updatedBatch
        ? getNextEvent(updatedBatch, supplyChainRole)
        : null;

      setMessage(
        nextEvent
          ? `${expectedEvent} saved successfully. Next step: ${nextEvent}.`
          : `${expectedEvent} saved successfully. ${c.title} stage complete.`,
      );

      setEventForm((old) => ({
        ...old,
        batchId: nextEvent ? old.batchId : "",
        event: nextEvent || eventOptions[supplyChainRole][0],
        quantity: "",
        location: "",
        notes: "",
      }));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save event.",
      );
    } finally {
      setBusy(false);
    }
  }

  // ======================================================
  // CONSUMER DASHBOARD + FRESHCHOICE
  // ======================================================

  if (role === "consumer") {
    const shelfProducts = batches.filter((batch) =>
      batch.events.some(
        (event) =>
          event.type === "Received at store" ||
          event.type === "Listed for sale",
      ),
    );

    const freshChoiceResults = shelfProducts
      .map(getFreshChoiceResult)
      .sort(compareFreshChoiceResults);

    const recommendedProduct =
      freshChoiceResults.length > 0 ? freshChoiceResults[0] : null;

    return (
      <main className="page-container dashboard-page consumer-dashboard">
        <div className="page-heading">
          <p className="kicker">PRODUCT TRANSPARENCY</p>

          <h1>Consumer</h1>

          <p>
            Scan a product&apos;s QR code to see its full journey — no wallet
            needed.
          </p>
        </div>

        <Link href="/track" className="button button-primary open-scanner">
          <QrCode size={19} />
          Open scanner
        </Link>

        {/* ==================================================
            FRESHCHOICE
        ================================================== */}

        <section className="section-block" style={{ marginTop: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "6px",
            }}
          >
            <Sparkles size={21} />

            <h2 style={{ margin: 0 }}>FreshChoice</h2>
          </div>

          <p
            className="muted"
            style={{
              marginTop: 0,
              marginBottom: "18px",
            }}
          >
            An explainable recommendation based on recorded harvest date,
            traceability progress, and whether a certification reference was
            provided.
          </p>

          {!recommendedProduct ? (
            <div className="empty-state">
              FreshChoice will appear when products reach the retailer.
            </div>
          ) : (
            <>
              <article
                className="batch-card"
                style={{
                  marginBottom: "20px",
                }}
              >
                <div className="batch-card-top">
                  <Leaf size={21} />

                  <span className="status-pill">
                    FreshChoice recommendation
                  </span>
                </div>

                <p className="kicker" style={{ marginTop: "14px" }}>
                  RECOMMENDED FROM AVAILABLE PRODUCTS
                </p>

                <h3>{recommendedProduct.batch.product}</h3>

                <p>
                  {recommendedProduct.batch.quantity}{" "}
                  {recommendedProduct.batch.unit} ·{" "}
                  {recommendedProduct.batch.category}
                </p>

                <p className="muted">
                  {recommendedProduct.batch.farmName} ·{" "}
                  {recommendedProduct.batch.location}
                </p>

                <div
                  style={{
                    marginTop: "16px",
                    display: "grid",
                    gap: "9px",
                  }}
                >
                  {recommendedProduct.reasons.map((reason) => (
                    <div
                      key={reason}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <CheckCircle2 size={16} />

                      <span>{reason}</span>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    padding: "12px",
                    border: "1px solid #ddd",
                    borderRadius: "10px",
                  }}
                >
                  <strong>
                    FreshChoice score: {recommendedProduct.score}/100
                  </strong>

                  <small
                    style={{
                      display: "block",
                      marginTop: "6px",
                    }}
                  >
                    Harvest recency: {recommendedProduct.harvestScore}/40 ·
                    Traceability: {recommendedProduct.traceabilityScore}/40 ·
                    Certification reference:{" "}
                    {recommendedProduct.certificationScore}/20
                  </small>
                </div>

                <Link
                  href={`/track?id=${encodeURIComponent(
                    recommendedProduct.batch.id,
                  )}`}
                  className="text-link"
                  style={{ marginTop: "16px" }}
                >
                  View recommended product journey
                  <ArrowUpRight size={15} />
                </Link>
              </article>

              {freshChoiceResults.length > 1 && (
                <div>
                  <h3>Compare available products</h3>

                  <div className="product-grid">
                    {freshChoiceResults.map((result, index) => (
                      <article className="batch-card" key={result.batch.id}>
                        <div className="batch-card-top">
                          <Package size={19} />

                          <span className="status-pill">
                            {index === 0
                              ? "Recommended"
                              : `${result.score}/100`}
                          </span>
                        </div>

                        <h3>{result.batch.product}</h3>

                        <p>Harvest: {result.batch.harvestDate}</p>

                        <p className="muted">
                          Traceability score: {result.traceabilityScore}/40
                        </p>

                        <p className="muted">
                          {result.batch.certification?.trim()
                            ? "Certification reference provided"
                            : "No certification reference provided"}
                        </p>

                        <Link
                          href={`/track?id=${encodeURIComponent(
                            result.batch.id,
                          )}`}
                          className="text-link"
                        >
                          View journey
                          <ArrowUpRight size={15} />
                        </Link>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <p
            className="muted"
            style={{
              marginTop: "16px",
              fontSize: "0.82rem",
            }}
          >
            FreshChoice compares recorded traceability information only. A
            higher score does not by itself prove that a product is safer,
            healthier, higher quality, or independently certified organic.
          </p>
        </section>

        {/* ==================================================
            PRODUCTS ON SHELVES
        ================================================== */}

        <section className="section-block">
          <h2>Products on shelves</h2>

          {shelfProducts.length === 0 ? (
            <div className="empty-state">Nothing here yet.</div>
          ) : (
            <div className="product-grid">
              {shelfProducts.map((b) => (
                <article className="batch-card" key={b.id}>
                  <div className="batch-card-top">
                    <Package size={20} />

                    <span className="status-pill">Traceable record</span>
                  </div>

                  <h3>{b.product}</h3>

                  <p>
                    {b.quantity} {b.unit} · {b.category}
                  </p>

                  <p className="muted">
                    {b.farmName} · {b.location}
                  </p>

                  <Link
                    href={`/track?id=${encodeURIComponent(b.id)}`}
                    className="text-link"
                  >
                    View journey
                    <ArrowUpRight size={15} />
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    );
  }

  // ======================================================
  // FARMER / MANUFACTURER / DISTRIBUTOR / RETAILER
  // ======================================================

  const isFarmer = role === "farmer";

  const blockchainBatches = batches.filter(
    (batch) =>
      Boolean(batch.transactionHash) &&
      batch.blockNumber !== null &&
      batch.blockNumber !== undefined,
  );

  const blockchainCount = blockchainBatches.length;

  return (
    <main className="page-container dashboard-page">
      <div className="page-heading">
        <p className="kicker">DASHBOARD</p>

        <h1>{c.title}</h1>

        <p>{c.subtitle}</p>
      </div>

      <section className="stats-grid">
        <div className="stat-card">
          <span>Total batches</span>
          <strong>{batches.length}</strong>
        </div>

        <div className="stat-card">
          <span>{c.metric2}</span>

          <strong>{isFarmer ? batches.length : eligibleBatches.length}</strong>
        </div>

        <div className="stat-card">
          <span>{isFarmer ? "Recorded events" : "Stage completed"}</span>

          <strong>
            {isFarmer
              ? batches.reduce((total, batch) => total + batch.events.length, 0)
              : completedBatches.length}
          </strong>
        </div>

        <div className="stat-card">
          <span>On blockchain</span>
          <strong>{blockchainCount}</strong>
        </div>
      </section>

      <div className="dashboard-columns">
        <section className="form-card">
          <h2>{c.formTitle}</h2>

          {isFarmer ? (
            <form onSubmit={register} className="field-grid">
              <label>
                Product
                <input
                  value={form.product}
                  onChange={(e) => updateField("product", e.target.value)}
                  placeholder="e.g. Tomatoes"
                  required
                />
              </label>

              <label>
                Category
                <select
                  value={form.category}
                  onChange={(e) => updateField("category", e.target.value)}
                >
                  {categories.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>

              <label>
                Quantity
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={form.quantity}
                  onChange={(e) => updateField("quantity", e.target.value)}
                  placeholder="500"
                  required
                />
              </label>

              <label>
                Unit
                <select
                  value={form.unit}
                  onChange={(e) => updateField("unit", e.target.value)}
                >
                  {["kg", "g", "tonnes", "litres", "units", "boxes"].map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </select>
              </label>

              <label>
                Farm name
                <input
                  value={form.farmName}
                  onChange={(e) => updateField("farmName", e.target.value)}
                  required
                />
              </label>

              <label>
                Farm location
                <input
                  value={form.location}
                  onChange={(e) => updateField("location", e.target.value)}
                  placeholder="Village, district, state"
                  required
                />
              </label>

              <label>
                Harvest date
                <input
                  type="date"
                  value={form.harvestDate}
                  onChange={(e) => updateField("harvestDate", e.target.value)}
                  required
                />
              </label>

              <label>
                Certification ref (optional)
                <input
                  value={form.certification}
                  onChange={(e) => updateField("certification", e.target.value)}
                  placeholder="Certificate ID"
                />
              </label>

              <label className="full-width">
                Your name
                <input
                  value={form.farmerName}
                  onChange={(e) => updateField("farmerName", e.target.value)}
                  required
                />
              </label>

              <button
                className="button button-primary submit-button"
                type="submit"
                disabled={busy}
              >
                {busy ? "Registering..." : "Register batch"}
              </button>
            </form>
          ) : (
            <form onSubmit={recordEvent} className="field-grid event-form">
              <label className="full-width">
                Batch
                <select
                  value={eventForm.batchId}
                  onChange={(e) => selectEventBatch(e.target.value)}
                  required
                >
                  <option value="">
                    {eligibleBatches.length
                      ? "Select a batch"
                      : "No batches ready for you"}
                  </option>

                  {eligibleBatches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.product} — {batch.id}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Next event
                <input
                  value={eventForm.event}
                  readOnly
                  placeholder="Select a batch first"
                />
              </label>

              <label>
                Date
                <input
                  type="date"
                  value={eventForm.date}
                  onChange={(e) =>
                    setEventForm((old) => ({
                      ...old,
                      date: e.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label>
                Quantity (optional)
                <input
                  value={eventForm.quantity}
                  onChange={(e) =>
                    setEventForm((old) => ({
                      ...old,
                      quantity: e.target.value,
                    }))
                  }
                  placeholder="e.g. 450 kg"
                />
              </label>

              <label>
                {role === "distributor" ? "Destination" : "Location"}

                <input
                  value={eventForm.location}
                  onChange={(e) =>
                    setEventForm((old) => ({
                      ...old,
                      location: e.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label className="full-width">
                Notes
                <textarea
                  value={eventForm.notes}
                  onChange={(e) =>
                    setEventForm((old) => ({
                      ...old,
                      notes: e.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="Optional details about this stage"
                />
              </label>

              <label className="full-width">
                Your name
                <input
                  value={eventForm.actor}
                  onChange={(e) =>
                    setEventForm((old) => ({
                      ...old,
                      actor: e.target.value,
                    }))
                  }
                  required
                />
              </label>

              <button
                className="button button-primary submit-button"
                type="submit"
                disabled={busy || eligibleBatches.length === 0}
              >
                {busy ? "Saving..." : "Record event"}
              </button>
            </form>
          )}

          {message && (
            <p
              className={`form-message ${
                message.startsWith("Please") ||
                message.startsWith("Select") ||
                message.startsWith("This")
                  ? "error"
                  : ""
              }`}
              role="status"
            >
              {message}
            </p>
          )}

          {isFarmer && <FarmerVoiceAssistant onFillForm={fillFormFromVoice} />}
        </section>

        <div className="right-panels">
          <section className="section-block">
            <h2>{c.right1}</h2>

            {(isFarmer ? batches : eligibleBatches).length === 0 ? (
              <div className="empty-state">Nothing here yet.</div>
            ) : (
              <div className="batch-list">
                {(isFarmer ? batches : eligibleBatches).map((batch) => (
                  <BatchRow key={batch.id} batch={batch} />
                ))}
              </div>
            )}
          </section>

          {!isFarmer && c.right2 && (
            <section className="section-block">
              <h2>{c.right2}</h2>

              {completedBatches.length === 0 ? (
                <div className="empty-state">Nothing here yet.</div>
              ) : (
                <div className="batch-list">
                  {completedBatches.map((batch) => (
                    <BatchRow key={batch.id} batch={batch} />
                  ))}
                </div>
              )}
            </section>
          )}

          {isFarmer && batches.length > 0 && (
            <section className="section-block">
              <h2>Batch QR codes</h2>

              <div className="qr-grid">
                {batches.map((batch) => (
                  <div className="qr-card" key={batch.id}>
                    <QRCodeSVG
                      value={`${
                        typeof window !== "undefined"
                          ? window.location.origin
                          : ""
                      }/track?id=${encodeURIComponent(batch.id)}`}
                      size={92}
                    />

                    <strong>{batch.product}</strong>

                    <small>{batch.id}</small>

                    <Link
                      href={`/track?id=${encodeURIComponent(batch.id)}`}
                      className="text-link"
                    >
                      Preview journey
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <p className="demo-note">
        Demo mode · Data is stored in Supabase. Confirmed blockchain
        transactions are recorded on Sepolia when wallet and contract
        integration succeeds.
      </p>
    </main>
  );
}

// ======================================================
// BATCH ROW
// ======================================================

function BatchRow({ batch }: { batch: Batch }) {
  const isOnBlockchain =
    Boolean(batch.transactionHash) &&
    batch.blockNumber !== null &&
    batch.blockNumber !== undefined;

  const shortTransactionHash = batch.transactionHash
    ? `${batch.transactionHash.slice(
        0,
        10,
      )}...${batch.transactionHash.slice(-6)}`
    : "";

  const etherscanUrl = batch.transactionHash
    ? `https://sepolia.etherscan.io/tx/${batch.transactionHash}`
    : "";

  return (
    <article className="batch-row">
      <div className="batch-row-main">
        <span className="batch-icon">
          <Package size={18} />
        </span>

        <div>
          <h3>{batch.product}</h3>

          <p>
            {batch.quantity} {batch.unit} · {batch.category}
          </p>

          <small>{batch.id}</small>

          {isOnBlockchain && (
            <div
              style={{
                marginTop: "10px",
                display: "grid",
                gap: "5px",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  width: "fit-content",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                }}
              >
                <CheckCircle2 size={15} />
                Recorded on Sepolia
              </span>

              <small>Block #{batch.blockNumber}</small>

              <small>Transaction: {shortTransactionHash}</small>

              <a
                href={etherscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link"
              >
                View on Sepolia Etherscan
                <ArrowUpRight size={14} />
              </a>
            </div>
          )}
        </div>
      </div>

      <span className="event-count">
        {batch.events.length} event
        {batch.events.length === 1 ? "" : "s"}
      </span>

      <Link
        className="text-link"
        href={`/track?id=${encodeURIComponent(batch.id)}`}
      >
        View <ArrowUpRight size={14} />
      </Link>
    </article>
  );
}
