"use client";

import { use } from "react";
import { RefreshCw, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddressDisplay } from "@/components/shared/address-display";
import { ExplorerLink } from "@/components/shared/explorer-link";
import { ErrorState } from "@/components/shared/error-state";
import { TokenStats } from "@/components/token/token-stats";
import { CapTable } from "@/components/holders/cap-table";
import { OnboardForm } from "@/components/holders/onboard-form";
import { MintForm } from "@/components/token/mint-form";
import { CompliancePanel } from "@/components/compliance/compliance-panel";
import { TransactionList } from "@/components/history/transaction-list";
import { ExportButton } from "@/components/history/export-button";
import { useTokenInfo } from "@/hooks/use-token-info";
import { useHolders } from "@/hooks/use-holders";
import { useHistory } from "@/hooks/use-history";

export default function TokenDashboardPage({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { mint } = use(params);
  const {
    data: token,
    isLoading: tokenLoading,
    error: tokenError,
    refetch: refetchToken,
  } = useTokenInfo(mint);
  const {
    data: holders,
    isLoading: holdersLoading,
    error: holdersError,
    refetch: refetchHolders,
  } = useHolders(mint);
  const {
    data: transactions,
    isLoading: historyLoading,
    hasMore,
    loadMore,
    refetch: refetchHistory,
    loaded: historyLoaded,
  } = useHistory(mint);

  const refetchAll = () => {
    refetchToken();
    refetchHolders();
  };

  if (tokenLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 text-[#8b949e] animate-spin" />
        <span className="ml-2 text-sm text-[#8b949e]">Loading token...</span>
      </div>
    );
  }

  if (tokenError || !token) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <ErrorState
          message="Failed to load token"
          description={tokenError?.message ?? "Token not found on-chain."}
          onRetry={refetchToken}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-[#f0f6fc]">
              {token.name || "Unnamed Token"}
            </h1>
            <span className="rounded-full border border-[#30363d] bg-[#21262d] px-2 py-0.5 font-mono text-xs text-[#8b949e]">
              {token.symbol}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <AddressDisplay
              address={token.mint.toBase58()}
              showExplorer
              className="text-[#8b949e]"
            />
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refetchAll}
          className="gap-1.5 border-[#30363d] bg-[#161b22] text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#21262d]"
        >
          <RefreshCw className="size-3" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <TokenStats token={token} holders={holders} />

      {/* Tabs */}
      <Tabs
        defaultValue="holders"
        className="space-y-4"
        onValueChange={(tab) => {
          if (tab === "history" && !historyLoaded) refetchHistory();
        }}
      >
        <TabsList className="bg-[#161b22] border border-[#30363d]">
          <TabsTrigger
            value="holders"
            className="text-xs data-[state=active]:bg-[#21262d] data-[state=active]:text-[#f0f6fc]"
          >
            Holders ({holders.length})
          </TabsTrigger>
          <TabsTrigger
            value="mint"
            className="text-xs data-[state=active]:bg-[#21262d] data-[state=active]:text-[#f0f6fc]"
          >
            Mint & Distribute
          </TabsTrigger>
          <TabsTrigger
            value="details"
            className="text-xs data-[state=active]:bg-[#21262d] data-[state=active]:text-[#f0f6fc]"
          >
            Token Details
          </TabsTrigger>
          <TabsTrigger
            value="compliance"
            className="text-xs data-[state=active]:bg-[#21262d] data-[state=active]:text-[#f0f6fc]"
          >
            Compliance
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="text-xs data-[state=active]:bg-[#21262d] data-[state=active]:text-[#f0f6fc]"
          >
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="holders">
          {holdersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 text-[#8b949e] animate-spin" />
              <span className="ml-2 text-sm text-[#8b949e]">Loading holders...</span>
            </div>
          ) : holdersError ? (
            <ErrorState
              message="Failed to load holders"
              description={holdersError.message}
              onRetry={refetchHolders}
            />
          ) : (
            <div className="space-y-4">
              <CapTable
                holders={holders}
                decimals={token.decimals}
                totalSupply={token.supply}
              />
              <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
                <OnboardForm mintAddress={mint} onSuccess={refetchAll} />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="mint">
          <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
            <MintForm
              mintAddress={mint}
              decimals={token.decimals}
              onSuccess={refetchAll}
            />
          </div>
        </TabsContent>

        <TabsContent value="details">
          <div className="space-y-4">
            {/* Authorities */}
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

            {/* On-Chain Metadata */}
            {token.metadata.length > 0 && (
              <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
                <p className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-3">
                  On-Chain Metadata
                </p>
                <div className="space-y-1.5">
                  {token.metadata.map((field, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between"
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
              </div>
            )}

            {/* Token URI */}
            {token.uri && (
              <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
                <p className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-2">
                  External URI
                </p>
                <a
                  href={token.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#58a6ff] hover:underline break-all"
                >
                  {token.uri}
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="compliance">
          <CompliancePanel
            token={token}
            holders={holders}
            onSuccess={refetchAll}
          />
        </TabsContent>

        <TabsContent value="history">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-[#8b949e]">
                On-Chain Activity
              </p>
              <ExportButton
                transactions={transactions}
                decimals={token.decimals}
                symbol={token.symbol}
                tokenName={token.name}
              />
            </div>
            <TransactionList
              transactions={transactions}
              decimals={token.decimals}
              symbol={token.symbol}
              isLoading={historyLoading}
              hasMore={hasMore}
              onLoadMore={loadMore}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
