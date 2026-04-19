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
}

const KEY = (mint: string) => `ciphex-atlas-distributions-${mint}`;

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
