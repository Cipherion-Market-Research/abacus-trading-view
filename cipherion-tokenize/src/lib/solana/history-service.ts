import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getConnection } from "./connection";
import { TokenServiceError, type TransactionInfo } from "./types";

/**
 * MVP/DEVNET ACCOMMODATION: Uses only getSignaturesForAddress (single RPC call)
 * instead of getSignaturesForAddress + getParsedTransactions (batch call).
 *
 * Why: getParsedTransactions sends a batch of N RPC calls that triggers 429 rate
 * limiting on the public devnet endpoint (100 req/10s limit).
 *
 * Trade-off: We only get signature, timestamp, and error status — no parsed
 * instruction types, amounts, or addresses. Users click Explorer links for details.
 *
 * MAINNET UPGRADE: With a paid RPC (Helius $49/mo), uncomment the getParsedTransactions
 * block below. Or use Helius Enhanced Transaction API for pre-parsed history.
 * Or persist events via webhook to a local DB (best performance).
 *
 * See: plans/RWA_TOKEN_PLATFORM_IMPLEMENTATION_PLAN.md § "Known MVP Shortcuts"
 */
export async function getTokenTransactions(
  mint: PublicKey,
  options?: { before?: string; limit?: number; ownerWallet?: PublicKey }
): Promise<TransactionInfo[]> {
  const connection = getConnection();
  const limit = options?.limit ?? 20;

  const queryAddress = options?.ownerWallet
    ? getAssociatedTokenAddressSync(mint, options.ownerWallet, false, TOKEN_2022_PROGRAM_ID)
    : mint;

  try {
    const signatures = await connection.getSignaturesForAddress(
      queryAddress,
      { before: options?.before, limit },
      "confirmed"
    );

    if (signatures.length === 0) return [];

    // Lightweight mode: return signature-level data only (no batch fetch)
    return signatures.map((sig) => ({
      signature: sig.signature,
      blockTime: sig.blockTime ?? null,
      type: sig.err ? "unknown" as const : "unknown" as const,
      memo: sig.memo ?? undefined,
    }));

    // MAINNET UPGRADE: Uncomment below to get full parsed transaction details.
    // Requires paid RPC that won't 429 on batch getParsedTransactions.
    /*
    const txs = await connection.getParsedTransactions(
      signatures.map((s) => s.signature),
      { maxSupportedTransactionVersion: 0, commitment: "confirmed" }
    );
    // ... parse instruction types, amounts, addresses from txs
    */
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new TokenServiceError(
      `Failed to fetch transaction history: ${message}`,
      "RPC_ERROR",
      err
    );
  }
}
