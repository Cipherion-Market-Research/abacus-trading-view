"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Droplets, ExternalLink, Menu, X } from "lucide-react";
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const showFaucet = isDevnet() && !!publicKey;
  const faucetHref = publicKey
    ? `https://faucet.solana.com/?walletAddress=${publicKey.toBase58()}`
    : "https://faucet.solana.com/";

  return (
    <header className="flex items-center justify-between border-b border-[#30363d] bg-[#0a0e13] px-4 py-2.5">
      <div className="flex items-center gap-4 md:gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <AtlasLogo size={24} />
          <span className="text-sm font-semibold text-[#f0f6fc] hidden sm:inline tracking-tight">
            Atlas
            <span className="font-mono text-[9px] font-medium tracking-[0.12em] text-[#8b949e] uppercase pl-1.5 ml-1.5 border-l border-[#30363d]">
              by CipheX
            </span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
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
      <div className="flex items-center gap-2 md:gap-3">
        <div className="hidden md:flex items-center gap-2 md:gap-3">
          <KycPill />
          <NetworkBadge />
        </div>
        {showFaucet && (
          <a
            href={faucetHref}
            target="_blank"
            rel="noopener noreferrer"
            title="Opens the official Solana devnet faucet (faucet.solana.com) in a new tab, prefilled with your wallet address."
            className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-[#30363d] bg-[#161b22] px-2 md:px-2.5 py-1.5 text-xs font-medium text-[#8b949e] hover:text-[#58a6ff] hover:border-[#58a6ff]/40 transition-colors"
          >
            <Droplets className="size-3.5" />
            <span className="hidden lg:inline">Get devnet SOL</span>
            <ExternalLink className="size-3 opacity-60 hidden lg:inline" />
          </a>
        )}
        <ConnectButton />
        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="md:hidden inline-flex items-center justify-center size-9 rounded-md border border-[#30363d] bg-[#161b22] text-[#c9d1d9] hover:text-[#f0f6fc] transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="size-4" />
        </button>
      </div>

      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 md:hidden" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-[#0a0e13] border-l border-[#21262d] shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right md:hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#21262d]">
              <Dialog.Title asChild>
                <Link
                  href="/"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center gap-2"
                >
                  <AtlasLogo size={22} />
                  <span className="text-sm font-semibold text-[#f0f6fc] tracking-tight">
                    Atlas
                  </span>
                </Link>
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center size-10 rounded-md text-[#8b949e] hover:text-[#f0f6fc] transition-colors"
                  aria-label="Close menu"
                >
                  <X className="size-5" />
                </button>
              </Dialog.Close>
            </div>
            <div className="flex flex-col py-3 px-3">
              {NAV_ITEMS.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "px-3 py-3.5 rounded-md text-[15px] font-medium transition-colors",
                      active
                        ? "text-[#f0f6fc] bg-[#161b22]"
                        : "text-[#c9d1d9] hover:text-[#f0f6fc] hover:bg-[#161b22]"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* System status */}
            <div className="mt-auto border-t border-[#21262d] p-4 space-y-3">
              <div className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#6e7681]">
                System status
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <KycPill />
                <NetworkBadge />
              </div>
            </div>
            {showFaucet && (
              <div className="p-4 border-t border-[#21262d]">
                <a
                  href={faucetHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileOpen(false)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-[#30363d] bg-[#161b22] px-3 py-3 text-[13px] font-medium text-[#c9d1d9] hover:text-[#58a6ff] transition-colors"
                >
                  <Droplets className="size-4" />
                  Get devnet SOL
                  <ExternalLink className="size-3 opacity-60" />
                </a>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  );
}
