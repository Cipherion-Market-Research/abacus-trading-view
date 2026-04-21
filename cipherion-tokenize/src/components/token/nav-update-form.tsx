"use client";

import { useState } from "react";
import { Pencil, Loader2, X, Check } from "lucide-react";
import { PublicKey } from "@solana/web3.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateMetadataFields } from "@/lib/solana/metadata-service";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { useNetwork } from "@/hooks/use-network";
import { toastSuccess, toastError } from "@/hooks/use-toast";

interface NavUpdateFormProps {
  mintAddress: string;
  currentNav: number;
  navKey: string;
  onSuccess: () => void;
}

export function NavUpdateForm({
  mintAddress,
  currentNav,
  navKey,
  onSuccess,
}: NavUpdateFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(currentNav.toFixed(2));
  const [isSaving, setIsSaving] = useState(false);
  const { signAndSend, publicKey } = useSendTransaction();
  const { explorerTxUrl } = useNetwork();

  const handleSave = async () => {
    if (!publicKey) return;
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed <= 0) {
      toastError("NAV must be a positive number");
      return;
    }

    setIsSaving(true);
    try {
      const mint = new PublicKey(mintAddress);
      const today = new Date().toISOString().slice(0, 10);
      const sig = await updateMetadataFields(
        mint,
        publicKey,
        [
          { key: navKey, value: parsed.toFixed(2) },
          { key: "nav_date", value: today },
        ],
        signAndSend
      );
      toastSuccess("NAV updated on-chain", {
        description: `${navKey} → $${parsed.toFixed(2)}`,
        action: { label: "View TX", href: explorerTxUrl(sig) },
      });
      setIsEditing(false);
      onSuccess();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "NAV update failed");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsEditing(true)}
        className="gap-1 text-[10px] text-[#8b949e] hover:text-[#58a6ff] hover:bg-[rgba(88,166,255,0.1)] h-auto py-1 px-1.5"
      >
        <Pencil className="size-2.5" />
        Update
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[#8b949e] text-xs">$</span>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") setIsEditing(false);
        }}
        className="h-7 w-24 border-[#30363d] bg-[#0d1117] text-[#f0f6fc] font-mono text-xs px-2"
        autoFocus
        disabled={isSaving}
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSave}
        disabled={isSaving}
        className="h-7 w-7 p-0 text-[#3fb950] hover:text-[#3fb950] hover:bg-[rgba(63,185,80,0.1)]"
      >
        {isSaving ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Check className="size-3" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setIsEditing(false);
          setValue(currentNav.toFixed(2));
        }}
        disabled={isSaving}
        className="h-7 w-7 p-0 text-[#8b949e] hover:text-[#f85149] hover:bg-[rgba(248,81,73,0.1)]"
      >
        <X className="size-3" />
      </Button>
    </div>
  );
}
