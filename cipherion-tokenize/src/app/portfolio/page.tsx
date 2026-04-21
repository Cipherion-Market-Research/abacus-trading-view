"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Wallet, Loader2, RefreshCw, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { usePortfolio, type PortfolioToken } from "@/hooks/use-portfolio";
import { formatTokenAmount } from "@/lib/utils/format";
import { RequireKyc } from "@/components/auth/require-kyc";
import { PageHeader } from "@/components/shared/page-header";
import { TokenAvatar } from "@/components/shared/token-avatar";

function StatusBadge({ frozen }: { frozen: boolean }) {
  if (frozen) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-[rgba(210,153,34,0.15)] text-[#d29922]">
        Frozen
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-[rgba(63,185,80,0.15)] text-[#3fb950]">
      Active
    </span>
  );
}

function TokenRow({ token }: { token: PortfolioToken }) {
  const addr = token.mint.toBase58();
  return (
    <Link
      href={`/portfolio/${addr}`}
      className="block rounded-lg border border-[#30363d] bg-[#161b22] p-4 transition-colors hover:border-[#484f58] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#238636]/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <TokenAvatar
            imageUri={token.imageUri}
            assetType={token.assetType}
            size={40}
          />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-sm font-semibold text-[#f0f6fc] break-words">
                {token.name || "Unknown Token"}
              </p>
              <span className="font-mono text-xs text-[#8b949e]">
                {token.symbol}
              </span>
              <StatusBadge frozen={token.isFrozen} />
            </div>
            <span className="font-mono text-[10px] text-[#484f58] mt-1 block">
              {addr.slice(0, 4)}&hellip;{addr.slice(-4)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="font-mono text-sm font-semibold text-[#f0f6fc]">
              {formatTokenAmount(token.balance, token.decimals)}
            </p>
            <p className="text-[10px] text-[#8b949e]">{token.symbol}</p>
          </div>
          <ChevronRight className="size-4 text-[#8b949e]" />
        </div>
      </div>
    </Link>
  );
}

function PortfolioContent() {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { data: tokens, isLoading, error, refetch } = usePortfolio();

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader
        eyebrow="portfolio"
        title="Your holdings"
        subtitle="Your RWA token holdings and transfer controls."
        actions={
          connected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              className="gap-1.5 border-[#30363d] bg-[#161b22] text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#21262d]"
            >
              <RefreshCw className="size-3" />
              Refresh
            </Button>
          ) : undefined
        }
      />

      {!connected ? (
        <EmptyState
          icon={<Wallet className="size-8" />}
          message="Connect your wallet to view your portfolio"
          action={
            <Button
              onClick={() => setVisible(true)}
              className="gap-2 bg-[#238636] text-white hover:bg-[#2ea043]"
            >
              <Wallet className="size-4" />
              Connect Wallet
            </Button>
          }
        />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 text-[#8b949e] animate-spin" />
          <span className="ml-2 text-sm text-[#8b949e]">
            Loading portfolio...
          </span>
        </div>
      ) : error ? (
        <ErrorState
          message="Failed to load portfolio"
          description={error.message}
          onRetry={refetch}
        />
      ) : tokens.length === 0 ? (
        <EmptyState
          icon={<Wallet className="size-8" />}
          message="No RWA tokens in your wallet"
          description="Tokens will appear here once an issuer distributes them to you."
        />
      ) : (
        <div className="space-y-2">
          {tokens.map((token) => (
            <TokenRow key={token.ata.toBase58()} token={token} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  return (
    <RequireKyc>
      <PortfolioContent />
    </RequireKyc>
  );
}
