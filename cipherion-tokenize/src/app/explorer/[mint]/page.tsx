"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { AddressDisplay } from "@/components/shared/address-display";
import { ExplorerLink } from "@/components/shared/explorer-link";
import { ErrorState } from "@/components/shared/error-state";
import { useTokenInfo } from "@/hooks/use-token-info";
import { formatTokenAmount } from "@/lib/utils/format";
import { YieldTicker } from "@/components/token/yield-ticker";

export default function ExplorerDetailPage({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { mint } = use(params);
  const { data: token, isLoading, error, refetch } = useTokenInfo(mint);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href="/explorer"
        className="inline-flex items-center gap-1.5 text-xs text-[#8b949e] hover:text-[#f0f6fc] mb-4"
      >
        <ArrowLeft className="size-3.5" />
        Back to catalog
      </Link>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 text-[#8b949e] animate-spin" />
          <span className="ml-2 text-sm text-[#8b949e]">Loading token data...</span>
        </div>
      )}

      {error && (
        <ErrorState
          message="Token not found"
          description={`No Token-2022 token found at address ${mint.slice(0, 8)}... — verify the mint address is correct.`}
          onRetry={refetch}
        />
      )}

      {token && !isLoading && (
        <div className="space-y-4">
          <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#f0f6fc]">
                  {token.name || "Unnamed Token"}
                </h2>
                <span className="font-mono text-sm text-[#8b949e]">
                  {token.symbol}
                </span>
              </div>
              <ExplorerLink
                type="address"
                value={token.mint.toBase58()}
                label="Solana Explorer"
              />
            </div>
            <div className="mt-3">
              <AddressDisplay
                address={token.mint.toBase58()}
                truncate={false}
                showExplorer={false}
                className="text-[#8b949e]"
              />
            </div>
          </div>

          <YieldTicker
            supply={token.supply}
            decimals={token.decimals}
            symbol={token.symbol}
            metadata={token.metadata}
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#8b949e] mb-0.5">
                Total Supply
              </p>
              <p className="font-mono text-sm font-semibold text-[#f0f6fc]">
                {formatTokenAmount(token.supply, token.decimals)}
              </p>
            </div>
            <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#8b949e] mb-0.5">
                Decimals
              </p>
              <p className="font-mono text-sm font-semibold text-[#f0f6fc]">
                {token.decimals}
              </p>
            </div>
            <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#8b949e] mb-0.5">
                Freeze Authority
              </p>
              <p className="font-mono text-xs text-[#f0f6fc]">
                {token.freezeAuthority ? "Enabled" : "Disabled"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
            <p className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-3">
              Authorities
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#8b949e]">Mint Authority</span>
                {token.mintAuthority ? (
                  <AddressDisplay
                    address={token.mintAuthority.toBase58()}
                    showExplorer
                    className="text-[#f0f6fc]"
                  />
                ) : (
                  <span className="text-xs text-[#484f58]">Disabled</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#8b949e]">Freeze Authority</span>
                {token.freezeAuthority ? (
                  <AddressDisplay
                    address={token.freezeAuthority.toBase58()}
                    showExplorer
                    className="text-[#f0f6fc]"
                  />
                ) : (
                  <span className="text-xs text-[#484f58]">Disabled</span>
                )}
              </div>
            </div>
          </div>

          {(token.metadata.length > 0 || token.uri) && (
            <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
              <p className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-3">
                On-Chain Metadata
              </p>
              {token.uri && (
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs text-[#8b949e]">URI</span>
                  <a
                    href={token.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#58a6ff] hover:underline max-w-[60%] truncate"
                  >
                    {token.uri}
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                </div>
              )}
              {token.metadata.map((field, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between py-0.5"
                >
                  <span className="text-xs text-[#8b949e] font-mono">
                    {field.key}
                  </span>
                  <span className="text-xs text-[#f0f6fc] text-right max-w-[60%]">
                    {field.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
