"use client";

import { useMemo } from "react";
import { ExplorerLink } from "@/components/shared/explorer-link";
import { loadDistributions, type DistributionRecord } from "@/lib/distributions";

interface MyDistributionsProps {
  mintAddress: string;
  walletAddress: string;
  decimals: number;
  symbol: string;
}

interface MyReceipt {
  distributionId: string;
  timestamp: number;
  memo: string;
  amount: number;
  signature?: string;
}

export function MyDistributions({
  mintAddress,
  walletAddress,
  decimals,
  symbol,
}: MyDistributionsProps) {
  const receipts = useMemo((): MyReceipt[] => {
    const records = loadDistributions(mintAddress);
    const result: MyReceipt[] = [];

    for (const record of records) {
      const myRecipients = record.recipients.filter(
        (r) => r.ownerAddress === walletAddress && r.status === "done"
      );
      for (const r of myRecipients) {
        result.push({
          distributionId: record.id,
          timestamp: record.timestamp,
          memo: record.memo,
          amount: Number(BigInt(r.amount)) / Math.pow(10, decimals),
          signature: r.signature,
        });
      }
    }

    return result;
  }, [mintAddress, walletAddress, decimals]);

  if (receipts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#30363d] bg-[#0d1117] p-6 text-center">
        <p className="text-xs text-[#8b949e]">
          No distributions received yet for this token.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {receipts.map((r, i) => (
        <div
          key={`${r.distributionId}-${i}`}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-[#30363d] bg-[#161b22] p-3"
        >
          <div className="min-w-0">
            <p className="text-xs text-[#f0f6fc] font-medium">{r.memo || "Distribution"}</p>
            <p className="text-[10px] text-[#8b949e] mt-0.5">
              {new Date(r.timestamp).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
              {" · "}
              {new Date(r.timestamp).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-mono text-sm font-semibold text-[#3fb950]">
              +{r.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
              <span className="text-[#8b949e] font-normal text-xs">{symbol}</span>
            </span>
            {r.signature && (
              <ExplorerLink type="tx" value={r.signature} className="text-[10px]" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
