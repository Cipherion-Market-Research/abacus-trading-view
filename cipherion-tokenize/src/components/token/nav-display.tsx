"use client";

import { useMemo } from "react";
import { ShieldCheck } from "lucide-react";
import { NavUpdateForm } from "@/components/token/nav-update-form";
import type { TokenMetadataField } from "@/types/token";

interface NavDisplayProps {
  metadata: TokenMetadataField[];
  symbol: string;
  supply: bigint;
  decimals: number;
  mintAddress?: string;
  isIssuer?: boolean;
  onNavUpdated?: () => void;
}

const NAV_KEYS = ["nav_per_token", "nav", "net_asset_value", "nav_per_share"];

function parseNav(metadata: TokenMetadataField[]): {
  value: number;
  key: string;
} | null {
  for (const key of NAV_KEYS) {
    const field = metadata.find((f) => f.key.toLowerCase() === key);
    if (!field) continue;
    const raw = field.value.replace(/[$,\s]/g, "");
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed > 0) return { value: parsed, key: field.key };
  }
  return null;
}

function parseNavDate(metadata: TokenMetadataField[]): string | null {
  const dateKeys = ["nav_date", "nav_updated", "last_nav_update", "valuation_date"];
  for (const key of dateKeys) {
    const field = metadata.find((f) => f.key.toLowerCase() === key);
    if (field?.value) return field.value;
  }
  return null;
}

export function NavDisplay({ metadata, symbol, supply, decimals, mintAddress, isIssuer, onNavUpdated }: NavDisplayProps) {
  const nav = useMemo(() => parseNav(metadata), [metadata]);
  const navDate = useMemo(() => parseNavDate(metadata), [metadata]);

  if (!nav) return null;

  const supplyAsTokens = Number(supply) / Math.pow(10, decimals);
  const totalNav = nav.value * supplyAsTokens;

  return (
    <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-3 md:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Left: NAV per token */}
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-md bg-[rgba(88,166,255,0.1)] text-[#58a6ff] flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="size-4" />
          </div>
          <div>
            <div className="font-mono text-[10px] md:text-[11px] uppercase tracking-[0.12em] text-[#8b949e] mb-1">
              NAV per token
            </div>
            <div className="font-mono text-[20px] md:text-[24px] font-semibold text-[#f0f6fc] tracking-[-0.02em]">
              ${nav.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-[13px] font-normal text-[#8b949e] ml-1.5">{symbol}</span>
            </div>
          </div>
        </div>

        {/* Right: Total AUM + attestation */}
        <div className="flex flex-col sm:items-end gap-1">
          <div className="font-mono text-[13px] text-[#c9d1d9]">
            Total AUM:{" "}
            <span className="font-semibold text-[#f0f6fc]">
              ${totalNav >= 1_000_000
                ? (totalNav / 1_000_000).toFixed(2) + "M"
                : totalNav >= 1_000
                  ? (totalNav / 1_000).toFixed(1) + "K"
                  : totalNav.toLocaleString(undefined, { maximumFractionDigits: 0 })
              }
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[#58a6ff]" />
              <span className="font-mono text-[10px] text-[#8b949e]">
                {navDate ? `Updated ${navDate}` : "Issuer-attested"}
              </span>
            </div>
            {isIssuer && mintAddress && onNavUpdated && (
              <NavUpdateForm
                mintAddress={mintAddress}
                currentNav={nav.value}
                navKey={nav.key}
                onSuccess={onNavUpdated}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
