import { Keypair, PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  AccountLayout,
  createThawAccountInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { getConnection } from "./connection";
import { TokenServiceError, type HolderInfo } from "./types";

export async function getTokenHolders(mint: PublicKey): Promise<HolderInfo[]> {
  const connection = getConnection();

  try {
    // MVP/DEVNET ACCOMMODATION: Using getTokenLargestAccounts instead of getProgramAccounts.
    //
    // Why: Public devnet RPC blocks getProgramAccounts for Token-2022 with error:
    //   "TokenzQd... excluded from account secondary indexes; this RPC method unavailable"
    //
    // Trade-off: Returns max 20 holders (sorted by balance). Sufficient for demo/pilot.
    //
    // MAINNET UPGRADE (when using paid RPC like Helius):
    //   Replace this call with:
    //     connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
    //       filters: [{ memcmp: { offset: 0, bytes: mint.toBase58() } }],
    //     })
    //   This returns ALL holders with no cap. Requires paid RPC that indexes Token-2022.
    //   Or use Helius DAS API: getTokenAccounts(mint) for paginated, indexed results.
    //
    // See: plans/RWA_TOKEN_PLATFORM_IMPLEMENTATION_PLAN.md § "Known MVP Shortcuts"
    const largestAccounts = await connection.getTokenLargestAccounts(mint, "confirmed");

    if (!largestAccounts.value || largestAccounts.value.length === 0) {
      return [];
    }

    // Fetch full account data in batch to get owner + frozen state
    const addresses = largestAccounts.value.map((a) => a.address);
    const accountInfos = await connection.getMultipleAccountsInfo(addresses, "confirmed");

    const holders: HolderInfo[] = [];
    for (let i = 0; i < addresses.length; i++) {
      const accountInfo = accountInfos[i];
      if (!accountInfo || accountInfo.data.length < 165) continue;

      try {
        const decoded = AccountLayout.decode(accountInfo.data.slice(0, 165));
        const balance = decoded.amount;
        const owner = new PublicKey(decoded.owner);
        const isFrozen = decoded.state === 2; // AccountState.Frozen = 2

        holders.push({
          address: addresses[i],
          owner,
          balance,
          isFrozen,
        });
      } catch {
        continue;
      }
    }

    holders.sort((a, b) => {
      if (b.balance > a.balance) return 1;
      if (b.balance < a.balance) return -1;
      return 0;
    });

    return holders;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[getTokenHolders] Failed: ${message}`);
    throw new TokenServiceError(
      `Failed to fetch holders for ${mint.toBase58()}: ${message}`,
      "RPC_ERROR",
      err
    );
  }
}

/**
 * MVP/DEVNET ACCOMMODATION: Track created mints in localStorage for the My Tokens list.
 *
 * Why: getProgramAccounts is blocked on public devnet RPC for Token-2022, and even on
 * paid RPCs it requires scanning every Token-2022 account to find mints by authority —
 * too slow and expensive for an MVP.
 *
 * Trade-off: Mints are only visible on the device/browser that created them. Clearing
 * browser data loses the list (tokens still exist on-chain, just not tracked locally).
 *
 * MAINNET UPGRADE:
 *   Tier 1: Postgres table (mint_address, creator_wallet, created_at). ~1 hour.
 *   Tier 2: Helius DAS API — getAssetsByAuthority(wallet). No custom DB needed.
 *   Tier 3: Helius webhook on mint creation → auto-populate DB in real-time.
 *
 * See: plans/RWA_TOKEN_PLATFORM_IMPLEMENTATION_PLAN.md § "Known MVP Shortcuts"
 */
const STORAGE_KEY = "ciphex-atlas-mints";

export function saveCreatedMint(mint: PublicKey): void {
  if (typeof window === "undefined") return;
  const existing = getCreatedMints();
  const address = mint.toBase58();
  if (!existing.includes(address)) {
    existing.push(address);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  }
}

export function getCreatedMints(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function createAndThawAccount(
  mint: PublicKey,
  owner: PublicKey,
  payer: PublicKey,
  signAndSend: (tx: Transaction, signers: Keypair[]) => Promise<string>
): Promise<{ ata: PublicKey; signature: string }> {
  const connection = getConnection();
  const ata = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_2022_PROGRAM_ID);

  const existing = await connection.getAccountInfo(ata);
  if (existing) {
    if (existing.data.length >= 165) {
      const decoded = AccountLayout.decode(existing.data.slice(0, 165));
      if (decoded.state === 2) {
        const thawTx = new Transaction().add(
          createThawAccountInstruction(ata, mint, payer, [], TOKEN_2022_PROGRAM_ID)
        );
        const sig = await signAndSend(thawTx, []);
        return { ata, signature: sig };
      }
    }
    throw new TokenServiceError(
      `Investor ${owner.toBase58().slice(0, 8)}... is already onboarded.`,
      "ALREADY_EXISTS"
    );
  }

  const instructions: TransactionInstruction[] = [
    createAssociatedTokenAccountInstruction(payer, ata, owner, mint, TOKEN_2022_PROGRAM_ID),
    createThawAccountInstruction(ata, mint, payer, [], TOKEN_2022_PROGRAM_ID),
  ];

  const tx = new Transaction().add(...instructions);
  const signature = await signAndSend(tx, []);
  return { ata, signature };
}
