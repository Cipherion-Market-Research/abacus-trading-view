export type KycStatus = "none" | "pending" | "approved";

export interface KycFormData {
  fullName: string;
  email: string;
  organization: string;
  jurisdiction: string;
  role: string;
  documentName?: string;
  walletAddress?: string;
}

export interface KycState {
  status: KycStatus;
  submittedAt?: number;
  approvedAt?: number;
  formData?: KycFormData;
}

const STORAGE_KEY = "ciphex-atlas-kyc";
const EVENT_NAME = "ciphex-atlas-kyc-changed";

export function getKycState(): KycState {
  if (typeof window === "undefined") return { status: "none" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { status: "none" };
    const parsed = JSON.parse(raw) as KycState;
    if (parsed && typeof parsed === "object" && "status" in parsed) {
      return parsed;
    }
    return { status: "none" };
  } catch {
    return { status: "none" };
  }
}

export function setKycState(state: KycState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function resetKyc(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

/**
 * Wipe ALL demo data: localStorage + Upstash catalog.
 * Used for fresh-slate demo resets before a walkthrough.
 * Does NOT affect on-chain state — tokens remain on devnet.
 */
export interface DemoResetAuth {
  wallet: string;
  nonce: string;
  timestamp: number;
  signature: string;
}

export async function resetAllDemoData(auth?: DemoResetAuth): Promise<void> {
  if (typeof window === "undefined") return;

  // Clear KYC
  localStorage.removeItem(STORAGE_KEY);

  // Clear created mints
  localStorage.removeItem("ciphex-atlas-mints");

  // Clear all distribution + register localStorage keys
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key?.startsWith("ciphex-atlas-distributions-") ||
      key?.startsWith("ciphex-atlas-register-")
    ) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));

  // Flush all Upstash stores (catalog + distributions + registers)
  if (auth) {
    try {
      const res = await fetch("/api/demo/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.warn("[demo-reset] Server flush failed:", data.error ?? res.status);
      }
    } catch (err) {
      console.warn("[demo-reset] Server flush failed:", err);
    }
  }

  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export { EVENT_NAME as KYC_EVENT };
