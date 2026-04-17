import type { PublicKey } from "@solana/web3.js";

export class TokenServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INSUFFICIENT_SOL"
      | "WALLET_REJECTED"
      | "NETWORK_ERROR"
      | "ACCOUNT_FROZEN"
      | "TOKEN_PAUSED"
      | "UNAUTHORIZED"
      | "INVALID_INPUT"
      | "ACCOUNT_NOT_FOUND"
      | "ALREADY_EXISTS"
      | "RPC_ERROR",
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "TokenServiceError";
  }
}

export type AssetType =
  | "treasury"
  | "real_estate"
  | "commodity"
  | "equity"
  | "debt"
  | "fund"
  | "other";

export type RegulatoryFramework =
  | "reg_d"
  | "reg_s"
  | "reg_a_plus"
  | "mifid2"
  | "none";

export interface TokenExtensionConfig {
  defaultAccountState?: "frozen" | "initialized";
  transferFee?: { bps: number; maxFee: bigint };
  pausable?: boolean;
  permanentDelegate?: PublicKey;
  memoTransfer?: boolean;
  transferHook?: PublicKey;
}

export interface TokenMetadataField {
  key: string;
  value: string;
}

export interface CreateTokenParams {
  name: string;
  symbol: string;
  decimals: number;
  uri: string;
  description: string;
  assetType: AssetType;
  jurisdiction?: string;
  regulatoryFramework: RegulatoryFramework;
  extensions: TokenExtensionConfig;
  initialSupply?: bigint;
  metadata: TokenMetadataField[];
}

export interface TokenInfo {
  mint: PublicKey;
  name: string;
  symbol: string;
  decimals: number;
  supply: bigint;
  mintAuthority: PublicKey | null;
  freezeAuthority: PublicKey | null;
  extensions: TokenExtensionConfig;
  metadata: TokenMetadataField[];
  uri: string;
}

export interface HolderInfo {
  address: PublicKey;
  owner: PublicKey;
  balance: bigint;
  isFrozen: boolean;
}

export interface TransactionInfo {
  signature: string;
  blockTime: number | null;
  type: "mint" | "transfer" | "burn" | "freeze" | "thaw" | "pause" | "unpause" | "unknown";
  from?: string;
  to?: string;
  amount?: bigint;
  memo?: string;
}
