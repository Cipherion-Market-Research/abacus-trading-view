"use client";

import { useState } from "react";
import { Plus, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DistributionForm } from "@/components/distribution/distribution-form";
import { PendingSyncBanner } from "@/components/distribution/pending-sync-banner";
import { useDistributions } from "@/hooks/use-distributions";
import type { DistributionRecord } from "@/lib/distributions";
import { formatTokenAmount } from "@/lib/utils/format";
import type { TokenInfo, HolderInfo } from "@/types/token";

interface DistributionHistoryProps {
  token: TokenInfo;
  holders: HolderInfo[];
  onAfterRun: () => void;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusPill({ status }: { status: DistributionRecord["status"] }) {
  if (status === "complete") {
    return (
      <span className="inline-flex items-center rounded-full bg-[rgba(63,185,80,0.15)] px-2 py-0.5 text-[10px] font-medium text-[#3fb950]">
        Complete
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="inline-flex items-center rounded-full bg-[rgba(210,153,34,0.15)] px-2 py-0.5 text-[10px] font-medium text-[#d29922]">
        Partial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-[rgba(248,81,73,0.15)] px-2 py-0.5 text-[10px] font-medium text-[#f85149]">
      Failed
    </span>
  );
}

export function DistributionHistory({
  token,
  holders,
  onAfterRun,
}: DistributionHistoryProps) {
  const mintStr = token.mint.toBase58();
  const { records, pendingSyncCount, refresh } = useDistributions(mintStr);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleClose = () => {
    setShowForm(false);
    refresh();
    onAfterRun();
  };

  if (showForm) {
    return (
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
        <DistributionForm
          token={token}
          holders={holders}
          onClose={() => setShowForm(false)}
          onComplete={handleClose}
        />
      </div>
    );
  }

  if (holders.length === 0) {
    return (
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-8 text-center">
        <Sparkles className="size-7 text-[#8b949e] mx-auto mb-3" />
        <p className="text-[14px] text-[#f0f6fc] font-semibold mb-1">
          No holders yet
        </p>
        <p className="text-[12px] text-[#8b949e]">
          Distributions need at least one approved holder. Onboard investors
          from the Holders tab to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PendingSyncBanner
        mintAddress={mintStr}
        count={pendingSyncCount}
        onSynced={refresh}
      />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[#8b949e]">
            Distribution history
          </p>
          <p className="text-[12px] text-[#6e7681]">
            {records.length === 0
              ? "No distributions yet"
              : `${records.length} ${records.length === 1 ? "distribution" : "distributions"}`}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowForm(true)}
          className="gap-1.5 bg-[#238636] text-white hover:bg-[#2ea043]"
        >
          <Plus className="size-3.5" />
          New Distribution
        </Button>
      </div>

      {records.length === 0 ? (
        <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-8 text-center">
          <Sparkles className="size-7 text-[#a371f7] mx-auto mb-3" />
          <p className="text-[14px] text-[#f0f6fc] font-semibold mb-1">
            Run your first distribution
          </p>
          <p className="text-[12px] text-[#8b949e] max-w-[400px] mx-auto leading-relaxed">
            Atlas computes pro-rata allocation across all approved holders and
            executes the batch on-chain — same mechanic BUIDL and BENJI use for
            monthly coupon payouts.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-[#30363d] overflow-hidden divide-y divide-[#30363d]">
          {records.map((r) => {
            const expanded = expandedId === r.id;
            const completedCount = r.recipients.filter(
              (x) => x.status === "done"
            ).length;
            return (
              <div key={r.id} className="bg-[#0d1117]">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : r.id)}
                  className="w-full text-left px-4 py-3 hover:bg-[#161b22] transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {expanded ? (
                        <ChevronDown className="size-4 text-[#8b949e] shrink-0" />
                      ) : (
                        <ChevronRight className="size-4 text-[#8b949e] shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-[#f0f6fc] truncate">
                          {r.memo}
                        </div>
                        <div className="font-mono text-[10px] text-[#8b949e]">
                          {formatTimestamp(r.timestamp)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="font-mono text-[13px] font-semibold text-[#f0f6fc]">
                          {formatTokenAmount(
                            BigInt(r.totalAllocated),
                            token.decimals
                          )}
                        </div>
                        <div className="font-mono text-[10px] text-[#8b949e]">
                          {completedCount} / {r.recipients.length} holders
                        </div>
                      </div>
                      <StatusPill status={r.status} />
                    </div>
                  </div>
                </button>
                {expanded && (
                  <div className="border-t border-[#30363d] divide-y divide-[#21262d]">
                    {r.recipients.map((rec, i) => (
                      <div
                        key={`${rec.ownerAddress}-${i}`}
                        className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2 items-center text-[11px]"
                      >
                        <div className="font-mono text-[#c9d1d9] truncate">
                          {rec.ownerAddress.slice(0, 8)}...
                          {rec.ownerAddress.slice(-4)}
                        </div>
                        <div className="font-mono text-[#f0f6fc] tabular-nums">
                          + {formatTokenAmount(BigInt(rec.amount), token.decimals)}
                        </div>
                        <div className="font-mono text-[10px]">
                          {rec.status === "done" && (
                            <span className="text-[#3fb950]">✓</span>
                          )}
                          {rec.status === "failed" && (
                            <span className="text-[#f85149]">failed</span>
                          )}
                          {rec.status === "skipped" && (
                            <span className="text-[#6e7681]">skipped</span>
                          )}
                          {rec.status === "pending" && (
                            <span className="text-[#d29922]">pending</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
