"use client";

import { useCallback } from "react";

export interface RegisterMintInput {
  mint: string;
  creator: string;
  assetType: string;
  imageUri?: string;
  description?: string;
}

export function useRegisterMint() {
  const register = useCallback(async (input: RegisterMintInput) => {
    try {
      const res = await fetch("/api/mints/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
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
  }, []);

  return { register };
}
