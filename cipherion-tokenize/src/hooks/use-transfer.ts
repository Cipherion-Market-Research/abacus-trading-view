"use client";

import { useState, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { transferTokens } from "@/lib/solana/token-service";
import { TokenServiceError } from "@/lib/solana/types";
import { toastSuccess, toastError } from "@/hooks/use-toast";
import { useNetwork } from "@/hooks/use-network";
import { useSendTransaction } from "@/hooks/use-send-transaction";

export function useTransfer() {
  const { signAndSend, publicKey } = useSendTransaction();
  const { explorerTxUrl } = useNetwork();
  const [isLoading, setIsLoading] = useState(false);

  const transfer = useCallback(
    async (
      mintAddress: string,
      recipientAddress: string,
      amount: bigint,
      decimals: number
    ) => {
      if (!publicKey) {
        toastError("Connect your wallet first");
        return null;
      }

      setIsLoading(true);
      try {
        const mint = new PublicKey(mintAddress);
        const to = new PublicKey(recipientAddress);
        const signature = await transferTokens(
          mint,
          to,
          amount,
          publicKey,
          signAndSend,
          decimals
        );
        toastSuccess("Transfer successful", {
          action: { label: "View TX", href: explorerTxUrl(signature) },
        });
        return signature;
      } catch (err) {
        const message =
          err instanceof TokenServiceError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Transfer failed";
        const code = err instanceof TokenServiceError ? err.code : "RPC_ERROR";

        if (code === "ACCOUNT_NOT_FOUND" || code === "ACCOUNT_FROZEN") {
          toastError(message);
        } else if (message.includes("User rejected")) {
          toastError("Transaction was rejected in your wallet.");
        } else if (message.includes("simulation failed")) {
          toastError("Transaction failed", { description: message });
        } else {
          toastError("Transfer failed", { description: message });
        }
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [publicKey, signAndSend, explorerTxUrl]
  );

  return { transfer, isLoading };
}
