import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createFreezeAccountInstruction,
  createThawAccountInstruction,
  createBurnCheckedInstruction,
  createPauseInstruction,
  createResumeInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { TokenServiceError } from "./types";

export async function freezeAccount(
  mint: PublicKey,
  owner: PublicKey,
  authority: PublicKey,
  signAndSend: (tx: Transaction, signers: Keypair[]) => Promise<string>
): Promise<string> {
  const ata = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_2022_PROGRAM_ID);
  const tx = new Transaction().add(
    createFreezeAccountInstruction(ata, mint, authority, [], TOKEN_2022_PROGRAM_ID)
  );
  try {
    return await signAndSend(tx, []);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("User rejected") || message.includes("rejected")) {
      throw new TokenServiceError("Transaction was rejected in your wallet.", "WALLET_REJECTED", err);
    }
    throw new TokenServiceError(`Freeze failed: ${message}`, "RPC_ERROR", err);
  }
}

export async function thawAccount(
  mint: PublicKey,
  owner: PublicKey,
  authority: PublicKey,
  signAndSend: (tx: Transaction, signers: Keypair[]) => Promise<string>
): Promise<string> {
  const ata = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_2022_PROGRAM_ID);
  const tx = new Transaction().add(
    createThawAccountInstruction(ata, mint, authority, [], TOKEN_2022_PROGRAM_ID)
  );
  try {
    return await signAndSend(tx, []);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("User rejected") || message.includes("rejected")) {
      throw new TokenServiceError("Transaction was rejected in your wallet.", "WALLET_REJECTED", err);
    }
    throw new TokenServiceError(`Thaw failed: ${message}`, "RPC_ERROR", err);
  }
}

export async function forceBurn(
  mint: PublicKey,
  owner: PublicKey,
  amount: bigint,
  decimals: number,
  authority: PublicKey,
  signAndSend: (tx: Transaction, signers: Keypair[]) => Promise<string>
): Promise<string> {
  const ata = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_2022_PROGRAM_ID);
  const tx = new Transaction().add(
    createBurnCheckedInstruction(ata, mint, authority, amount, decimals, [], TOKEN_2022_PROGRAM_ID)
  );
  try {
    return await signAndSend(tx, []);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("User rejected") || message.includes("rejected")) {
      throw new TokenServiceError("Transaction was rejected in your wallet.", "WALLET_REJECTED", err);
    }
    throw new TokenServiceError(`Force burn failed: ${message}`, "RPC_ERROR", err);
  }
}

export async function pauseToken(
  mint: PublicKey,
  authority: PublicKey,
  signAndSend: (tx: Transaction, signers: Keypair[]) => Promise<string>
): Promise<string> {
  const tx = new Transaction().add(
    createPauseInstruction(mint, authority, [], TOKEN_2022_PROGRAM_ID)
  );
  try {
    return await signAndSend(tx, []);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("User rejected") || message.includes("rejected")) {
      throw new TokenServiceError("Transaction was rejected in your wallet.", "WALLET_REJECTED", err);
    }
    if (message.includes("simulation failed")) {
      throw new TokenServiceError(
        "Pause failed — this token may not have the Pausable extension enabled.",
        "RPC_ERROR",
        err
      );
    }
    throw new TokenServiceError(`Pause failed: ${message}`, "RPC_ERROR", err);
  }
}

export async function unpauseToken(
  mint: PublicKey,
  authority: PublicKey,
  signAndSend: (tx: Transaction, signers: Keypair[]) => Promise<string>
): Promise<string> {
  const tx = new Transaction().add(
    createResumeInstruction(mint, authority, [], TOKEN_2022_PROGRAM_ID)
  );
  try {
    return await signAndSend(tx, []);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("User rejected") || message.includes("rejected")) {
      throw new TokenServiceError("Transaction was rejected in your wallet.", "WALLET_REJECTED", err);
    }
    throw new TokenServiceError(`Resume failed: ${message}`, "RPC_ERROR", err);
  }
}
