import type { RegisterEntry } from "@/lib/utils/reconcile";

const STORAGE_KEY = (mint: string) => `ciphex-atlas-register-${mint}`;

export interface RegisterDocument {
  version: number;
  uploadedAt: number;
  uploadedBy: string;
  entries: RegisterEntry[];
}

// ── Sync localStorage operations ──

export function loadRegister(mint: string): RegisterEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY(mint));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRegisterLocal(mint: string, entries: RegisterEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY(mint), JSON.stringify(entries));
}

export function clearRegisterLocal(mint: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY(mint));
}

// ── Server communication ──

export async function saveRegisterToServer(
  mint: string,
  entries: RegisterEntry[],
  auth: { wallet: string; nonce: string; timestamp: number; signature: string }
): Promise<{ ok: boolean; version?: number; error?: string }> {
  try {
    const res = await fetch("/api/reconciliation/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        register: { mint, wallet: auth.wallet, entries },
        auth,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, version: data.version };
    return { ok: false, error: data.error ?? `Server returned ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function fetchRegisterFromServer(
  mint: string
): Promise<{ register: RegisterDocument | null; configured: boolean }> {
  try {
    const res = await fetch(`/api/reconciliation/register?mint=${encodeURIComponent(mint)}`);
    if (!res.ok) return { register: null, configured: true };
    const data = await res.json();
    return {
      register: data.register ?? null,
      configured: data.configured !== false,
    };
  } catch {
    return { register: null, configured: false };
  }
}
