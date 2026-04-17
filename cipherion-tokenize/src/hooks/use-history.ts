"use client";

import { useState, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { getTokenTransactions } from "@/lib/solana/history-service";
import { TokenServiceError, type TransactionInfo } from "@/lib/solana/types";

/**
 * Lazy-loaded history hook. Does NOT fetch on mount — call refetch() explicitly.
 *
 * MVP/DEVNET ACCOMMODATION: History is lazy to avoid rate-limiting on the public
 * devnet RPC. The dashboard already fires 3+ RPC calls on load (token info, metadata,
 * holders). Adding a batch getParsedTransactions on top exceeds the 100 req/10s limit.
 *
 * MAINNET UPGRADE: With a paid RPC (Helius $49/mo), auto-fetch on mount is fine.
 * Or use Helius webhooks to persist events to a DB and query locally.
 */
export function useHistory(mintAddress: string | null) {
  const [data, setData] = useState<TransactionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<TokenServiceError | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const refetch = useCallback(async () => {
    if (!mintAddress) {
      setData([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const mint = new PublicKey(mintAddress);
      // Fetch fewer transactions to reduce RPC pressure
      const txs = await getTokenTransactions(mint, { limit: 10 });
      setData(txs);
      setHasMore(txs.length === 10);
      setLoaded(true);
    } catch (err) {
      const tokenErr =
        err instanceof TokenServiceError
          ? err
          : new TokenServiceError(
              err instanceof Error ? err.message : "Failed to fetch history",
              "RPC_ERROR",
              err
            );
      setError(tokenErr);
      console.error("[useHistory]", tokenErr.message);
    } finally {
      setIsLoading(false);
    }
  }, [mintAddress]);

  const loadMore = useCallback(async () => {
    if (!mintAddress || data.length === 0 || !hasMore) return;

    setIsLoading(true);
    try {
      const mint = new PublicKey(mintAddress);
      const lastSig = data[data.length - 1].signature;
      const txs = await getTokenTransactions(mint, {
        before: lastSig,
        limit: 10,
      });
      setData((prev) => [...prev, ...txs]);
      setHasMore(txs.length === 10);
    } catch (err) {
      console.error("[useHistory] loadMore failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [mintAddress, data, hasMore]);

  return { data, isLoading, error, hasMore, loadMore, refetch, loaded };
}
