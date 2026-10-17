export type Role =
  | "farmer"
  | "manufacturer"
  | "distributor"
  | "retailer"
  | "consumer";

export type Batch = {
  id: string;
  product: string;
  category: string;
  quantity: string;
  unit: string;
  farmName: string;
  location: string;
  harvestDate: string;
  certification: string;
  farmerName: string;
  createdAt: string;

  // Blockchain metadata
  transactionHash?: string | null;
  blockNumber?: number | null;

  events: EventRecord[];
};

export type EventRecord = {
  type: string;
  date: string;
  location: string;
  notes: string;
  actor: string;
  quantity?: string;
};

const STORAGE_KEY = "greentrace-demo-batches";

export function getBatches(): Batch[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveBatch(batch: Batch) {
  const batches = getBatches();

  localStorage.setItem(STORAGE_KEY, JSON.stringify([batch, ...batches]));
}

export function updateBatch(updated: Batch) {
  const batches = getBatches().map((batch) =>
    batch.id === updated.id ? updated : batch,
  );

  localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
}

export function makeBatchId(product: string) {
  const prefix = product
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3)
    .padEnd(3, "X");

  return `${prefix}-${new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "")}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

export function replaceBatchesCache(batches: Batch[]) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
}
