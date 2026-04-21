import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getTokenMetadata as splGetTokenMetadata } from "@solana/spl-token";
import { createUpdateFieldInstruction } from "@solana/spl-token-metadata";
import { getConnection } from "./connection";
import { TokenServiceError, type TokenMetadataField } from "./types";

export async function getTokenMetadata(
  mint: PublicKey
): Promise<{
  name: string;
  symbol: string;
  uri: string;
  updateAuthority: PublicKey | null;
  additionalFields: TokenMetadataField[];
}> {
  const connection = getConnection();

  try {
    const metadata = await splGetTokenMetadata(
      connection,
      mint,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );

    if (!metadata) {
      return {
        name: "",
        symbol: "",
        uri: "",
        updateAuthority: null,
        additionalFields: [],
      };
    }

    return {
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.uri,
      updateAuthority: metadata.updateAuthority
        ? new PublicKey(metadata.updateAuthority)
        : null,
      additionalFields: (metadata.additionalMetadata || []).map(
        ([key, value]) => ({ key, value })
      ),
    };
  } catch (err) {
    throw new TokenServiceError(
      `Failed to read metadata for ${mint.toBase58()}`,
      "RPC_ERROR",
      err
    );
  }
}

export async function updateMetadataFields(
  mint: PublicKey,
  updateAuthority: PublicKey,
  fields: TokenMetadataField[],
  signAndSend: (tx: Transaction, signers: never[]) => Promise<string>
): Promise<string> {
  const connection = getConnection();
  const tx = new Transaction();

  // Token-2022 auto-reallocates the mint when metadata grows, but the account
  // must already hold enough lamports to cover the new rent-exempt minimum.
  // Estimate ceiling: each field could be brand-new (8 + key + value bytes).
  const additionalBytes = fields.reduce(
    (sum, f) => sum + 8 + f.key.length + f.value.length,
    0
  );

  const accountInfo = await connection.getAccountInfo(mint);
  if (!accountInfo) {
    throw new TokenServiceError("Mint account not found on-chain.", "ACCOUNT_NOT_FOUND");
  }

  const requiredRent = await connection.getMinimumBalanceForRentExemption(
    accountInfo.data.length + additionalBytes
  );
  const deficit = requiredRent - accountInfo.lamports;

  if (deficit > 0) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: updateAuthority,
        toPubkey: mint,
        lamports: deficit,
      })
    );
  }

  for (const field of fields) {
    tx.add(
      createUpdateFieldInstruction({
        programId: TOKEN_2022_PROGRAM_ID,
        metadata: mint,
        updateAuthority,
        field: field.key,
        value: field.value,
      })
    );
  }

  try {
    return await signAndSend(tx, []);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("User rejected") || message.includes("rejected the request")) {
      throw new TokenServiceError("Transaction was rejected in your wallet.", "WALLET_REJECTED", err);
    }
    throw new TokenServiceError(`Metadata update failed: ${message}`, "RPC_ERROR", err);
  }
}
