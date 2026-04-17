"use client";

import { useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { getCreatedMints } from "@/lib/solana/account-service";
import { getTokenInfo } from "@/lib/solana/token-service";
import { TokenServiceError, type TokenInfo } from "@/lib/solana/types";

export function useTokenList() {
  const { publicKey } = useWallet();
  const [data, setData] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<TokenServiceError | null>(null);

  const refetch = useCallback(async () => {
    if (!publicKey) {
      setData([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const mintAddresses = getCreatedMints();
      if (mintAddresses.length === 0) {
        setData([]);
        return;
      }

      const tokenInfos = await Promise.allSettled(
        mintAddresses.map((addr) => getTokenInfo(new PublicKey(addr)))
      );
      const resolved = tokenInfos
        .filter(
          (r): r is PromiseFulfilledResult<TokenInfo> =>
            r.status === "fulfilled"
        )
        .map((r) => r.value);
      setData(resolved);
    } catch (err) {
      const tokenErr =
        err instanceof TokenServiceError
          ? err
          : new TokenServiceError(
              err instanceof Error ? err.message : "Failed to fetch tokens",
              "RPC_ERROR",
              err
            );
      setError(tokenErr);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
}
