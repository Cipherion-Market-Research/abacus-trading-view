"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Droplets, ExternalLink } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ConnectButton } from "@/components/wallet/connect-button";
import { NetworkBadge } from "@/components/shared/network-badge";
import { KycPill } from "@/components/auth/kyc-pill";
import { AtlasLogo } from "@/components/shared/atlas-logo";
import { isDevnet } from "@/lib/solana/connection";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Create", href: "/create" },
  { label: "My Tokens", href: "/tokens" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Explorer", href: "/explorer" },
];

export function AppHeader() {
  const pathname = usePathname();
  const { publicKey } = useWallet();
  const showFaucet = isDevnet() && !!publicKey;
  const faucetHref = publicKey
    ? `https://faucet.solana.com/?walletAddress=${publicKey.toBase58()}`
    : "https://faucet.solana.com/";

  return (
    <header className="flex items-center justify-between border-b border-[#30363d] bg-[#0d1117] px-4 py-2.5">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <AtlasLogo size={24} />
          <span className="text-sm font-semibold text-[#f0f6fc] hidden sm:inline tracking-tight">
            <span className="font-mono text-[9px] font-medium tracking-[0.12em] text-[#8b949e] uppercase pr-1.5 mr-1.5 border-r border-[#30363d]">
              CPX
            </span>
            Atlas
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                pathname === item.href || pathname.startsWith(item.href + "/")
                  ? "bg-[#21262d] text-[#f0f6fc]"
                  : "text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#161b22]"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <KycPill />
        <NetworkBadge />
        {showFaucet && (
          <a
            href={faucetHref}
            target="_blank"
            rel="noopener noreferrer"
            title="Opens the official Solana devnet faucet (faucet.solana.com) in a new tab, prefilled with your wallet address."
            className="inline-flex items-center gap-1.5 rounded-md border border-[#30363d] bg-[#161b22] px-2.5 py-1.5 text-xs font-medium text-[#8b949e] hover:text-[#58a6ff] hover:border-[#58a6ff]/40 transition-colors"
          >
            <Droplets className="size-3.5" />
            <span className="hidden sm:inline">Get devnet SOL</span>
            <ExternalLink className="size-3 opacity-60" />
          </a>
        )}
        <ConnectButton />
      </div>
    </header>
  );
}
