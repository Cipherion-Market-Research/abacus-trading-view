"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, AccountLayout } from "@solana/spl-token";
import { getTokenMetadata } from "@/lib/solana/metadata-service";
import { TokenServiceError } from "@/lib/solana/types";
import type { AssetType } from "@/types/token";

export interface PortfolioToken {
  mint: PublicKey;
  ata: PublicKey;
  balance: bigint;
  decimals: number;
  isFrozen: boolean;
  name: string;
  symbol: string;
  imageUri?: string;
  assetType?: AssetType;
}

export function usePortfolio() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [data, setData] = useState<PortfolioToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<TokenServiceError | null>(null);

  const refetch = useCallback(async () => {
    if (!publicKey) {
      setData([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // getTokenAccountsByOwner works on public RPC (unlike getProgramAccounts)
      const response = await connection.getTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_2022_PROGRAM_ID },
        "confirmed"
      );

      const tokens: PortfolioToken[] = [];
      for (const { pubkey, account } of response.value) {
        try {
          if (account.data.length < 165) continue;

          const decoded = AccountLayout.decode(account.data.slice(0, 165));
          const mint = new PublicKey(decoded.mint);
          const balance = decoded.amount;
          const isFrozen = decoded.state === 2;

          // Fetch metadata for display
          let name = "";
          let symbol = "";
          let decimals = 0;
          let imageUri: string | undefined;
          let assetType: AssetType | undefined;
          try {
            const metadata = await getTokenMetadata(mint);
            name = metadata.name;
            symbol = metadata.symbol;
            const imgField = metadata.additionalFields.find(
              (f) => f.key === "image"
            );
            const typeField = metadata.additionalFields.find(
              (f) => f.key === "asset_type"
            );
            imageUri = imgField?.value;
            assetType = typeField?.value as AssetType | undefined;
          } catch {
            // Token might not have metadata — that's fine
          }

          // Get decimals from mint
          try {
            const { getMint } = await import("@solana/spl-token");
            const mintInfo = await getMint(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
            decimals = mintInfo.decimals;
          } catch {
            // Default to 0 if we can't read the mint
          }

          tokens.push({
            mint,
            ata: pubkey,
            balance,
            decimals,
            isFrozen,
            name,
            symbol,
            imageUri,
            assetType,
          });
        } catch {
          continue;
        }
      }

      // Sort by balance descending
      tokens.sort((a, b) => {
        if (b.balance > a.balance) return 1;
        if (b.balance < a.balance) return -1;
        return 0;
      });

      setData(tokens);
    } catch (err) {
      const tokenErr =
        err instanceof TokenServiceError
          ? err
          : new TokenServiceError(
              err instanceof Error ? err.message : "Failed to fetch portfolio",
              "RPC_ERROR",
              err
            );
      setError(tokenErr);
      console.error("[usePortfolio]", tokenErr.message);
    } finally {
      setIsLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
}
