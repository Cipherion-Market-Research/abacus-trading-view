import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getTokenMetadata as splGetTokenMetadata } from "@solana/spl-token";
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
