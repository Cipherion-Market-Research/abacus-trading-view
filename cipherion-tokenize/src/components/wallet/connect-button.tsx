"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Wallet, LogOut, Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { truncateAddress } from "@/lib/utils/format";
import { useSolBalance } from "@/hooks/use-sol-balance";

export function ConnectButton() {
  const { publicKey, disconnect, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { balance } = useSolBalance();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [publicKey]);

  if (!connected || !publicKey) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setVisible(true)}
        className="gap-2 border-[#30363d] bg-[#161b22] text-[#f0f6fc] hover:bg-[#21262d] hover:text-[#f0f6fc]"
      >
        <Wallet className="size-4" />
        Connect Wallet
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-md border border-[#30363d] bg-[#161b22] px-3 py-1.5">
        <span className="font-mono text-xs text-[#8b949e]">
          {balance !== null ? `${balance.toFixed(3)} SOL` : "..."}
        </span>
        <div className="h-3 w-px bg-[#30363d]" />
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-[#f0f6fc] hover:text-[#58a6ff] transition-colors"
        >
          <span className="font-mono">
            {truncateAddress(publicKey.toBase58())}
          </span>
          {copied ? (
            <Check className="size-3 text-[#3fb950]" />
          ) : (
            <Copy className="size-3 text-[#8b949e]" />
          )}
        </button>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => disconnect()}
        className="text-[#8b949e] hover:text-[#f85149] hover:bg-[rgba(248,81,73,0.15)]"
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}
