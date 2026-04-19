"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExplorerLink } from "@/components/shared/explorer-link";
import { truncateAddress } from "@/lib/utils/format";
import type { TransactionInfo } from "@/types/token";

interface TransactionListProps {
  transactions: TransactionInfo[];
  decimals: number;
  symbol: string;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

function formatTime(blockTime: number | null): string {
  if (!blockTime) return "—";
  const date = new Date(blockTime * 1000);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function TransactionList({
  transactions,
  isLoading,
  hasMore,
  onLoadMore,
}: TransactionListProps) {
  if (transactions.length === 0 && !isLoading) {
    return (
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-8 text-center">
        <p className="text-sm text-[#8b949e]">No transactions yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {transactions.map((tx) => (
        <div
          key={tx.signature}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3 rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-xs text-[#8b949e]">
              {truncateAddress(tx.signature, 8)}
            </span>
            {tx.memo && (
              <span className="text-[10px] text-[#484f58] truncate max-w-[200px]">
                {tx.memo}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-3 sm:shrink-0">
            <span className="text-[10px] text-[#8b949e]">
              {formatTime(tx.blockTime)}
            </span>
            <ExplorerLink
              type="tx"
              value={tx.signature}
              label="View"
              className="text-[10px]"
            />
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="size-4 text-[#8b949e] animate-spin" />
          <span className="ml-2 text-xs text-[#8b949e]">Loading...</span>
        </div>
      )}

      {hasMore && !isLoading && (
        <div className="text-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            className="gap-1.5 border-[#30363d] bg-[#161b22] text-[#8b949e] hover:text-[#f0f6fc]"
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
