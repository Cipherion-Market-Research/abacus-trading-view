"use client";

import { ExternalLink } from "lucide-react";
import { useNetwork } from "@/hooks/use-network";

interface ExplorerLinkProps {
  type: "address" | "tx";
  value: string;
  label?: string;
  className?: string;
}

export function ExplorerLink({
  type,
  value,
  label,
  className = "",
}: ExplorerLinkProps) {
  const { explorerAddressUrl, explorerTxUrl } = useNetwork();
  const url = type === "address" ? explorerAddressUrl(value) : explorerTxUrl(value);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-xs text-[#58a6ff] hover:underline ${className}`}
    >
      {label ?? "View on Explorer"}
      <ExternalLink className="size-3" />
    </a>
  );
}
