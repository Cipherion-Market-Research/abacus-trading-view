import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { getClient, isRegistryConfigured } from "@/lib/registry";
import { buildSignatureMessage } from "@/lib/api/auth-message";

const AUTH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const NONCE_TTL_S = 600; // 10 minutes

export interface WalletAuthFields {
  wallet: string;
  nonce: string;
  timestamp: number;
  signature: string;
}

function nonceKey(nonce: string): string {
  return `atlas:nonce:${nonce}`;
}

export { buildSignatureMessage };

export async function verifyWalletSignature(
  auth: WalletAuthFields,
  purpose: string,
  mint: string,
  opts?: { skipReplayCheck?: boolean }
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const now = Date.now();
  if (Math.abs(now - auth.timestamp) > AUTH_WINDOW_MS) {
    return { ok: false, error: "Signature expired — timestamp outside 5-minute window.", status: 401 };
  }

  let walletPk: PublicKey;
  try {
    walletPk = new PublicKey(auth.wallet);
  } catch {
    return { ok: false, error: "Invalid wallet public key.", status: 400 };
  }

  const message = buildSignatureMessage(purpose, mint, auth.nonce, auth.timestamp);
  const messageBytes = new TextEncoder().encode(message);

  let sigBytes: Uint8Array;
  try {
    sigBytes = Uint8Array.from(Buffer.from(auth.signature, "base64"));
  } catch {
    return { ok: false, error: "Malformed signature encoding.", status: 400 };
  }

  const valid = nacl.sign.detached.verify(messageBytes, sigBytes, walletPk.toBytes());
  if (!valid) {
    return { ok: false, error: "Signature verification failed.", status: 401 };
  }

  if (!opts?.skipReplayCheck) {
    if (!isRegistryConfigured()) {
      return { ok: false, error: "Replay protection unavailable — registry not configured.", status: 503 };
    }
    const redis = getClient();
    const key = nonceKey(auth.nonce);
    const set = await redis.set(key, "1", { nx: true, ex: NONCE_TTL_S });
    if (!set) {
      return { ok: false, error: "Nonce already used — possible replay.", status: 409 };
    }
  }

  return { ok: true };
}
