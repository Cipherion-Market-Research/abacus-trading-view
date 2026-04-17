"use client";

import { useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, Transaction } from "@solana/web3.js";

/**
 * Shared transaction signing + simulation helper.
 * Simulates the transaction against the RPC first for real error logs,
 * then sends via wallet adapter.
 */
export function useSendTransaction() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const signAndSend = useCallback(
    async (tx: Transaction, signers: Keypair[]): Promise<string> => {
      if (!publicKey) throw new Error("Wallet not connected");

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      // Pre-flight simulation — get real Solana error logs before Phantom sees it
      try {
        const simTx = Transaction.from(tx.serialize({ verifySignatures: false }));
        simTx.recentBlockhash = blockhash;
        simTx.feePayer = publicKey;
        if (signers.length > 0) {
          simTx.partialSign(...signers);
        }

        const sim = await connection.simulateTransaction(simTx);
        if (sim.value.err) {
          console.error("[signAndSend] Simulation FAILED:", JSON.stringify(sim.value.err));
          console.error("[signAndSend] Logs:", sim.value.logs);
          const logHint = sim.value.logs
            ?.filter((l) => l.includes("Error") || l.includes("failed"))
            .join("; ");
          throw new Error(
            `Transaction simulation failed: ${JSON.stringify(sim.value.err)}${logHint ? ` — ${logHint}` : ""}`
          );
        }
        console.log("[signAndSend] Simulation PASSED");
      } catch (err) {
        if (err instanceof Error && err.message.includes("simulation failed")) {
          throw err; // Re-throw simulation errors
        }
        // Don't block on simulation RPC errors — let the wallet try
        console.warn("[signAndSend] Simulation skipped:", err);
      }

      // Send via wallet adapter (fresh tx, no partial signatures from simulation)
      const freshTx = Transaction.from(tx.serialize({ verifySignatures: false }));
      freshTx.recentBlockhash = blockhash;
      freshTx.feePayer = publicKey;

      const signature = await sendTransaction(freshTx, connection, {
        signers: signers.length > 0 ? signers : undefined,
      });
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );
      return signature;
    },
    [connection, publicKey, sendTransaction]
  );

  return { signAndSend, publicKey, connected: !!publicKey };
}
