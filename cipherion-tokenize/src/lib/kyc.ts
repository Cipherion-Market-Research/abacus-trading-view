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

export { EVENT_NAME as KYC_EVENT };
