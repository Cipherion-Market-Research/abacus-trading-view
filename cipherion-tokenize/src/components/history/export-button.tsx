"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateCsv, downloadCsv } from "@/lib/utils/csv";
import { formatTokenAmount } from "@/lib/utils/format";
import type { TransactionInfo } from "@/types/token";

interface ExportButtonProps {
  transactions: TransactionInfo[];
  decimals: number;
  symbol: string;
  tokenName: string;
}

export function ExportButton({
  transactions,
  decimals,
  symbol,
  tokenName,
}: ExportButtonProps) {
  const handleExport = () => {
    const headers = [
      "Timestamp",
      "Type",
      "From",
      "To",
      "Amount",
      "Token",
      "Memo",
      "Signature",
      "Block Time (Unix)",
    ];

    const rows = transactions.map((tx) => [
      tx.blockTime
        ? new Date(tx.blockTime * 1000).toISOString()
        : "",
      tx.type,
      tx.from ?? "",
      tx.to ?? "",
      tx.amount !== undefined
        ? formatTokenAmount(tx.amount, decimals)
        : "",
      symbol,
      tx.memo ?? "",
      tx.signature,
      tx.blockTime?.toString() ?? "",
    ]);

    const csv = generateCsv(headers, rows);
    const date = new Date().toISOString().split("T")[0];
    downloadCsv(csv, `${tokenName.replace(/\s+/g, "_")}_audit_${date}.csv`);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={transactions.length === 0}
      className="gap-1.5 border-[#30363d] bg-[#161b22] text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#21262d]"
    >
      <Download className="size-3" />
      Export CSV
    </Button>
  );
}
