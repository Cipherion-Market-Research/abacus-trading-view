"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Droplets, Loader2 } from "lucide-react";
import { ConnectButton } from "@/components/wallet/connect-button";
import { NetworkBadge } from "@/components/shared/network-badge";
import { Button } from "@/components/ui/button";
import { useAirdrop } from "@/hooks/use-airdrop";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Create", href: "/create" },
  { label: "My Tokens", href: "/tokens" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Explorer", href: "/explorer" },
];

export function AppHeader() {
  const pathname = usePathname();
  const { requestAirdrop, isLoading: airdropLoading, available: airdropAvailable } = useAirdrop();

  return (
    <header className="flex items-center justify-between border-b border-[#30363d] bg-[#0d1117] px-4 py-2.5">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="h-7 w-7 rounded-md bg-[#238636] flex items-center justify-center">
            <span className="text-white font-bold text-xs">A</span>
          </div>
          <span className="text-sm font-semibold text-[#f0f6fc] hidden sm:inline">
            CipheX Atlas
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
        <NetworkBadge />
        {airdropAvailable && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => requestAirdrop(1)}
            disabled={airdropLoading}
            className="gap-1.5 text-[#8b949e] hover:text-[#58a6ff] hover:bg-[rgba(88,166,255,0.1)]"
          >
            {airdropLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Droplets className="size-3.5" />
            )}
            <span className="hidden sm:inline text-xs">Airdrop</span>
          </Button>
        )}
        <ConnectButton />
      </div>
    </header>
  );
}
