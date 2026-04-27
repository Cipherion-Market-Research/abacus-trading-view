"use client";

import { useState, useEffect } from "react";
import { PRED_DATA, generateTape } from "./data";
import type { PredStatsResponse } from "./stats-schema";

type DataMode = "live" | "stale" | "fallback";

interface PredStats {
  mode: DataMode;
  staleSince?: string;
  loading: boolean;
  D: typeof PRED_DATA;
  tape: ReturnType<typeof generateTape>;
  dashboard: PredStatsResponse["dashboard"];
  wrSeries: number[];
}

const FALLBACK_DASHBOARD: PredStatsResponse["dashboard"] = {
  wr24h: 88.4,
  wins24h: 176,
  total24h: 199,
  wrDelta: 0.2,
  streak: 14,
  streakDuration: "4d 8h",
};

function mapResponseToData(res: PredStatsResponse): PredStats {
  return {
    mode: res.live ? "live" : "stale",
    staleSince: res.staleSince,
    loading: false,
    D: {
      ...PRED_DATA,
      hero: { ...PRED_DATA.hero, ...res.summary },
      tiers: res.tiers.length ? res.tiers : PRED_DATA.tiers,
      marginBands: res.bands.length ? res.bands : PRED_DATA.marginBands,
      gates: res.gates.length ? res.gates : PRED_DATA.gates,
      t3Eras: res.eras.length ? res.eras : PRED_DATA.t3Eras,
      tranches: res.tranches.length ? res.tranches : PRED_DATA.tranches,
      wrSeries: res.wrSeries.length ? res.wrSeries : PRED_DATA.wrSeries,
      dataset: res.dataset
        ? [
            { what: "Position records", count: res.dataset.positions, fields: "60+ each", note: "Complete since market inception" },
            { what: "Per-tranche signal snapshots", count: res.dataset.trancheSnapshots, fields: "20 each", note: "Per-stage microstructure captured at each entry point" },
            { what: "Pre-entry signals", count: res.dataset.preEntrySignals, fields: "12 each", note: "Multi-horizon directional probes prior to entry" },
            { what: "Conviction trajectory samples", count: res.dataset.marginSamples, fields: "3 each", note: "High-frequency intra-window sampling" },
            { what: "Post-conviction snapshots", count: res.dataset.postT3Snapshots, fields: "10 each", note: "High-resolution signal capture through resolution" },
            { what: "Live fill records", count: res.dataset.fillRecords, fields: "10 each", note: "On-chain verified execution data" },
          ]
        : PRED_DATA.dataset,
    },
    tape: res.tape.length ? res.tape : generateTape(),
    dashboard: res.dashboard ?? FALLBACK_DASHBOARD,
    wrSeries: res.wrSeries.length ? res.wrSeries : PRED_DATA.wrSeries,
  };
}

export function usePredStats(): PredStats {
  const [stats, setStats] = useState<PredStats>({
    mode: "fallback",
    loading: true,
    D: PRED_DATA,
    tape: [],
    dashboard: FALLBACK_DASHBOARD,
    wrSeries: PRED_DATA.wrSeries,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/predictions/stats");
        if (!res.ok) throw new Error(`${res.status}`);
        const data: PredStatsResponse = await res.json();
        if (!cancelled) setStats(mapResponseToData(data));
      } catch {
        if (!cancelled) {
          setStats((prev) => ({
            ...prev,
            loading: false,
            mode: "fallback",
            tape: prev.tape.length ? prev.tape : generateTape(),
          }));
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return stats;
}
