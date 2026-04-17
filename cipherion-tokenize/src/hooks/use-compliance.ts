"use client";

import { useState, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { createAndThawAccount } from "@/lib/solana/account-service";
import { mintTokens } from "@/lib/solana/token-service";
import { TokenServiceError } from "@/lib/solana/types";
import { toastSuccess, toastError } from "@/hooks/use-toast";
import { useNetwork } from "@/hooks/use-network";
import { useSendTransaction } from "@/hooks/use-send-transaction";

export function useOnboardInvestor() {
  const { signAndSend, publicKey } = useSendTransaction();
  const { explorerTxUrl } = useNetwork();
  const [isLoading, setIsLoading] = useState(false);

  const onboard = useCallback(
    async (mintAddress: string, investorAddress: string) => {
      if (!publicKey) {
        toastError("Connect your wallet first");
        return null;
      }

      setIsLoading(true);
      try {
        const mint = new PublicKey(mintAddress);
        const investor = new PublicKey(investorAddress);
        const { ata, signature } = await createAndThawAccount(
          mint,
          investor,
          publicKey,
          signAndSend
        );
        toastSuccess("Investor onboarded", {
          description: "Account created and KYC approved.",
          action: { label: "View TX", href: explorerTxUrl(signature) },
        });
        return { ata, signature };
      } catch (err) {
        const message =
          err instanceof TokenServiceError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Onboarding failed";
        const code = err instanceof TokenServiceError ? err.code : "RPC_ERROR";
        if (code === "ALREADY_EXISTS") {
          toastError(message);
        } else if (message.includes("User rejected")) {
          toastError("Transaction was rejected in your wallet.");
        } else if (message.includes("simulation failed")) {
          toastError("Transaction failed", { description: message });
        } else {
          toastError("Onboarding failed", { description: message });
        }
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [publicKey, signAndSend, explorerTxUrl]
  );

  return { onboard, isLoading };
}

export function useMintTokens() {
  const { signAndSend, publicKey } = useSendTransaction();
  const { explorerTxUrl } = useNetwork();
  const [isLoading, setIsLoading] = useState(false);

  const mint = useCallback(
    async (mintAddress: string, amount: bigint, destination?: string) => {
      if (!publicKey) {
        toastError("Connect your wallet first");
        return null;
      }

      setIsLoading(true);
      try {
        const mintPk = new PublicKey(mintAddress);
        const destPk = destination ? new PublicKey(destination) : undefined;
        const signature = await mintTokens(
          mintPk,
          amount,
          destPk,
          publicKey,
          signAndSend
        );
        toastSuccess("Tokens minted", {
          action: { label: "View TX", href: explorerTxUrl(signature) },
        });
        return signature;
      } catch (err) {
        const message =
          err instanceof TokenServiceError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Mint failed";
        if (message.includes("User rejected")) {
          toastError("Transaction was rejected in your wallet.");
        } else if (message.includes("simulation failed")) {
          toastError("Transaction failed", { description: message });
        } else {
          toastError("Mint failed", { description: message });
        }
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [publicKey, signAndSend, explorerTxUrl]
  );

  return { mint, isLoading };
}
