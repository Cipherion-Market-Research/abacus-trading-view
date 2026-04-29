"use client";

import { useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { buildSignatureMessage } from "@/lib/api/auth-message";

export interface RegisterMintInput {
  mint: string;
  assetType: string;
  imageUri?: string;
  description?: string;
}

export function useRegisterMint() {
  const { publicKey, signMessage } = useWallet();

  const register = useCallback(async (input: RegisterMintInput) => {
    if (!publicKey || !signMessage) {
      console.warn("[useRegisterMint] Wallet not connected — skipping registration");
      return false;
    }

    try {
      const nonce = crypto.randomUUID();
      const timestamp = Date.now();
      const msg = buildSignatureMessage("register-mint", input.mint, nonce, timestamp);
      const sigBytes = await signMessage(new TextEncoder().encode(msg));
      const auth = {
        wallet: publicKey.toBase58(),
        nonce,
        timestamp,
        signature: Buffer.from(sigBytes).toString("base64"),
      };

      const res = await fetch("/api/mints/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: {
            mint: input.mint,
            assetType: input.assetType,
            imageUri: input.imageUri ?? "",
            description: input.description ?? "",
          },
          auth,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.warn(
          "[useRegisterMint] Registry write failed:",
          res.status,
          data?.error ?? "unknown"
        );
        return false;
      }
      return true;
    } catch (err) {
      console.warn(
        "[useRegisterMint] Registry write errored:",
        err instanceof Error ? err.message : err
      );
      return false;
    }
  }, [publicKey, signMessage]);

  return { register };
}
