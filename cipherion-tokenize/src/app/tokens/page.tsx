"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Plus, Wallet, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TokenCard } from "@/components/token/token-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { useTokenList } from "@/hooks/use-token-list";
import { RequireKyc } from "@/components/auth/require-kyc";
import { PageHeader } from "@/components/shared/page-header";

function TokensContent() {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { data: tokens, isLoading, error, refetch } = useTokenList();

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-8">
      <PageHeader
        eyebrow="your tokens"
        title="My Tokens"
        subtitle="Tokens you have created or manage."
        actions={
          connected ? (
            <Link href="/create">
              <Button
                size="sm"
                className="gap-1.5 bg-[#238636] text-white hover:bg-[#2ea043]"
              >
                <Plus className="size-3.5" />
                Create Token
              </Button>
            </Link>
          ) : undefined
        }
      />

      {!connected ? (
        <EmptyState
          icon={<Wallet className="size-8" />}
          message="Connect your wallet to view your tokens"
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
            Loading tokens from on-chain...
          </span>
        </div>
      ) : error ? (
        <ErrorState
          message="Failed to load tokens"
          description={error.message}
          onRetry={refetch}
        />
      ) : tokens.length === 0 ? (
        <EmptyState
          icon={<Plus className="size-8" />}
          message="No tokens created yet"
          description="Create your first RWA token to get started."
          action={
            <Link href="/create">
              <Button className="gap-1.5 bg-[#238636] text-white hover:bg-[#2ea043]">
                <Plus className="size-3.5" />
                Create Token
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tokens.map((token) => (
            <TokenCard key={token.mint.toBase58()} token={token} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TokensPage() {
  return (
    <RequireKyc>
      <TokensContent />
    </RequireKyc>
  );
}
