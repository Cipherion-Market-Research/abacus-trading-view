"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useKycStatus } from "@/hooks/use-kyc-status";

export function RequireKyc({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status, isHydrated } = useKycStatus();

  useEffect(() => {
    if (isHydrated && status !== "approved") {
      router.replace("/signup");
    }
  }, [isHydrated, status, router]);

  if (!isHydrated || status !== "approved") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="inline-flex items-center gap-2 text-[#8b949e] text-sm">
          <Loader2 className="size-4 animate-spin" />
          Checking access…
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
