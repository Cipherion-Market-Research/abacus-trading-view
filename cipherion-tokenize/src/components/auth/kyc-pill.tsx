"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, X } from "lucide-react";
import { resetAllDemoData } from "@/lib/kyc";
import { useKycStatus } from "@/hooks/use-kyc-status";

export function KycPill() {
  const router = useRouter();
  const { status, isHydrated } = useKycStatus();
  const [confirming, setConfirming] = useState(false);

  if (!isHydrated || status !== "approved") return null;

  if (confirming) {
    return (
      <div className="flex items-center gap-1 rounded-full border border-[#d29922]/40 bg-[rgba(210,153,34,0.1)] px-2.5 py-1">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#d29922]">
          Reset demo?
        </span>
        <button
          onClick={async () => {
            await resetAllDemoData();
            setConfirming(false);
            router.push("/");
          }}
          className="text-[10px] font-medium text-[#f85149] hover:text-[#ff7b72] px-1.5"
          type="button"
        >
          yes
        </button>
        <span className="text-[10px] text-[#484f58]">·</span>
        <button
          onClick={() => setConfirming(false)}
          className="text-[#6e7681] hover:text-[#f0f6fc]"
          type="button"
          aria-label="Cancel reset"
        >
          <X className="size-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      title="Reset all demo data (KYC + tokens + distributions)"
      className="flex items-center gap-1.5 rounded-full border border-[#238636]/30 bg-[rgba(63,185,80,0.08)] px-2.5 py-1 hover:bg-[rgba(63,185,80,0.14)] transition-colors"
    >
      <ShieldCheck className="size-3 text-[#3fb950]" />
      <span className="text-[10px] font-mono uppercase tracking-wider text-[#3fb950]">
        KYC · Approved
      </span>
    </button>
  );
}
