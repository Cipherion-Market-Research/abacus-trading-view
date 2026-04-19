import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import type { HolderInfo } from "./types";
import { TokenServiceError } from "./types";

export interface DistributionAllocation {
  ownerAddress: string;
  ataAddress: string;
  currentBalance: bigint;
  pctOfSupply: number;
  amount: bigint;
  isFrozen: boolean;
  isTreasury: boolean;
}

export interface ComputeAllocationsParams {
  holders: HolderInfo[];
  totalAmount: bigint;
  treasuryOwner: PublicKey;
}

export interface ComputeAllocationsResult {
  allocations: DistributionAllocation[];
  eligibleCount: number;
  frozenCount: number;
  totalAllocated: bigint;
  remainder: bigint;
  circulatingSupply: bigint;
}

/**
 * Pro-rata allocation: each eligible holder receives
 *   allocation = (holderBalance / circulatingSupply) * totalAmount
 *
 * Excludes:
 *   - The treasury wallet (issuer's own ATA) — treasury doesn't yield to itself
 *   - Frozen accounts
 *   - Zero-balance accounts
 *
 * BigInt math means small remainders may exist after summing — that's fine,
 * they stay in the issuer's mint authority and are accounted for in the receipt.
 */
export function computeAllocations({
  holders,
  totalAmount,
  treasuryOwner,
}: ComputeAllocationsParams): ComputeAllocationsResult {
  const annotated: DistributionAllocation[] = holders.map((h) => ({
    ownerAddress: h.owner.toBase58(),
    ataAddress: h.address.toBase58(),
    currentBalance: h.balance,
    pctOfSupply: 0,
    amount: 0n,
    isFrozen: h.isFrozen,
    isTreasury: h.owner.equals(treasuryOwner),
  }));

  const eligible = annotated.filter(
    (a) => !a.isFrozen && !a.isTreasury && a.currentBalance > 0n
  );
  const circulatingSupply = eligible.reduce(
    (sum, a) => sum + a.currentBalance,
    0n
  );

  let totalAllocated = 0n;
  if (circulatingSupply > 0n) {
    for (const a of eligible) {
      a.amount = (a.currentBalance * totalAmount) / circulatingSupply;
      a.pctOfSupply =
        Number((a.currentBalance * 10000n) / circulatingSupply) / 100;
      totalAllocated += a.amount;
    }
  }

  const frozenCount = annotated.filter((a) => a.isFrozen).length;

  return {
    allocations: annotated,
    eligibleCount: eligible.length,
    frozenCount,
    totalAllocated,
    remainder: totalAmount - totalAllocated,
    circulatingSupply,
  };
}

/**
 * Mint `amount` of `mint` directly to `destinationOwner`'s ATA.
 * Caller must be the mint authority. ATA is assumed to exist (caller filtered
 * out non-holders upstream — anyone in the cap table has an ATA already).
 */
export async function mintToHolder(
  mint: PublicKey,
  destinationOwner: PublicKey,
  amount: bigint,
  payer: PublicKey,
  signAndSend: (tx: Transaction, signers: Keypair[]) => Promise<string>
): Promise<string> {
  const ata = getAssociatedTokenAddressSync(
    mint,
    destinationOwner,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  const tx = new Transaction().add(
    createMintToInstruction(mint, ata, payer, amount, [], TOKEN_2022_PROGRAM_ID)
  );
  try {
    return await signAndSend(tx, []);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("User rejected") || message.includes("rejected")) {
      throw new TokenServiceError(
        "Transaction was rejected in your wallet.",
        "WALLET_REJECTED",
        err
      );
    }
    throw new TokenServiceError(
      `Mint to ${destinationOwner.toBase58().slice(0, 8)}... failed: ${message}`,
      "RPC_ERROR",
      err
    );
  }
}
