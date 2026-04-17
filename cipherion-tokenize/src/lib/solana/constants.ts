import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

export { TOKEN_2022_PROGRAM_ID };

export const SOLANA_NETWORK =
  (process.env.NEXT_PUBLIC_SOLANA_NETWORK as "devnet" | "mainnet-beta") ??
  "devnet";

export const RPC_ENDPOINTS: Record<string, string> = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};

export function getRpcEndpoint(): string {
  const custom = process.env.NEXT_PUBLIC_RPC_ENDPOINT;
  if (custom && custom.length > 0) return custom;
  return RPC_ENDPOINTS[SOLANA_NETWORK] ?? RPC_ENDPOINTS.devnet;
}

export function getExplorerUrl(
  type: "address" | "tx",
  value: string
): string {
  const cluster =
    SOLANA_NETWORK === "mainnet-beta" ? "" : `?cluster=${SOLANA_NETWORK}`;
  return `https://explorer.solana.com/${type}/${value}${cluster}`;
}

export const TRANSFER_HOOK_PROGRAM_ID =
  process.env.NEXT_PUBLIC_TRANSFER_HOOK_PROGRAM_ID
    ? new PublicKey(process.env.NEXT_PUBLIC_TRANSFER_HOOK_PROGRAM_ID)
    : null;
