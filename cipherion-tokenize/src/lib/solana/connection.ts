import { Connection } from "@solana/web3.js";
import { getRpcEndpoint, SOLANA_NETWORK } from "./constants";
import { TokenServiceError } from "./types";

let connectionInstance: Connection | null = null;

export function getConnection(): Connection {
  if (!connectionInstance) {
    const endpoint = getRpcEndpoint();
    connectionInstance = new Connection(endpoint, "confirmed");
  }
  return connectionInstance;
}

export function getNetworkName(): string {
  return SOLANA_NETWORK === "mainnet-beta" ? "Mainnet" : "Devnet";
}

export function isDevnet(): boolean {
  return SOLANA_NETWORK === "devnet";
}

export async function checkConnectionHealth(): Promise<boolean> {
  try {
    const connection = getConnection();
    const version = await connection.getVersion();
    return !!version;
  } catch (err) {
    throw new TokenServiceError(
      `Failed to connect to Solana ${getNetworkName()}: ${err instanceof Error ? err.message : "Unknown error"}`,
      "NETWORK_ERROR",
      err
    );
  }
}
