"use client";

import Link from "next/link";
import { ArrowRight, Coins } from "lucide-react";
import { formatTokenAmount } from "@/lib/utils/format";
import type { TokenInfo } from "@/types/token";

interface TokenCardProps {
  token: TokenInfo;
}

export function TokenCard({ token }: TokenCardProps) {
  return (
    <Link href={`/tokens/${token.mint.toBase58()}`} className="group block">
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4 transition-colors hover:border-[#484f58] hover:bg-[#1c2129]">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#21262d]">
              <Coins className="size-4 text-[#8b949e]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#f0f6fc]">
                {token.name || "Unnamed Token"}
              </p>
              <p className="font-mono text-xs text-[#8b949e]">
                {token.symbol || "—"}
              </p>
            </div>
          </div>
          <ArrowRight className="size-4 text-[#8b949e] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <div className="mt-3 flex items-center gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#8b949e]">
              Supply
            </p>
            <p className="font-mono text-xs text-[#f0f6fc]">
              {formatTokenAmount(token.supply, token.decimals)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#8b949e]">
              Decimals
            </p>
            <p className="font-mono text-xs text-[#f0f6fc]">
              {token.decimals}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
