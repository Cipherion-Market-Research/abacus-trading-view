"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Wallet, Plus, FolderOpen, Search, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSolBalance } from "@/hooks/use-sol-balance";

export default function Home() {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { balance } = useSolBalance();

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="flex flex-col items-center gap-6 text-center max-w-lg">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-[#238636] flex items-center justify-center">
            <span className="text-white font-bold text-xl">A</span>
          </div>
          <div className="text-left">
            <h1 className="text-2xl font-semibold text-[#f0f6fc]">
              CipheX Atlas
            </h1>
            <p className="text-[11px] uppercase tracking-wider text-[#8b949e]">
              RWA Token Platform
            </p>
          </div>
        </div>

        <p className="text-sm text-[#8b949e] leading-relaxed">
          Issue, manage, and trade real-world asset tokens on Solana with
          built-in compliance controls. Powered by Token-2022 extensions.
        </p>

        {!connected ? (
          <Button
            size="lg"
            onClick={() => setVisible(true)}
            className="gap-2 bg-[#238636] text-white hover:bg-[#2ea043]"
          >
            <Wallet className="size-4" />
            Connect Wallet to Get Started
          </Button>
        ) : (
          <div className="w-full space-y-3">
            <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
              <p className="text-xs text-[#8b949e] mb-1">Wallet Balance</p>
              <p className="font-mono text-lg font-semibold text-[#f0f6fc]">
                {balance !== null ? `${balance.toFixed(4)} SOL` : "Loading..."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Link href="/create" className="group">
                <div className="flex items-center gap-3 rounded-lg border border-[#30363d] bg-[#161b22] p-3 transition-colors hover:border-[#238636] hover:bg-[rgba(35,134,54,0.05)]">
                  <Plus className="size-4 text-[#3fb950]" />
                  <div className="text-left flex-1">
                    <p className="text-xs font-medium text-[#f0f6fc]">
                      Create Token
                    </p>
                  </div>
                  <ArrowRight className="size-3 text-[#8b949e] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
              <Link href="/tokens" className="group">
                <div className="flex items-center gap-3 rounded-lg border border-[#30363d] bg-[#161b22] p-3 transition-colors hover:border-[#58a6ff] hover:bg-[rgba(88,166,255,0.05)]">
                  <FolderOpen className="size-4 text-[#58a6ff]" />
                  <div className="text-left flex-1">
                    <p className="text-xs font-medium text-[#f0f6fc]">
                      My Tokens
                    </p>
                  </div>
                  <ArrowRight className="size-3 text-[#8b949e] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
              <Link href="/explorer" className="group">
                <div className="flex items-center gap-3 rounded-lg border border-[#30363d] bg-[#161b22] p-3 transition-colors hover:border-[#a371f7] hover:bg-[rgba(163,113,247,0.05)]">
                  <Search className="size-4 text-[#a371f7]" />
                  <div className="text-left flex-1">
                    <p className="text-xs font-medium text-[#f0f6fc]">
                      Explorer
                    </p>
                  </div>
                  <ArrowRight className="size-3 text-[#8b949e] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
