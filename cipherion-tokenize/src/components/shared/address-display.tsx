"use client";

import { useState, useCallback } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { truncateAddress } from "@/lib/utils/format";
import { useNetwork } from "@/hooks/use-network";

interface AddressDisplayProps {
  address: string;
  truncate?: boolean;
  showExplorer?: boolean;
  className?: string;
}

export function AddressDisplay({
  address,
  truncate = true,
  showExplorer = false,
  className = "",
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);
  const { explorerAddressUrl } = useNetwork();

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [address]);

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="font-mono text-xs">
        {truncate ? truncateAddress(address) : address}
      </span>
      <button
        onClick={handleCopy}
        className="text-[#8b949e] hover:text-[#f0f6fc] transition-colors"
        title="Copy address"
      >
        {copied ? (
          <Check className="size-3 text-[#3fb950]" />
        ) : (
          <Copy className="size-3" />
        )}
      </button>
      {showExplorer && (
        <a
          href={explorerAddressUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#8b949e] hover:text-[#58a6ff] transition-colors"
          title="View on Solana Explorer"
        >
          <ExternalLink className="size-3" />
        </a>
      )}
    </span>
  );
}
