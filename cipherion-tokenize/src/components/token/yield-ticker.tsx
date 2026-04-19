"use client";

import { useEffect, useMemo, useState } from "react";
import type { TokenMetadataField } from "@/types/token";

interface YieldTickerProps {
  supply: bigint;
  decimals: number;
  symbol: string;
  metadata: TokenMetadataField[];
}

const YIELD_KEYS = ["coupon_rate", "annual_yield", "yield", "apy"];

function parseRate(metadata: TokenMetadataField[]): number | null {
  for (const key of YIELD_KEYS) {
    const field = metadata.find(
      (f) => f.key.toLowerCase() === key
    );
    if (!field) continue;
    const raw = field.value.replace(/[%\s]/g, "");
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function secondsSinceMidnightUtc(): number {
  const now = new Date();
  const midnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  return (now.getTime() - midnight) / 1000;
}

function formatTokenAccrual(amount: number, decimals: number): string {
  if (amount === 0) return "0";
  // Pick a display precision that always shows movement on a per-second tick.
  // For low APYs and small supplies, per-second accrual can be very small,
  // so show enough trailing digits to see the counter advance.
  const significant = Math.max(decimals, 6);
  if (amount < 0.01) return amount.toFixed(significant);
  if (amount < 1) return amount.toFixed(Math.min(significant, 4));
  if (amount < 1_000) return amount.toFixed(3);
  if (amount < 1_000_000) return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return amount.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function YieldTicker({
  supply,
  decimals,
  symbol,
  metadata,
}: YieldTickerProps) {
  const couponRate = useMemo(() => parseRate(metadata), [metadata]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (couponRate === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [couponRate]);

  if (couponRate === null) return null;

  // Compute accrual amounts in token units (not raw lamport-like).
  // perSecondPerToken = couponRate% / (365 * 86400)
  const perSecondPerToken = couponRate / 100 / (365 * 86400);
  const supplyAsTokens = Number(supply) / Math.pow(10, decimals);

  const accrualThisSecond = supplyAsTokens * perSecondPerToken;
  const accrualToday = accrualThisSecond * secondsSinceMidnightUtc();

  // Use `now` to force re-render — the value isn't a function of `now` directly,
  // but secondsSinceMidnightUtc reads the wall clock each render.
  void now;

  return (
    <div className="rounded-lg border border-[#238636]/30 bg-[rgba(35,134,54,0.05)] p-3 md:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3fb950] opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-[#3fb950]" />
          </span>
          <span className="font-mono text-[10px] md:text-[11px] uppercase tracking-[0.14em] text-[#3fb950] font-medium">
            Live yield · {couponRate.toFixed(2)}% APY
          </span>
        </div>
        <div className="flex flex-col sm:items-end gap-0.5">
          <div className="font-mono text-[15px] md:text-[16px] font-semibold text-[#f0f6fc]">
            <span className="text-[#3fb950]">+</span>{" "}
            {formatTokenAccrual(accrualToday, decimals)}{" "}
            <span className="text-[#8b949e] font-normal">{symbol}</span>
          </div>
          <div className="font-mono text-[10px] md:text-[11px] text-[#8b949e]">
            accrued today · resets at 00:00 UTC
          </div>
        </div>
      </div>
    </div>
  );
}
