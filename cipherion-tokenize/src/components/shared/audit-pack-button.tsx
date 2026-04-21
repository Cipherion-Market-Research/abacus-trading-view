"use client";

import { useState } from "react";
import { FileArchive, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateAuditPack } from "@/lib/utils/audit-pack";
import { useNetwork } from "@/hooks/use-network";
import { toastSuccess, toastError } from "@/hooks/use-toast";
import type { TokenInfo, HolderInfo } from "@/types/token";

interface AuditPackButtonProps {
  token: TokenInfo;
  holders: HolderInfo[];
}

export function AuditPackButton({ token, holders }: AuditPackButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { networkLabel } = useNetwork();

  const handleExport = async () => {
    setIsGenerating(true);
    try {
      await generateAuditPack({
        token,
        holders,
        network: networkLabel,
      });
      toastSuccess("Audit pack downloaded", {
        description: `${token.symbol} — holders, transactions, distributions, and metadata.`,
      });
    } catch (err) {
      toastError(
        err instanceof Error ? err.message : "Failed to generate audit pack"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isGenerating}
      className="gap-1.5 border-[#30363d] bg-[#161b22] text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#21262d]"
    >
      {isGenerating ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <FileArchive className="size-3" />
      )}
      Audit Pack
    </Button>
  );
}
