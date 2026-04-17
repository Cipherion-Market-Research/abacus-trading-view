"use client";

import { useNetwork } from "@/hooks/use-network";

export function NetworkBadge() {
  const { networkLabel, isDevnet } = useNetwork();

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
        isDevnet
          ? "bg-[rgba(210,153,34,0.15)] text-[#d29922]"
          : "bg-[rgba(63,185,80,0.15)] text-[#3fb950]"
      }`}
    >
      {networkLabel}
    </span>
  );
}
