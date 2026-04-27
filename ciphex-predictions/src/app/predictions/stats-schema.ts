export const REDIS_KEYS = {
  summary: "pred:summary",
  tiers: "pred:tiers",
  bands: "pred:bands",
  gates: "pred:gates",
  eras: "pred:eras",
  wrSeries: "pred:wr:series",
  tape: "pred:tape",
  dashboard: "pred:dashboard",
  dataset: "pred:dataset",
  tranches: "pred:tranches",
} as const;

export const REDIS_TTL = 600; // 10 minutes (2x the 5-min flush interval)

export interface PredSummary {
  accuracy: number;
  positions: number;
  days: number;
  signalsPerDay: number;
  deployments: number;
  gates: number;
  uptime: number;
  lastFlush: string; // ISO timestamp
}

export interface PredTier {
  id: string;
  label: string;
  wr: number;
  n: number;
  perDay: number;
  blurb: string;
}

export interface PredMarginBand {
  range: string;
  wr: number;
  n: number;
}

export interface PredGate {
  n: number;
  v: string;
  name: string;
  fired: number;
  blurb: string;
}

export interface PredEra {
  era: string;
  span: string;
  w: number;
  l: number;
  wr: number;
  gates: number;
}

export interface PredTranche {
  id: string;
  label: string;
  timing: string;
  capital: number;
  wr: number;
  blurb: string;
}

export interface PredTapeRow {
  ts: string;
  tier: string;
  dir: string;
  margin: number;
  conf: string;
  px: string;
  result: string;
  btc: string;
}

export interface PredDashboard {
  wr24h: number;
  wins24h: number;
  total24h: number;
  wrDelta: number;
  streak: number;
  streakDuration: string;
}

export interface PredDataset {
  positions: string;
  trancheSnapshots: string;
  preEntrySignals: string;
  marginSamples: string;
  postT3Snapshots: string;
  fillRecords: string;
}

export interface PredStatsResponse {
  live: boolean;
  staleSince?: string;
  summary: PredSummary;
  tiers: PredTier[];
  bands: PredMarginBand[];
  gates: PredGate[];
  eras: PredEra[];
  tranches: PredTranche[];
  wrSeries: number[];
  tape: PredTapeRow[];
  dashboard: PredDashboard;
  dataset: PredDataset;
}
