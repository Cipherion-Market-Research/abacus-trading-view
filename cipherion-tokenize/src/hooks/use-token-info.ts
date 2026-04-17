"use client";

import { useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { getTokenInfo } from "@/lib/solana/token-service";
import { TokenServiceError, type TokenInfo } from "@/lib/solana/types";

export function useTokenInfo(mintAddress: string | null) {
  const [data, setData] = useState<TokenInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<TokenServiceError | null>(null);

  const refetch = useCallback(async () => {
    if (!mintAddress) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const mint = new PublicKey(mintAddress);
      const info = await getTokenInfo(mint);
      setData(info);
    } catch (err) {
      const tokenErr =
        err instanceof TokenServiceError
          ? err
          : new TokenServiceError(
              err instanceof Error ? err.message : "Failed to fetch token info",
              "RPC_ERROR",
              err
            );
      setError(tokenErr);
      console.error("[useTokenInfo]", tokenErr.message);
    } finally {
      setIsLoading(false);
    }
  }, [mintAddress]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
}
