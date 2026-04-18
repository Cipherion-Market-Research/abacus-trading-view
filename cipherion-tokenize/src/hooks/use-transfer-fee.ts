"use client";

import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getMint,
  getTransferFeeConfig,
} from "@solana/spl-token";
import { getConnection } from "@/lib/solana/connection";

export interface TransferFeeInfo {
  bps: number;
  maxFee: bigint;
}

export function useTransferFee(mint: PublicKey | null) {
  const [fee, setFee] = useState<TransferFeeInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mint) {
      setFee(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const connection = getConnection();
        const mintAccount = await getMint(
          connection,
          mint,
          "confirmed",
          TOKEN_2022_PROGRAM_ID
        );
        const config = getTransferFeeConfig(mintAccount);
        if (cancelled) return;
        if (!config) {
          setFee(null);
          return;
        }
        setFee({
          bps: config.newerTransferFee.transferFeeBasisPoints,
          maxFee: config.newerTransferFee.maximumFee,
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to read fee config");
        setFee(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mint]);

  return { fee, isLoading, error };
}
