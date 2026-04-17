"use client";

import { SOLANA_NETWORK } from "@/lib/solana/constants";
import { getExplorerUrl } from "@/lib/solana/constants";

export function useNetwork() {
  const network = SOLANA_NETWORK;
  const isDevnet = network === "devnet";
  const isMainnet = network === "mainnet-beta";
  const networkLabel = isMainnet ? "Mainnet" : "Devnet";

  return {
    network,
    isDevnet,
    isMainnet,
    networkLabel,
    explorerAddressUrl: (address: string) =>
      getExplorerUrl("address", address),
    explorerTxUrl: (signature: string) => getExplorerUrl("tx", signature),
  };
}
