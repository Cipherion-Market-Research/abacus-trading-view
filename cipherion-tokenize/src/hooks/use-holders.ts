"use client";

import { useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { getTokenHolders } from "@/lib/solana/account-service";
import { TokenServiceError, type HolderInfo } from "@/lib/solana/types";

export function useHolders(mintAddress: string | null) {
  const [data, setData] = useState<HolderInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<TokenServiceError | null>(null);

  const refetch = useCallback(async () => {
    if (!mintAddress) {
      setData([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const mint = new PublicKey(mintAddress);
      const holders = await getTokenHolders(mint);
      setData(holders);
    } catch (err) {
      const tokenErr =
        err instanceof TokenServiceError
          ? err
          : new TokenServiceError(
              err instanceof Error ? err.message : "Failed to fetch holders",
              "RPC_ERROR",
              err
            );
      setError(tokenErr);
      console.error("[useHolders]", tokenErr.message);
    } finally {
      setIsLoading(false);
    }
  }, [mintAddress]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
}
