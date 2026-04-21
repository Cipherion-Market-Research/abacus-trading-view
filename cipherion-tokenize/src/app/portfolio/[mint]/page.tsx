"use client";

import { use, useState, useMemo, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  ArrowLeft,
  ArrowDownToLine,
  Loader2,
  Send,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { AddressDisplay } from "@/components/shared/address-display";
import { TokenAvatar } from "@/components/shared/token-avatar";
import { PageHeader } from "@/components/shared/page-header";
import { YieldTicker } from "@/components/token/yield-ticker";
import { NavDisplay } from "@/components/token/nav-display";
import { TransferForm } from "@/components/transfer/transfer-form";
import { TransactionList } from "@/components/history/transaction-list";
import { RedemptionDialog } from "@/components/portfolio/redemption-dialog";
import { MyDistributions } from "@/components/portfolio/my-distributions";
import { RequireKyc } from "@/components/auth/require-kyc";
import { useTokenInfo } from "@/hooks/use-token-info";
import { usePortfolio, type PortfolioToken } from "@/hooks/use-portfolio";
import { useHistory } from "@/hooks/use-history";
import { formatTokenAmount } from "@/lib/utils/format";

function HolderDetailContent({ mintAddress }: { mintAddress: string }) {
  const { publicKey } = useWallet();
  const {
    data: token,
    isLoading: tokenLoading,
    error: tokenError,
    refetch: refetchToken,
  } = useTokenInfo(mintAddress);
  const {
    data: portfolioTokens,
    isLoading: portfolioLoading,
    refetch: refetchPortfolio,
  } = usePortfolio();
  const [showRedeem, setShowRedeem] = useState(false);
  const walletStr = publicKey?.toBase58() ?? null;
  const {
    data: transactions,
    isLoading: historyLoading,
    hasMore,
    loadMore,
    refetch: refetchHistory,
    loaded: historyLoaded,
  } = useHistory(mintAddress, walletStr);

  useEffect(() => {
    if (walletStr && !historyLoaded) refetchHistory();
  }, [walletStr, historyLoaded, refetchHistory]);

  const refetchAll = () => {
    refetchToken();
    refetchPortfolio();
  };

  const holding: PortfolioToken | undefined = useMemo(
    () => portfolioTokens.find((t) => t.mint.toBase58() === mintAddress),
    [portfolioTokens, mintAddress]
  );

  const isLoading = tokenLoading || portfolioLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 text-[#8b949e] animate-spin" />
        <span className="ml-2 text-sm text-[#8b949e]">Loading position...</span>
      </div>
    );
  }

  if (tokenError || !token) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <ErrorState
          message="Failed to load token"
          description={tokenError?.message ?? "Token not found."}
          onRetry={refetchToken}
        />
      </div>
    );
  }

  if (!holding) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <ErrorState
          message="Not holding this token"
          description="Your wallet does not have a position in this token."
        />
      </div>
    );
  }

  const supplyPct =
    token.supply > 0n
      ? ((Number(holding.balance) / Number(token.supply)) * 100).toFixed(4)
      : "0";

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-8 space-y-6">
      {/* Back nav */}
      <Link
        href="/portfolio"
        className="inline-flex items-center gap-1.5 text-xs text-[#8b949e] hover:text-[#f0f6fc] transition-colors"
      >
        <ArrowLeft className="size-3" />
        Back to portfolio
      </Link>

      <PageHeader
        eyebrow="my position"
        title={
          <span className="inline-flex items-center gap-3">
            <TokenAvatar
              imageUri={holding.imageUri}
              assetType={holding.assetType}
              size={32}
            />
            {token.name || "Unnamed Token"}
            <span className="rounded-full border border-[#30363d] bg-[#21262d] px-2.5 py-0.5 font-mono text-[11px] font-medium text-[#8b949e] align-middle">
              {token.symbol}
            </span>
          </span>
        }
        subtitle={
          <AddressDisplay
            address={token.mint.toBase58()}
            showExplorer
            className="text-[#8b949e]"
          />
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={refetchAll}
            className="gap-1.5 border-[#30363d] bg-[#161b22] text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#21262d]"
          >
            <RefreshCw className="size-3" />
            Refresh
          </Button>
        }
      />

      {/* Position summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[#21262d] rounded-xl overflow-hidden border border-[#21262d]">
        <div className="bg-[#0d1117] p-5">
          <p className="text-[10px] uppercase tracking-wider text-[#6e7681] mb-1.5">
            Balance
          </p>
          <p className="font-mono text-[22px] font-semibold text-[#f0f6fc] tracking-tight">
            {formatTokenAmount(holding.balance, token.decimals)}
          </p>
          <p className="text-[11px] text-[#8b949e] mt-0.5">
            {token.symbol}
          </p>
        </div>
        <div className="bg-[#0d1117] p-5">
          <p className="text-[10px] uppercase tracking-wider text-[#6e7681] mb-1.5">
            % of Supply
          </p>
          <p className="font-mono text-[22px] font-semibold text-[#f0f6fc] tracking-tight">
            {supplyPct}%
          </p>
          <p className="text-[11px] text-[#8b949e] mt-0.5">
            of {formatTokenAmount(token.supply, token.decimals)} total
          </p>
        </div>
        <div className="bg-[#0d1117] p-5">
          <p className="text-[10px] uppercase tracking-wider text-[#6e7681] mb-1.5">
            Status
          </p>
          <p className="text-[22px] font-semibold tracking-tight">
            <span
              className={
                holding.isFrozen ? "text-[#d29922]" : "text-[#3fb950]"
              }
            >
              {holding.isFrozen ? "Frozen" : "Active"}
            </span>
          </p>
          <p className="text-[11px] text-[#8b949e] mt-0.5">
            {holding.isFrozen
              ? "Transfers are suspended"
              : "Transfers enabled"}
          </p>
        </div>
      </div>

      {/* Yield — computed on holder's balance, not total supply */}
      <YieldTicker
        supply={token.supply}
        decimals={token.decimals}
        symbol={token.symbol}
        metadata={token.metadata}
        mintAddress={mintAddress}
        balanceOverride={holding.balance}
      />

      {/* NAV */}
      <NavDisplay
        metadata={token.metadata}
        symbol={token.symbol}
        supply={token.supply}
        decimals={token.decimals}
      />

      {/* Two-column: distributions + actions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: my distributions */}
        <div className="lg:col-span-3 space-y-3">
          <p className="text-[11px] uppercase tracking-wider text-[#8b949e]">
            My Distributions
          </p>
          {publicKey && (
            <MyDistributions
              mintAddress={mintAddress}
              walletAddress={publicKey.toBase58()}
              decimals={token.decimals}
              symbol={token.symbol}
            />
          )}
        </div>

        {/* Right: transfer + redeem */}
        <div className="lg:col-span-2 space-y-3">
          <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4 sticky top-20">
            <div className="flex items-center gap-2 mb-4">
              <Send className="size-4 text-[#58a6ff]" />
              <h3 className="text-sm font-semibold text-[#f0f6fc]">
                Transfer {token.symbol}
              </h3>
            </div>
            <TransferForm token={holding} onSuccess={refetchAll} />

            <div className="mt-4 pt-4 border-t border-[#30363d]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRedeem(true)}
                className="w-full gap-2 border-[#30363d] bg-[#0d1117] text-[#c9d1d9] hover:text-[#f0f6fc] hover:bg-[#21262d]"
              >
                <ArrowDownToLine className="size-3.5" />
                Redeem at NAV
              </Button>
            </div>
          </div>

          {/* Token info summary */}
          <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
            <p className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-3">
              Token Info
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#8b949e]">Issuer</span>
                {token.mintAuthority ? (
                  <AddressDisplay
                    address={token.mintAuthority.toBase58()}
                    showExplorer
                    className="text-[#f0f6fc]"
                  />
                ) : (
                  <span className="text-[#484f58]">Fixed supply</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-[#8b949e]">Total supply</span>
                <span className="font-mono text-[#f0f6fc]">
                  {formatTokenAmount(token.supply, token.decimals)}{" "}
                  {token.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8b949e]">Decimals</span>
                <span className="font-mono text-[#f0f6fc]">
                  {token.decimals}
                </span>
              </div>
              {token.metadata
                .filter(
                  (f) =>
                    !["image", "description"].includes(f.key.toLowerCase())
                )
                .map((f, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-[#8b949e] font-mono text-[10px]">
                      {f.key}
                    </span>
                    <span className="text-[#f0f6fc] text-right max-w-[60%]">
                      {f.value}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* My activity */}
      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-wider text-[#8b949e]">
          My Activity
        </p>
        <TransactionList
          transactions={transactions}
          decimals={token.decimals}
          symbol={token.symbol}
          isLoading={historyLoading}
          hasMore={hasMore}
          onLoadMore={loadMore}
        />
      </div>

      {/* Redemption dialog */}
      {showRedeem && (
        <RedemptionDialog
          token={holding}
          open={showRedeem}
          onOpenChange={(open) => {
            if (!open) setShowRedeem(false);
          }}
          onSuccess={refetchAll}
        />
      )}
    </div>
  );
}

export default function HolderDetailPage({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { mint } = use(params);
  return (
    <RequireKyc>
      <HolderDetailContent mintAddress={mint} />
    </RequireKyc>
  );
}
