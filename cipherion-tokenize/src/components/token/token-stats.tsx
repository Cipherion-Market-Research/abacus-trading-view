"use client";

import { formatTokenAmount } from "@/lib/utils/format";
import type { TokenInfo, HolderInfo } from "@/types/token";

interface TokenStatsProps {
  token: TokenInfo;
  holders: HolderInfo[];
}

function Stat({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3">
      <p className="text-[10px] uppercase tracking-wider text-[#8b949e] mb-0.5">
        {label}
      </p>
      <p
        className={`text-sm font-semibold text-[#f0f6fc] ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

export function TokenStats({ token, holders }: TokenStatsProps) {
  const activeHolders = holders.filter((h) => !h.isFrozen).length;
  const frozenHolders = holders.filter((h) => h.isFrozen).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat
        label="Total Supply"
        value={formatTokenAmount(token.supply, token.decimals)}
      />
      <Stat label="Holders" value={String(holders.length)} />
      <Stat label="KYC Approved" value={String(activeHolders)} />
      <Stat
        label="Frozen"
        value={String(frozenHolders)}
      />
    </div>
  );
}
