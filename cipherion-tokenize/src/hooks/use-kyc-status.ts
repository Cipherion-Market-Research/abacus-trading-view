"use client";

import { useEffect, useState } from "react";
import { getKycState, KYC_EVENT, type KycState } from "@/lib/kyc";

export function useKycStatus(): KycState & { isHydrated: boolean } {
  const [state, setState] = useState<KycState>({ status: "none" });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const refresh = () => setState(getKycState());
    refresh();
    setIsHydrated(true);
    window.addEventListener(KYC_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(KYC_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return { ...state, isHydrated };
}
