"use client";

import { useState, useMemo } from "react";
import { Search, ShieldCheck, ShieldX, ShieldAlert, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressDisplay } from "@/components/shared/address-display";
import { isValidPublicKey } from "@/lib/utils/validation";
import { formatTokenAmount } from "@/lib/utils/format";
import type { TokenInfo, HolderInfo } from "@/types/token";

type Severity = "blocked" | "warning" | "info" | "pass";

interface RuleResult {
  id: string;
  label: string;
  detail: string;
  severity: Severity;
}

interface ComplianceSimulatorProps {
  token: TokenInfo;
  holders: HolderInfo[];
}

function runRules(
  address: string,
  token: TokenInfo,
  holders: HolderInfo[]
): RuleResult[] {
  const results: RuleResult[] = [];
  const holder = holders.find((h) => h.owner.toBase58() === address);

  const isPaused = token.isPaused;
  if (isPaused) {
    results.push({
      id: "paused",
      label: "Token paused",
      detail: "All transfers are currently halted by the freeze authority.",
      severity: "blocked",
    });
  } else {
    results.push({
      id: "paused",
      label: "Token paused: no",
      detail: "Token is operating normally.",
      severity: "pass",
    });
  }

  // Rule: Account frozen
  if (holder?.isFrozen) {
    results.push({
      id: "frozen",
      label: "Account frozen",
      detail: `Freeze authority has suspended this wallet. Balance: ${formatTokenAmount(holder.balance, token.decimals)} ${token.symbol}`,
      severity: "blocked",
    });
  } else if (holder) {
    results.push({
      id: "frozen",
      label: "Account status: active",
      detail: `Balance: ${formatTokenAmount(holder.balance, token.decimals)} ${token.symbol}`,
      severity: "pass",
    });
  }

  // Rule: Investor onboarded (has ATA)
  if (!holder) {
    results.push({
      id: "onboarded",
      label: "Investor not onboarded",
      detail:
        "No associated token account exists for this wallet. Investor must be onboarded before receiving tokens.",
      severity: "blocked",
    });
  } else {
    results.push({
      id: "onboarded",
      label: "Investor onboarded",
      detail: "Associated token account exists on-chain.",
      severity: "pass",
    });
  }

  // Rule: Investor cap
  const maxHoldersField = token.metadata.find(
    (f) => f.key.toLowerCase() === "max_holders" || f.key.toLowerCase() === "investor_cap"
  );
  const maxHolders = maxHoldersField ? parseInt(maxHoldersField.value, 10) : null;
  if (maxHolders && !isNaN(maxHolders)) {
    const currentCount = holders.length;
    if (!holder && currentCount >= maxHolders) {
      results.push({
        id: "cap",
        label: `Investor cap reached: ${currentCount} of ${maxHolders}`,
        detail:
          "Adding a new holder would exceed the configured investor cap.",
        severity: "blocked",
      });
    } else {
      results.push({
        id: "cap",
        label: `Investor cap: ${currentCount} of ${maxHolders}`,
        detail: holder
          ? "Already a holder — does not count toward new additions."
          : "Capacity available for new investors.",
        severity: "pass",
      });
    }
  } else {
    results.push({
      id: "cap",
      label: "Investor cap: not configured",
      detail: "No max_holders or investor_cap metadata field set.",
      severity: "info",
    });
  }

  // Rule: Distribution eligibility
  if (holder && !holder.isFrozen && holder.balance > 0n) {
    results.push({
      id: "distributions",
      label: "Eligible for distributions",
      detail: "Active account with non-zero balance qualifies for pro-rata yield.",
      severity: "pass",
    });
  } else if (holder && holder.isFrozen) {
    results.push({
      id: "distributions",
      label: "Excluded from distributions",
      detail: "Frozen accounts are excluded from pro-rata yield distributions.",
      severity: "warning",
    });
  } else if (holder && holder.balance === 0n) {
    results.push({
      id: "distributions",
      label: "Excluded from distributions",
      detail: "Zero-balance accounts are excluded from pro-rata yield distributions.",
      severity: "warning",
    });
  } else {
    results.push({
      id: "distributions",
      label: "Not eligible for distributions",
      detail: "Wallet has no token account — cannot receive distributions.",
      severity: "info",
    });
  }

  return results;
}

const SEVERITY_CONFIG: Record<
  Severity,
  { icon: typeof ShieldX; color: string; bg: string; label: string }
> = {
  blocked: {
    icon: ShieldX,
    color: "text-[#f85149]",
    bg: "bg-[rgba(248,81,73,0.1)]",
    label: "BLOCKED",
  },
  warning: {
    icon: ShieldAlert,
    color: "text-[#d29922]",
    bg: "bg-[rgba(210,153,34,0.1)]",
    label: "WARNING",
  },
  info: {
    icon: Info,
    color: "text-[#8b949e]",
    bg: "bg-[rgba(139,148,158,0.1)]",
    label: "INFO",
  },
  pass: {
    icon: ShieldCheck,
    color: "text-[#3fb950]",
    bg: "bg-[rgba(63,185,80,0.1)]",
    label: "PASS",
  },
};

export function ComplianceSimulator({
  token,
  holders,
}: ComplianceSimulatorProps) {
  const [input, setInput] = useState("");
  const [checkedAddress, setCheckedAddress] = useState<string | null>(null);

  const results = useMemo(() => {
    if (!checkedAddress) return null;
    return runRules(checkedAddress, token, holders);
  }, [checkedAddress, token, holders]);

  const hasBlocked = results?.some((r) => r.severity === "blocked");
  const verdict = results
    ? hasBlocked
      ? "blocked"
      : "approved"
    : null;

  const handleCheck = () => {
    const trimmed = input.trim();
    if (isValidPublicKey(trimmed)) {
      setCheckedAddress(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCheck();
  };

  return (
    <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
      <p className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-3">
        Pre-Trade Compliance Check
      </p>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setCheckedAddress(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Paste wallet address..."
          className="border-[#30363d] bg-[#0d1117] text-[#f0f6fc] font-mono text-xs flex-1"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleCheck}
          disabled={!input.trim() || !isValidPublicKey(input.trim())}
          className="gap-1.5 border-[#30363d] bg-[#0d1117] text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#21262d] shrink-0"
        >
          <Search className="size-3" />
          Check
        </Button>
      </div>

      {input.trim() && !isValidPublicKey(input.trim()) && (
        <p className="mt-2 text-[10px] text-[#f85149]">
          Invalid Solana address
        </p>
      )}

      {results && checkedAddress && (
        <div className="mt-4 space-y-3">
          {/* Verdict banner */}
          <div
            className={`flex items-center gap-2 rounded-md px-3 py-2 ${
              verdict === "blocked"
                ? "bg-[rgba(248,81,73,0.08)] border border-[#f85149]/20"
                : "bg-[rgba(63,185,80,0.08)] border border-[#3fb950]/20"
            }`}
          >
            {verdict === "blocked" ? (
              <ShieldX className="size-4 text-[#f85149] shrink-0" />
            ) : (
              <ShieldCheck className="size-4 text-[#3fb950] shrink-0" />
            )}
            <div className="min-w-0">
              <span
                className={`text-xs font-semibold ${
                  verdict === "blocked" ? "text-[#f85149]" : "text-[#3fb950]"
                }`}
              >
                {verdict === "blocked"
                  ? "TRANSFER BLOCKED"
                  : "TRANSFER APPROVED"}
              </span>
              <span className="text-[10px] text-[#8b949e] ml-2">
                <AddressDisplay address={checkedAddress} className="inline" />
              </span>
            </div>
          </div>

          {/* Rule results */}
          <div className="space-y-1.5">
            {results.map((rule) => {
              const config = SEVERITY_CONFIG[rule.severity];
              const Icon = config.icon;
              return (
                <div
                  key={rule.id}
                  className={`flex items-start gap-2.5 rounded-md px-3 py-2 ${config.bg}`}
                >
                  <Icon className={`size-3.5 mt-0.5 shrink-0 ${config.color}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${config.color}`}>
                        {config.label}
                      </span>
                      <span className="text-xs text-[#f0f6fc]">
                        {rule.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#8b949e] mt-0.5 leading-relaxed">
                      {rule.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
