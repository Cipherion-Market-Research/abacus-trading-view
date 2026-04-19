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

export type DistributionMode = "pro_rata" | "equal";

export interface ComputeAllocationsParams {
  holders: HolderInfo[];
  totalAmount: bigint;
  treasuryOwner: PublicKey;
  mode?: DistributionMode;
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
 * Compute per-holder allocation for a distribution.
 *
 * Modes:
 *   - "pro_rata" (default): allocation = (holderBalance / circulatingSupply) * totalAmount.
 *     Use for ongoing coupons / yield distributions. Skips zero-balance holders
 *     since they can't have a "share" of nothing. Matches BUIDL/BENJI mechanic.
 *   - "equal": totalAmount split evenly across all non-frozen, non-treasury
 *     holders regardless of current balance. Use for initial allocations and
 *     bootstrap distributions where holders haven't received anything yet.
 *
 * Excludes from both modes:
 *   - The treasury wallet (issuer's own ATA) — treasury doesn't yield to itself
 *   - Frozen accounts
 *
 * BigInt math means small remainders may exist after summing — they stay in
 * the issuer's mint authority and are surfaced in the receipt.
 */
export function computeAllocations({
  holders,
  totalAmount,
  treasuryOwner,
  mode = "pro_rata",
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

  // Eligibility differs by mode:
  // - pro_rata: needs existing balance (no balance = no share)
  // - equal: needs only to be a real holder (non-frozen, non-treasury) regardless of balance
  const eligible = annotated.filter((a) => {
    if (a.isFrozen || a.isTreasury) return false;
    if (mode === "pro_rata") return a.currentBalance > 0n;
    return true;
  });

  const circulatingSupply = eligible.reduce(
    (sum, a) => sum + a.currentBalance,
    0n
  );

  let totalAllocated = 0n;
  if (eligible.length > 0) {
    if (mode === "pro_rata" && circulatingSupply > 0n) {
      for (const a of eligible) {
        a.amount = (a.currentBalance * totalAmount) / circulatingSupply;
        a.pctOfSupply =
          Number((a.currentBalance * 10000n) / circulatingSupply) / 100;
        totalAllocated += a.amount;
      }
    } else if (mode === "equal") {
      const perHolder = totalAmount / BigInt(eligible.length);
      const sharePct = 100 / eligible.length;
      for (const a of eligible) {
        a.amount = perHolder;
        a.pctOfSupply = sharePct;
        totalAllocated += perHolder;
      }
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
