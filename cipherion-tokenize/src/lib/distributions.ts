export type DistributionStatus = "complete" | "partial" | "failed";
export type RecipientStatus = "pending" | "done" | "failed" | "skipped";

export interface DistributionRecipient {
  ownerAddress: string;
  amount: string; // bigint serialized
  signature?: string;
  status: RecipientStatus;
  error?: string;
}

export interface DistributionRecord {
  id: string;
  mintAddress: string;
  timestamp: number;
  totalAmount: string; // bigint serialized
  totalAllocated: string; // bigint serialized — actual sum after pro-rata rounding
  memo: string;
  recipients: DistributionRecipient[];
  status: DistributionStatus;
  serverSync?: "synced" | "pending"; // localStorage-only metadata
}

const KEY = (mint: string) => `ciphex-atlas-distributions-${mint}`;

// ── Sync localStorage operations (unchanged API surface) ──

export function loadDistributions(mintAddress: string): DistributionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY(mintAddress));
    if (!raw) return [];
    return JSON.parse(raw) as DistributionRecord[];
  } catch {
    return [];
  }
}

export function saveDistribution(record: DistributionRecord): void {
  if (typeof window === "undefined") return;
  const existing = loadDistributions(record.mintAddress);
  const updated = [record, ...existing.filter((r) => r.id !== record.id)];
  localStorage.setItem(KEY(record.mintAddress), JSON.stringify(updated));
}

export function newDistributionId(): string {
  return `dist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Pending-sync tracking ──

export function markSyncPending(mintAddress: string, id: string): void {
  if (typeof window === "undefined") return;
  const records = loadDistributions(mintAddress);
  const updated = records.map((r) =>
    r.id === id ? { ...r, serverSync: "pending" as const } : r
  );
  localStorage.setItem(KEY(mintAddress), JSON.stringify(updated));
}

export function markSyncComplete(mintAddress: string, id: string): void {
  if (typeof window === "undefined") return;
  const records = loadDistributions(mintAddress);
  const updated = records.map((r) =>
    r.id === id ? { ...r, serverSync: "synced" as const } : r
  );
  localStorage.setItem(KEY(mintAddress), JSON.stringify(updated));
}

export function getPendingSyncRecords(mintAddress: string): DistributionRecord[] {
  return loadDistributions(mintAddress).filter((r) => r.serverSync === "pending");
}

// ── Server communication ──

export async function postDistributionToServer(
  record: DistributionRecord,
  auth: { wallet: string; nonce: string; timestamp: number; signature: string }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/distributions/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record, auth }),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error ?? `Server returned ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function fetchDistributionsFromServer(
  mintAddress: string
): Promise<{ records: DistributionRecord[]; configured: boolean }> {
  try {
    const res = await fetch(`/api/distributions/list?mint=${encodeURIComponent(mintAddress)}`);
    if (!res.ok) return { records: [], configured: true };
    const data = await res.json();
    return {
      records: (data.records ?? []) as DistributionRecord[],
      configured: data.configured !== false,
    };
  } catch {
    return { records: [], configured: false };
  }
}
