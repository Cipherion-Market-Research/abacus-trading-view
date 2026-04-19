"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Wallet, Loader2, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { AddressDisplay } from "@/components/shared/address-display";
import { TransferForm } from "@/components/transfer/transfer-form";
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

function TokenRow({
  token,
  isSelected,
  onSelect,
}: {
  token: PortfolioToken;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`w-full text-left rounded-lg border p-4 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#238636]/50 ${
        isSelected
          ? "border-[#238636] bg-[rgba(35,134,54,0.05)]"
          : "border-[#30363d] bg-[#161b22] hover:border-[#484f58]"
      }`}
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
            <AddressDisplay
              address={token.mint.toBase58()}
              showExplorer
              className="text-[#8b949e] mt-1"
            />
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-sm font-semibold text-[#f0f6fc]">
            {formatTokenAmount(token.balance, token.decimals)}
          </p>
          <p className="text-[10px] text-[#8b949e]">{token.symbol}</p>
        </div>
      </div>
    </div>
  );
}

function PortfolioContent() {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { data: tokens, isLoading, error, refetch } = usePortfolio();
  const [selectedMint, setSelectedMint] = useState<string | null>(null);

  const selectedToken = tokens.find(
    (t) => t.mint.toBase58() === selectedMint
  );

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-8">
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
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Token list */}
          <div className="lg:col-span-3 space-y-2">
            {tokens.map((token) => (
              <TokenRow
                key={token.ata.toBase58()}
                token={token}
                isSelected={selectedMint === token.mint.toBase58()}
                onSelect={() =>
                  setSelectedMint(
                    selectedMint === token.mint.toBase58()
                      ? null
                      : token.mint.toBase58()
                  )
                }
              />
            ))}
          </div>

          {/* Transfer panel */}
          <div className="lg:col-span-2">
            {selectedToken ? (
              <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4 sticky top-20">
                <div className="flex items-center gap-2 mb-4">
                  <Send className="size-4 text-[#58a6ff]" />
                  <h3 className="text-sm font-semibold text-[#f0f6fc]">
                    Transfer {selectedToken.symbol}
                  </h3>
                </div>
                <TransferForm token={selectedToken} onSuccess={refetch} />
              </div>
            ) : (
              <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-8 text-center">
                <Send className="size-6 text-[#8b949e] mx-auto mb-2" />
                <p className="text-xs text-[#8b949e]">
                  Select a token to transfer
                </p>
              </div>
            )}
          </div>
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
