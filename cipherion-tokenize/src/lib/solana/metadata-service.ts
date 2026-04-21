import { PublicKey, Transaction } from "@solana/web3.js";
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
  const tx = new Transaction();
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
