"use client";

import { useState, useCallback } from "react";
import { type PublicKey } from "@solana/web3.js";
import {
  createRwaToken,
  estimateCreateCost,
} from "@/lib/solana/token-service";
import { TokenServiceError, type CreateTokenParams } from "@/lib/solana/types";
import { saveCreatedMint } from "@/lib/solana/account-service";
import { toastSuccess, toastError } from "@/hooks/use-toast";
import { useNetwork } from "@/hooks/use-network";
import { useSendTransaction } from "@/hooks/use-send-transaction";

interface CreateResult {
  mint: PublicKey;
  signature: string;
}

export function useTokenCreate() {
  const { signAndSend, publicKey } = useSendTransaction();
  const { explorerAddressUrl } = useNetwork();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<TokenServiceError | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);

  const create = useCallback(
    async (params: CreateTokenParams) => {
      if (!publicKey) {
        toastError("Connect your wallet first");
        return null;
      }

      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        const { mint, signature } = await createRwaToken(
          params,
          publicKey,
          signAndSend
        );
        const res = { mint, signature };
        setResult(res);
        saveCreatedMint(mint);
        toastSuccess("Token created successfully", {
          description: `Mint: ${mint.toBase58().slice(0, 8)}...`,
          action: {
            label: "View on Explorer",
            href: explorerAddressUrl(mint.toBase58()),
          },
        });
        return res;
      } catch (err) {
        const tokenErr =
          err instanceof TokenServiceError
            ? err
            : new TokenServiceError(
                err instanceof Error ? err.message : "Unknown error",
                "RPC_ERROR",
                err
              );
        setError(tokenErr);
        toastError(tokenErr.message, {
          description:
            tokenErr.code === "WALLET_REJECTED"
              ? undefined
              : "Check the console for details.",
        });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [publicKey, signAndSend, explorerAddressUrl]
  );

  const estimate = useCallback(
    async (params: CreateTokenParams) => {
      try {
        return await estimateCreateCost(params);
      } catch {
        return null;
      }
    },
    []
  );

  return { create, estimate, isLoading, error, result };
}
