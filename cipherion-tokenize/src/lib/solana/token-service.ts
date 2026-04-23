import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createInitializeDefaultAccountStateInstruction,
  createInitializeTransferFeeConfigInstruction,
  createInitializePermanentDelegateInstruction,
  createInitializeMetadataPointerInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createThawAccountInstruction,
  createTransferCheckedInstruction,
  createInitializePausableConfigInstruction,
  getAssociatedTokenAddressSync,
  getMintLen,
  getMint,
  AccountLayout,
  ExtensionType,
  AccountState,
} from "@solana/spl-token";
import {
  createInitializeInstruction as createInitializeMetadataInstruction,
  createUpdateFieldInstruction,
  pack,
  type TokenMetadata,
} from "@solana/spl-token-metadata";
import { getConnection } from "./connection";
import { TokenServiceError, type CreateTokenParams, type TokenInfo } from "./types";

function getExtensionTypes(params: CreateTokenParams): ExtensionType[] {
  const extensions: ExtensionType[] = [ExtensionType.MetadataPointer];

  if (params.extensions.defaultAccountState === "frozen") {
    extensions.push(ExtensionType.DefaultAccountState);
  }
  if (params.extensions.transferFee) {
    extensions.push(ExtensionType.TransferFeeConfig);
  }
  if (params.extensions.permanentDelegate) {
    extensions.push(ExtensionType.PermanentDelegate);
  }
  if (params.extensions.pausable) {
    extensions.push(ExtensionType.PausableConfig);
  }

  return extensions;
}

function buildTokenMetadata(
  params: CreateTokenParams,
  mint: PublicKey,
  updateAuthority: PublicKey
): TokenMetadata {
  return {
    mint,
    updateAuthority,
    name: params.name,
    symbol: params.symbol,
    uri: params.uri || "",
    additionalMetadata: params.metadata
      .filter((f) => f.key && f.value)
      .map((f) => [f.key, f.value] as [string, string]),
  };
}

export async function estimateCreateCost(
  params: CreateTokenParams
): Promise<{ lamports: number; mintLen: number }> {
  const connection = getConnection();
  const extensions = getExtensionTypes(params);
  const mintLen = getMintLen(extensions);
  const metadata = buildTokenMetadata(params, PublicKey.default, PublicKey.default);
  const packedMeta = pack(metadata);
  // Mint account rent + metadata rent (SystemProgram.transfer to cover realloc)
  const TYPE_SIZE = 2;
  const LENGTH_SIZE = 2;
  const totalDataSize = mintLen + TYPE_SIZE + LENGTH_SIZE + packedMeta.length;
  const lamports = await connection.getMinimumBalanceForRentExemption(totalDataSize);
  return { lamports, mintLen: totalDataSize };
}

export async function createRwaToken(
  params: CreateTokenParams,
  payer: PublicKey,
  signAndSend: (tx: Transaction, signers: Keypair[]) => Promise<string>
): Promise<{ mint: PublicKey; signature: string }> {
  const connection = getConnection();
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;

  const extensions = getExtensionTypes(params);
  const mintLen = getMintLen(extensions);

  console.log("[createRwaToken] Extensions:", extensions.map((e) => ExtensionType[e]));
  console.log("[createRwaToken] Mint account size (extensions only):", mintLen, "bytes");

  // Step 1: Calculate rent for JUST the mint + extensions (no metadata yet)
  let mintRent: number;
  try {
    mintRent = await connection.getMinimumBalanceForRentExemption(mintLen);
    console.log("[createRwaToken] Mint rent:", mintRent, "lamports");
  } catch (err) {
    throw new TokenServiceError(
      "Failed to calculate rent. Check your network connection.",
      "NETWORK_ERROR",
      err
    );
  }

  // Step 2: Calculate additional rent needed for metadata (auto-realloc)
  const tokenMetadata = buildTokenMetadata(params, mint, payer);
  const packedMeta = pack(tokenMetadata);
  const TYPE_SIZE = 2;
  const LENGTH_SIZE = 2;
  const fullAccountSize = mintLen + TYPE_SIZE + LENGTH_SIZE + packedMeta.length;
  const fullRent = await connection.getMinimumBalanceForRentExemption(fullAccountSize);
  const metadataRent = fullRent - mintRent;
  console.log("[createRwaToken] Metadata packed size:", packedMeta.length, "bytes");
  console.log("[createRwaToken] Additional rent for metadata:", metadataRent, "lamports");

  // === TRANSACTION 1: Create mint + extensions + metadata init ===
  const instructions: TransactionInstruction[] = [];

  // 1. Create account with ONLY mint+extension space
  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mint,
      space: mintLen,
      lamports: mintRent,
      programId: TOKEN_2022_PROGRAM_ID,
    })
  );

  // 2. Initialize extensions — ALL must come BEFORE initializeMint
  instructions.push(
    createInitializeMetadataPointerInstruction(
      mint,
      payer,
      mint,
      TOKEN_2022_PROGRAM_ID
    )
  );

  if (params.extensions.defaultAccountState === "frozen") {
    instructions.push(
      createInitializeDefaultAccountStateInstruction(
        mint,
        AccountState.Frozen,
        TOKEN_2022_PROGRAM_ID
      )
    );
  }

  if (params.extensions.transferFee) {
    instructions.push(
      createInitializeTransferFeeConfigInstruction(
        mint,
        payer,
        payer,
        params.extensions.transferFee.bps,
        params.extensions.transferFee.maxFee,
        TOKEN_2022_PROGRAM_ID
      )
    );
  }

  if (params.extensions.permanentDelegate) {
    instructions.push(
      createInitializePermanentDelegateInstruction(
        mint,
        params.extensions.permanentDelegate,
        TOKEN_2022_PROGRAM_ID
      )
    );
  }

  if (params.extensions.pausable) {
    instructions.push(
      createInitializePausableConfigInstruction(
        mint,
        payer, // pause authority
        TOKEN_2022_PROGRAM_ID
      )
    );
  }

  // 3. Initialize the mint
  instructions.push(
    createInitializeMintInstruction(
      mint,
      params.decimals,
      payer, // mint authority
      payer, // freeze authority (always set)
      TOKEN_2022_PROGRAM_ID
    )
  );

  // 4. Transfer additional lamports to the mint for metadata realloc
  if (metadataRent > 0) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: mint,
        lamports: metadataRent,
      })
    );
  }

  // 5. Initialize metadata — Token-2022 auto-reallocs the account using deposited lamports
  instructions.push(
    createInitializeMetadataInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      mint,
      metadata: mint,
      mintAuthority: payer,
      name: params.name,
      symbol: params.symbol,
      uri: params.uri || "",
      updateAuthority: payer,
    })
  );

  // 6. Metadata fields are added in separate TXs (TX2+) to keep TX1
  //    under the 1232-byte Solana packet limit when multiple extensions are enabled.
  const metadataFields = params.metadata.filter((f) => f.key && f.value);
  const FIELDS_PER_TX = 3;

  // Build TX1
  // Note: simulation is handled by the signAndSend helper (use-send-transaction.ts)
  const tx1 = new Transaction().add(...instructions);
  let signature: string;
  try {
    signature = await signAndSend(tx1, [mintKeypair]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[createRwaToken] TX1 send failed:", message, err);
    if (message.includes("User rejected") || message.includes("rejected the request")) {
      throw new TokenServiceError("Transaction was rejected in your wallet.", "WALLET_REJECTED", err);
    }
    if (message.includes("insufficient") || message.includes("0x1")) {
      throw new TokenServiceError("Insufficient SOL balance for this transaction.", "INSUFFICIENT_SOL", err);
    }
    throw new TokenServiceError(`Token creation failed: ${message}`, "RPC_ERROR", err);
  }

  // === TX2+: All metadata fields ===
  for (let i = 0; i < metadataFields.length; i += FIELDS_PER_TX) {
    const batch = metadataFields.slice(i, i + FIELDS_PER_TX);
    const metaTx = new Transaction();
    for (const field of batch) {
      metaTx.add(
        createUpdateFieldInstruction({
          programId: TOKEN_2022_PROGRAM_ID,
          metadata: mint,
          updateAuthority: payer,
          field: field.key,
          value: field.value,
        })
      );
    }
    try {
      await signAndSend(metaTx, []);
    } catch (err) {
      console.error("[createRwaToken] Metadata batch failed:", err);
    }
  }

  // === TX3: Mint initial supply ===
  // Must thaw the ATA first if DefaultAccountState=Frozen (same fix as mintTokens)
  if (params.initialSupply && params.initialSupply > 0n) {
    const ata = getAssociatedTokenAddressSync(mint, payer, false, TOKEN_2022_PROGRAM_ID);
    const mintTx = new Transaction();
    const ataInfo = await connection.getAccountInfo(ata);
    if (!ataInfo) {
      mintTx.add(createAssociatedTokenAccountInstruction(payer, ata, payer, mint, TOKEN_2022_PROGRAM_ID));
    }
    // Thaw the ATA if the token uses DefaultAccountState=Frozen
    if (params.extensions.defaultAccountState === "frozen") {
      mintTx.add(createThawAccountInstruction(ata, mint, payer, [], TOKEN_2022_PROGRAM_ID));
    } else if (ataInfo && ataInfo.data.length >= 165) {
      const decoded = AccountLayout.decode(ataInfo.data.slice(0, 165));
      if (decoded.state === 2) {
        mintTx.add(createThawAccountInstruction(ata, mint, payer, [], TOKEN_2022_PROGRAM_ID));
      }
    }
    mintTx.add(createMintToInstruction(mint, ata, payer, params.initialSupply, [], TOKEN_2022_PROGRAM_ID));
    try {
      await signAndSend(mintTx, []);
    } catch (err) {
      console.error("[createRwaToken] Mint supply failed:", err);
    }
  }

  return { mint, signature };
}

export async function getTokenInfo(mintAddress: PublicKey): Promise<TokenInfo> {
  const connection = getConnection();

  try {
    const mintAccount = await getMint(
      connection,
      mintAddress,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );

    // Read metadata
    const { getTokenMetadata } = await import("./metadata-service");
    const metadata = await getTokenMetadata(mintAddress);

    // Detect extensions from the mint account
    const extensions: TokenInfo["extensions"] = {};

    // Check if default account state extension exists
    if (mintAccount.freezeAuthority) {
      // If freeze authority is set, KYC gating is likely enabled
      extensions.defaultAccountState = "frozen";
    }

    // Transfer fee detection would require reading extension data
    // For now, basic info is sufficient

    return {
      mint: mintAddress,
      name: metadata.name,
      symbol: metadata.symbol,
      decimals: mintAccount.decimals,
      supply: mintAccount.supply,
      mintAuthority: mintAccount.mintAuthority,
      freezeAuthority: mintAccount.freezeAuthority,
      extensions,
      metadata: metadata.additionalFields,
      uri: metadata.uri,
    };
  } catch (err) {
    if (err instanceof TokenServiceError) throw err;
    throw new TokenServiceError(
      `Failed to fetch token info for ${mintAddress.toBase58()}`,
      "RPC_ERROR",
      err
    );
  }
}


export async function mintTokens(
  mint: PublicKey,
  amount: bigint,
  destination: PublicKey | undefined,
  payer: PublicKey,
  signAndSend: (tx: Transaction, signers: Keypair[]) => Promise<string>
): Promise<string> {
  const connection = getConnection();
  const destOwner = destination ?? payer;
  const ata = getAssociatedTokenAddressSync(mint, destOwner, false, TOKEN_2022_PROGRAM_ID);
  const instructions: TransactionInstruction[] = [];

  const ataInfo = await connection.getAccountInfo(ata);
  let needsThaw = false;

  if (!ataInfo) {
    // ATA doesn't exist — create it. If the mint has DefaultAccountState=Frozen,
    // the new ATA will start frozen and we need to thaw before minting.
    instructions.push(createAssociatedTokenAccountInstruction(payer, ata, destOwner, mint, TOKEN_2022_PROGRAM_ID));

    // Check if this mint uses DefaultAccountState=Frozen
    const mintAccount = await getMint(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
    if (mintAccount.freezeAuthority) {
      // Mint has a freeze authority — likely uses DefaultAccountState=Frozen.
      // Thaw the ATA so we can mint to it. Payer must be the freeze authority.
      needsThaw = true;
    }
  } else {
    // ATA exists — check if it's frozen
    if (ataInfo.data.length >= 165) {
      const decoded = AccountLayout.decode(ataInfo.data.slice(0, 165));
      if (decoded.state === 2) {
        needsThaw = true;
      }
    }
  }

  if (needsThaw) {
    instructions.push(
      createThawAccountInstruction(ata, mint, payer, [], TOKEN_2022_PROGRAM_ID)
    );
  }

  instructions.push(createMintToInstruction(mint, ata, payer, amount, [], TOKEN_2022_PROGRAM_ID));
  const transaction = new Transaction().add(...instructions);
  try {
    return await signAndSend(transaction, []);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("User rejected") || message.includes("rejected")) {
      throw new TokenServiceError("Transaction was rejected in your wallet.", "WALLET_REJECTED", err);
    }
    throw new TokenServiceError(`Mint failed: ${message}`, "RPC_ERROR", err);
  }
}

export async function transferTokens(
  mint: PublicKey,
  to: PublicKey,
  amount: bigint,
  payer: PublicKey,
  signAndSend: (tx: Transaction, signers: Keypair[]) => Promise<string>,
  decimals: number
): Promise<string> {
  const connection = getConnection();

  const senderAta = getAssociatedTokenAddressSync(mint, payer, false, TOKEN_2022_PROGRAM_ID);
  const recipientAta = getAssociatedTokenAddressSync(mint, to, false, TOKEN_2022_PROGRAM_ID);

  const instructions: TransactionInstruction[] = [];

  // Check if recipient ATA exists
  const recipientInfo = await connection.getAccountInfo(recipientAta);
  if (!recipientInfo) {
    throw new TokenServiceError(
      `Recipient ${to.toBase58().slice(0, 8)}... does not have a token account. They must be onboarded first.`,
      "ACCOUNT_NOT_FOUND"
    );
  }

  // Check if recipient is frozen
  if (recipientInfo.data.length >= 165) {
    const decoded = AccountLayout.decode(recipientInfo.data.slice(0, 165));
    if (decoded.state === 2) {
      throw new TokenServiceError(
        `Recipient account is frozen. The issuer must approve (thaw) this account first.`,
        "ACCOUNT_FROZEN"
      );
    }
  }

  // Use transferChecked — required for Token-2022 (validates decimals + handles transfer fees)
  instructions.push(
    createTransferCheckedInstruction(
      senderAta,
      mint,
      recipientAta,
      payer,
      amount,
      decimals,
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );

  const transaction = new Transaction().add(...instructions);
  try {
    return await signAndSend(transaction, []);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("User rejected") || message.includes("rejected")) {
      throw new TokenServiceError("Transaction was rejected in your wallet.", "WALLET_REJECTED", err);
    }
    if (message.includes("frozen") || message.includes("0x11")) {
      throw new TokenServiceError("Your account is frozen for this token. Contact the issuer.", "ACCOUNT_FROZEN", err);
    }
    throw new TokenServiceError(`Transfer failed: ${message}`, "RPC_ERROR", err);
  }
}
