"use client";

import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { toastSuccess, toastError, toastInfo } from "@/hooks/use-toast";
import { isDevnet } from "@/lib/solana/connection";

export function useAirdrop() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [isLoading, setIsLoading] = useState(false);

  const requestAirdrop = useCallback(
    async (amount: number = 1) => {
      if (!publicKey) {
        toastError("Connect your wallet first");
        return;
      }
      if (!isDevnet()) {
        toastError("Airdrop is only available on Devnet");
        return;
      }

      setIsLoading(true);
      toastInfo("Requesting airdrop...", {
        description: "This may take a few seconds on devnet.",
      });

      try {
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();

        const signature = await connection.requestAirdrop(
          publicKey,
          amount * LAMPORTS_PER_SOL
        );

        await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          "confirmed"
        );

        toastSuccess(`Airdropped ${amount} SOL`, {
          description: "Your balance has been updated.",
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Airdrop failed";
        console.error("[useAirdrop] Failed:", message, err);
        if (
          message.includes("429") ||
          message.includes("rate") ||
          message.includes("Too many")
        ) {
          toastError("Airdrop rate limited", {
            description:
              "The public devnet faucet limits requests. Wait 30-60 seconds and try again, or use faucet.solana.com directly.",
          });
        } else if (message.includes("airdrop")) {
          toastError("Airdrop unavailable", {
            description:
              "The devnet faucet may be temporarily down. Use faucet.solana.com instead.",
          });
        } else {
          toastError("Airdrop failed", { description: message });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [connection, publicKey]
  );

  return { requestAirdrop, isLoading, available: isDevnet() };
}
