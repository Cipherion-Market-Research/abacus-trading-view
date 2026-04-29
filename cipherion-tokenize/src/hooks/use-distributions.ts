"use client";

import { useState, useEffect, useCallback } from "react";
import {
  loadDistributions,
  fetchDistributionsFromServer,
  saveDistribution,
  type DistributionRecord,
} from "@/lib/distributions";

export function useDistributions(mintAddress: string) {
  const [records, setRecords] = useState<DistributionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const local = loadDistributions(mintAddress);
      const { records: server, configured } = await fetchDistributionsFromServer(mintAddress);

      if (configured && server.length > 0) {
        for (const rec of server) {
          saveDistribution({ ...rec, serverSync: "synced" });
        }
        const serverIds = new Set(server.map((r) => r.id));
        const pendingOnly = local.filter(
          (r) => r.serverSync === "pending" && !serverIds.has(r.id)
        );
        setPendingSyncCount(pendingOnly.length);
        setRecords([...pendingOnly, ...server]);
      } else {
        const pending = local.filter((r) => r.serverSync === "pending");
        setPendingSyncCount(pending.length);
        setRecords(local);
      }
    } catch {
      const local = loadDistributions(mintAddress);
      setPendingSyncCount(local.filter((r) => r.serverSync === "pending").length);
      setRecords(local);
    } finally {
      setIsLoading(false);
    }
  }, [mintAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { records, isLoading, pendingSyncCount, refresh };
}
