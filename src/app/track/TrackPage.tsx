"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  Leaf,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  Sprout,
  User,
  X,
  XCircle,
} from "lucide-react";

import { Batch } from "@/lib/demo";
import {
  createBatchHash,
  verifyBatchOnBlockchain,
} from "@/lib/blockchain/greenTrace";

type BlockchainVerificationStatus =
  | "idle"
  | "verifying"
  | "verified"
  | "mismatch"
  | "error";

export default function TrackPage() {
  const params = useSearchParams();

  const [batchId, setBatchId] = useState("");
  const [batch, setBatch] = useState<Batch | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [camera, setCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const [blockchainStatus, setBlockchainStatus] =
    useState<BlockchainVerificationStatus>("idle");

  const [blockchainError, setBlockchainError] = useState("");

  const scannerRef = useRef<{
    stop: () => Promise<void>;
    clear: () => void;
  } | null>(null);

  const scanHandledRef = useRef(false);

  const verifyBlockchainRecord = useCallback(async (batchToVerify: Batch) => {
    /*
     * Only attempt hash verification when this batch has
     * blockchain transaction metadata.
     */
    if (
      !batchToVerify.transactionHash ||
      batchToVerify.blockNumber === null ||
      batchToVerify.blockNumber === undefined
    ) {
      setBlockchainStatus("idle");
      setBlockchainError("");
      return;
    }

    setBlockchainStatus("verifying");
    setBlockchainError("");

    try {
      /*
       * IMPORTANT:
       *
       * This object must use the exact same fields AND property
       * insertion order that were used when the farmer originally
       * registered the batch on the blockchain.
       *
       * Supply-chain events are intentionally NOT included because
       * the contract stores the hash of the original batch
       * registration only.
       */
      const originalBatchData = {
        id: batchToVerify.id,
        product: batchToVerify.product.trim(),
        category: batchToVerify.category,
        quantity: Number(batchToVerify.quantity),
        unit: batchToVerify.unit,
        farmName: batchToVerify.farmName.trim(),
        location: batchToVerify.location.trim(),
        harvestDate: batchToVerify.harvestDate,
        certification: batchToVerify.certification.trim(),
        farmerName: batchToVerify.farmerName.trim(),
      };

      const dataHash = createBatchHash(originalBatchData);

      const matches = await verifyBatchOnBlockchain(batchToVerify.id, dataHash);

      if (matches) {
        setBlockchainStatus("verified");
      } else {
        setBlockchainStatus("mismatch");
      }
    } catch (err) {
      console.error("Blockchain verification error:", err);

      setBlockchainStatus("error");

      setBlockchainError(
        err instanceof Error
          ? err.message
          : "Could not verify this batch against Sepolia.",
      );
    }
  }, []);

  const findBatch = useCallback(
    async (id: string) => {
      const trimmedId = id.trim();

      if (!trimmedId) {
        setBatch(null);
        setError("Enter a batch ID to track a product.");
        setBlockchainStatus("idle");
        setBlockchainError("");
        return;
      }

      setLoading(true);
      setError("");
      setBlockchainStatus("idle");
      setBlockchainError("");

      try {
        const response = await fetch("/api/batches", {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            typeof result?.error === "string"
              ? result.error
              : "Could not load batch information.",
          );
        }

        const batches = result as Batch[];

        const found = batches.find(
          (item) => item.id.toLowerCase() === trimmedId.toLowerCase(),
        );

        if (found) {
          setBatch(found);
          setBatchId(found.id);
          setError("");

          /*
           * Verification is read-only.
           * The consumer does not need MetaMask.
           */
          void verifyBlockchainRecord(found);
        } else {
          setBatch(null);
          setBlockchainStatus("idle");

          setError(
            "No matching batch found in Supabase. Check the batch ID or register the batch first.",
          );
        }
      } catch (err) {
        setBatch(null);
        setBlockchainStatus("idle");

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load this product's journey. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    },
    [verifyBlockchainRecord],
  );

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;

    scannerRef.current = null;

    if (scanner) {
      try {
        await scanner.stop();
      } catch {
        // Scanner may already be stopped.
      }

      try {
        scanner.clear();
      } catch {
        // Ignore cleanup errors.
      }
    }

    setCamera(false);
  }, []);

  const extractBatchId = useCallback((decodedText: string) => {
    const value = decodedText.trim();

    if (!value) {
      return "";
    }

    /*
     * GreenTrace QR codes contain URLs such as:
     * http://localhost:3000/track?id=TOM-20261010-AB12
     */
    try {
      const url = new URL(value);
      const id = url.searchParams.get("id");

      if (id) {
        return id.trim();
      }
    } catch {
      // Not a URL. It may simply contain a batch ID.
    }

    return value;
  }, []);

  useEffect(() => {
    const id = params.get("id");

    if (!id) return;

    setBatchId(id);
    void findBatch(id);
  }, [params, findBatch]);

  useEffect(() => {
    if (!camera) {
      return;
    }

    let cancelled = false;

    async function startScanner() {
      try {
        setCameraError("");
        scanHandledRef.current = false;

        const { Html5Qrcode } = await import("html5-qrcode");

        if (cancelled) {
          return;
        }

        const scanner = new Html5Qrcode("greentrace-qr-reader");

        scannerRef.current = scanner;

        await scanner.start(
          {
            facingMode: "environment",
          },
          {
            fps: 10,
            qrbox: {
              width: 250,
              height: 250,
            },
          },
          async (decodedText) => {
            if (scanHandledRef.current) {
              return;
            }

            scanHandledRef.current = true;

            const scannedBatchId = extractBatchId(decodedText);

            if (!scannedBatchId) {
              scanHandledRef.current = false;
              return;
            }

            setBatchId(scannedBatchId);

            await stopCamera();

            void findBatch(scannedBatchId);
          },
          () => {
            // QR code has not been detected in this frame.
            // This is normal, so no error needs to be displayed.
          },
        );
      } catch (err) {
        console.error("Camera scanner error:", err);

        scannerRef.current = null;

        if (!cancelled) {
          setCameraError(
            "Could not start the camera. Allow camera permission in your browser and try again.",
          );
        }
      }
    }

    void startScanner();

    return () => {
      cancelled = true;

      const scanner = scannerRef.current;
      scannerRef.current = null;

      if (scanner) {
        scanner.stop().catch(() => {
          // Ignore cleanup error.
        });
      }
    };
  }, [camera, extractBatchId, findBatch, stopCamera]);

  function track(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    void findBatch(batchId);
  }

  const hasBlockchainRecord =
    Boolean(batch?.transactionHash) &&
    batch?.blockNumber !== null &&
    batch?.blockNumber !== undefined;

  return (
    <main className="track-container">
      <div className="track-heading">
        <p className="kicker">TRACE YOUR FOOD</p>

        <h1>Scan a product</h1>

        <p>
          Scan the QR code on a product or enter its batch ID to follow its
          journey from farm to shelf.
        </p>
      </div>

      <section className="scanner-card">
        {!camera ? (
          <button
            className="camera-button"
            type="button"
            onClick={() => {
              setCameraError("");
              setCamera(true);
            }}
          >
            <Camera size={21} />
            Start camera
          </button>
        ) : (
          <div className="camera-placeholder">
            <Camera size={28} />

            <strong>Scan GreenTrace QR code</strong>

            <p>
              Point the camera at the QR code generated for the product batch.
            </p>

            <div
              id="greentrace-qr-reader"
              style={{
                width: "100%",
                maxWidth: "420px",
                margin: "0 auto",
              }}
            />

            <button
              className="button button-outline-dark"
              type="button"
              onClick={() => {
                void stopCamera();
              }}
            >
              <X size={17} />
              Close camera
            </button>
          </div>
        )}

        {cameraError && (
          <p className="track-error" role="status">
            {cameraError}
          </p>
        )}
      </section>

      <form className="track-search" onSubmit={track}>
        <input
          aria-label="Batch ID"
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          placeholder="e.g. TOM-20261010-AB12"
        />

        <button
          className="button button-primary"
          type="submit"
          disabled={loading}
        >
          <Search size={17} />
          {loading ? "Searching..." : "Track"}
        </button>
      </form>

      {error && (
        <p className="track-error" role="status">
          {error}
        </p>
      )}

      {batch && (
        <section className="journey-card">
          <div className="journey-title">
            <div>
              <p className="kicker">PRODUCT TRACEABILITY</p>

              <h2>{batch.product}</h2>

              <p>
                {batch.quantity} {batch.unit} · {batch.category}
              </p>
            </div>

            <span className="demo-pill">
              <CheckCircle2 size={14} />
              Traceable record
            </span>
          </div>

          <div className="proof-notice">
            <ShieldCheck size={21} />

            <p>
              <strong>Transparent supply-chain record</strong>
              <br />
              The information below shows records submitted by participants in
              the supply chain. Traceability does not by itself prove organic
              certification or food safety.
            </p>
          </div>

          <h3 className="journey-subtitle">Product details</h3>

          <div className="product-facts">
            <div>
              <span>
                <Package size={15} /> Batch ID
              </span>
              <strong>{batch.id}</strong>
            </div>

            <div>
              <span>
                <Sprout size={15} /> Product
              </span>
              <strong>{batch.product}</strong>
            </div>

            <div>
              <span>Category</span>
              <strong>{batch.category}</strong>
            </div>

            <div>
              <span>Quantity</span>
              <strong>
                {batch.quantity} {batch.unit}
              </strong>
            </div>

            <div>
              <span>
                <User size={15} /> Farmer
              </span>
              <strong>{batch.farmerName || "Not provided"}</strong>
            </div>

            <div>
              <span>Farm</span>
              <strong>{batch.farmName}</strong>
            </div>

            <div>
              <span>
                <MapPin size={15} /> Farm location
              </span>
              <strong>{batch.location}</strong>
            </div>

            <div>
              <span>Harvest date</span>
              <strong>{batch.harvestDate || "Not provided"}</strong>
            </div>

            <div>
              <span>Certification reference</span>
              <strong>{batch.certification || "Not provided"}</strong>
            </div>
          </div>

          <h3 className="journey-subtitle">Farm-to-shelf journey</h3>

          {batch.events.length === 0 ? (
            <p className="muted">
              No supply-chain events have been recorded yet.
            </p>
          ) : (
            <div className="timeline">
              {batch.events.map((ev, i) => (
                <div
                  className="timeline-item"
                  key={`${ev.type}-${ev.date}-${i}`}
                >
                  <span className="timeline-dot">
                    <CheckCircle2 size={16} />
                  </span>

                  <div className="timeline-content">
                    <div className="timeline-top">
                      <h3>{ev.type}</h3>
                      <time>{ev.date}</time>
                    </div>

                    {ev.location && (
                      <p>
                        <MapPin size={14} /> {ev.location}
                      </p>
                    )}

                    {ev.notes && <p className="muted">{ev.notes}</p>}

                    <small>
                      Recorded by {ev.actor || "Supply-chain participant"}
                    </small>

                    {ev.quantity && <small>Quantity: {ev.quantity}</small>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="proof-notice">
            <Leaf size={20} />

            <p>
              <strong>{batch.events.length} supply-chain event(s)</strong>
              <br />
              This journey contains the events currently recorded for this batch
              in GreenTrace AI.
            </p>
          </div>

          {hasBlockchainRecord ? (
            <div className="proof-notice">
              <ShieldCheck size={20} />

              <div>
                <p style={{ margin: 0 }}>
                  <strong>Recorded on Ethereum Sepolia</strong>
                  <br />
                  The original batch registration has a corresponding blockchain
                  transaction.
                </p>

                <div
                  style={{
                    marginTop: "10px",
                    display: "grid",
                    gap: "5px",
                  }}
                >
                  <small>Block #{batch.blockNumber}</small>

                  <small>
                    Transaction: {batch.transactionHash!.slice(0, 10)}
                    ...
                    {batch.transactionHash!.slice(-6)}
                  </small>

                  <a
                    href={`https://sepolia.etherscan.io/tx/${batch.transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link"
                  >
                    View transaction on Sepolia Etherscan
                  </a>
                </div>

                <div
                  style={{
                    marginTop: "14px",
                  }}
                >
                  {blockchainStatus === "verifying" && (
                    <p className="muted" style={{ margin: 0 }}>
                      Checking batch hash against the Sepolia smart contract...
                    </p>
                  )}

                  {blockchainStatus === "verified" && (
                    <p
                      style={{
                        margin: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: "7px",
                        fontWeight: 600,
                      }}
                    >
                      <CheckCircle2 size={17} />
                      Batch hash matches blockchain record
                    </p>
                  )}

                  {blockchainStatus === "mismatch" && (
                    <p
                      style={{
                        margin: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: "7px",
                        fontWeight: 600,
                      }}
                    >
                      <XCircle size={17} />
                      Batch data does not match the blockchain record
                    </p>
                  )}

                  {blockchainStatus === "error" && (
                    <div>
                      <p
                        style={{
                          margin: 0,
                          display: "flex",
                          alignItems: "center",
                          gap: "7px",
                          fontWeight: 600,
                        }}
                      >
                        <XCircle size={17} />
                        Unable to verify blockchain record
                      </p>

                      {blockchainError && (
                        <small
                          className="muted"
                          style={{
                            display: "block",
                            marginTop: "5px",
                          }}
                        >
                          {blockchainError}
                        </small>
                      )}
                    </div>
                  )}
                </div>

                <p
                  className="muted"
                  style={{
                    marginTop: "12px",
                    marginBottom: 0,
                    fontSize: "0.8rem",
                  }}
                >
                  Blockchain verification compares the current original batch
                  registration data with the hash stored by the GreenTrace smart
                  contract on Sepolia. Supply-chain events are maintained
                  separately. A matching hash supports record integrity, but
                  does not by itself prove organic certification, food safety,
                  or product quality.
                </p>
              </div>
            </div>
          ) : (
            <div className="proof-notice">
              <ShieldCheck size={20} />

              <p>
                <strong>No blockchain transaction linked to this batch</strong>
                <br />
                This batch currently has no Sepolia transaction metadata stored
                in GreenTrace.
              </p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
