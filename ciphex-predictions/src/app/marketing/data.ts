export const PRED_DATA = {
  product: {
    name: "CipheX Predictions",
    tagline: "A directional signal engine for short-window crypto markets.",
  },
  hero: {
    accuracy: 88.2,
    positions: 11000,
    days: 64,
    signalsPerDay: 187,
    deployments: 56,
    gates: 15,
  },
  tiers: [
    { id: "all", label: "All positions", wr: 88.2, n: 7071, perDay: 187, blurb: "Every window the engine enters" },
    { id: "full", label: "Full quality", wr: 90.3, n: 3112, perDay: 82, blurb: "High confidence + high margin" },
    { id: "m60", label: "Full · |margin| ≥ 60", wr: 91.8, n: 868, perDay: 23, blurb: "Strong directional conviction" },
    { id: "m100", label: "Full · |margin| ≥ 100", wr: 96.3, n: 109, perDay: 3, blurb: "Extreme conviction · near-perfect" },
    { id: "probe", label: "Probe quality", wr: 86.5, n: 3959, perDay: 105, blurb: "Moderate confidence, smaller sizing" },
  ],
  marginBands: [
    { range: "< $20", wr: 88.8, n: 2224 },
    { range: "$20–40", wr: 86.7, n: 2348 },
    { range: "$40–60", wr: 87.6, n: 1566 },
    { range: "$60–80", wr: 90.3, n: 618 },
    { range: "$80–100", wr: 91.0, n: 199 },
    { range: "$100+", wr: 96.6, n: 116 },
  ],
  wrSeries: [87.6, 88.1, 88.0, 87.9, 88.4, 88.2, 88.5, 88.3, 88.1, 88.4, 88.6, 88.2, 88.3, 88.2],
  tranches: [
    { id: "T1", label: "Probe", timing: "T-60s", capital: 5, wr: 88.1, blurb: "Tiered quality gate establishes direction" },
    { id: "T2", label: "Confirm", timing: "T-45s", capital: 5, wr: 88.3, blurb: "Confidence + margin + LWBA gates" },
    { id: "T3", label: "Conviction", timing: "T-30s", capital: 90, wr: 90.3, blurb: "All 15 gates must pass" },
  ],
  gates: [
    { n: 1, v: "v20", name: "Tiered T1 Quality", fired: 0, blurb: "conf ≥ 0.92 ∧ |m| ≥ 30 for full tier" },
    { n: 2, v: "v20", name: "Probe T3 Block", fired: 118, blurb: "Probe positions hard-blocked from T3" },
    { n: 3, v: "v23", name: "Probe T2 Margin", fired: 1351, blurb: "Block probe T2 when |mT2| < 37" },
    { n: 4, v: "v18", name: "T3 Price Floor", fired: 94, blurb: "Block T3 when entry < 0.81" },
    { n: 5, v: "v16", name: "Confidence Floor", fired: 0, blurb: "Block T3 when confT1 < 0.50" },
    { n: 6, v: "v16", name: "Oscillation Gate", fired: 2188, blurb: "Block T2+ when oscillations > 5" },
    { n: 7, v: "v16", name: "LWBA Spread Gate", fired: 10475, blurb: "Block T2+ when spread > 3.5" },
    { n: 8, v: "v21", name: "Velocity Gate", fired: 0, blurb: "Downsize T3 to 40% on rapid mean reversion" },
    { n: 9, v: "v25b", name: "Margin Trajectory", fired: 156, blurb: "Block T3 on T2→T3 erosion > 15%" },
    { n: 10, v: "v29", name: "30m Regime Gate", fired: 29, blurb: "Block T3 when BTC moved < $30 in prior 30m" },
    { n: 11, v: "v27", name: "Probe Performance", fired: 573, blurb: "Block probes when rolling WR < 75%" },
    { n: 12, v: "v30", name: "Time Gate", fired: 11, blurb: "Block T3 when < 10s remaining" },
    { n: 13, v: "v30", name: "Ask Concentration", fired: 9, blurb: "Block T3 when askConc ≥ 0.05" },
    { n: 14, v: "v30", name: "UP Price Ceiling", fired: 35, blurb: "Block UP T3 when entry ≥ 0.92" },
    { n: 15, v: "v30", name: "spotBSR10s Gate", fired: 12, blurb: "Block T3 when CEX spot vol ratio ≥ 6.0" },
  ],
  t3Eras: [
    { era: "Live · v14–v28", span: "Feb 22 – Mar 7", w: 153, l: 19, wr: 89.0, gates: 11 },
    { era: "Paper · v29", span: "Mar 7 – Mar 20", w: 116, l: 18, wr: 86.6, gates: 12 },
    { era: "Paper · v30", span: "Mar 20 – Apr 27", w: 56, l: 6, wr: 90.3, gates: 15 },
  ],
  feeds: [
    { name: "Chainlink RTDS", rate: "1/sec", proto: "WebSocket", role: "Oracle direction + momentum", propr: false },
    { name: "Chainlink LWBA Direct", rate: "1/sec", proto: "WebSocket", role: "Institutional bid-ask spread", propr: true },
    { name: "Polymarket CLOB", rate: "real-time", proto: "WebSocket", role: "Orderbook depth + concentration", propr: false },
    { name: "Abacus Indexer", rate: "30s poll", proto: "REST", role: "BTC spot+perp flow · 4 venues", propr: false },
    { name: "Gamma Markets API", rate: "on-demand", proto: "REST", role: "Market metadata, resolution", propr: false },
    { name: "Polygon L2 RPC", rate: "on-demand", proto: "JSON-RPC", role: "On-chain CTF + tx verification", propr: false },
  ],
  dataset: [
    { what: "Position records", count: "11,000+", fields: "60+ each", note: "Complete since market inception" },
    { what: "Per-tranche signal snapshots", count: "33,000+", fields: "20 each", note: "T1/T2/T3 microstructure at entry" },
    { what: "Pre-entry signals", count: "44,000+", fields: "12 each", note: "T-80 / T-70 / T-65 directional probes" },
    { what: "Margin trajectory samples", count: "500,000+", fields: "3 each", note: "5-second sampling, full window" },
    { what: "Post-T3 1-second snapshots", count: "2,000+", fields: "10 each", note: "1-sec high-res from T3 to resolution" },
    { what: "Live fill records", count: "3,000+", fields: "10 each", note: "On-chain verified execution data" },
  ],
  expansion: [
    { asset: "BTC/USD", venue: "Polymarket", status: "Production" as const, perDay: "187", note: "Current deployment" },
    { asset: "ETH/USD", venue: "Polymarket / CEX", status: "Planned" as const, perDay: "~150", note: "Config + feed swap" },
    { asset: "SOL/USD", venue: "Polymarket / CEX", status: "Planned" as const, perDay: "~150", note: "Config + feed swap" },
    { asset: "XRP/USD", venue: "Polymarket / CEX", status: "Planned" as const, perDay: "~150", note: "Config + feed swap" },
    { asset: "BTC/USD", venue: "Kalshi", status: "Planned" as const, perDay: "—", note: "5m windows · 2-4 weeks effort" },
    { asset: "BTC perp", venue: "Binance / Bybit", status: "Exploration" as const, perDay: "187", note: "Symmetric payoffs · CEX pivot" },
  ],
  moats: [
    { m: "LWBA Direct Feed", d: "Credentialed institutional oracle access", r: "Hard" as const },
    { m: "56-version R&D history", d: "Every hypothesis tested, every failure attributed", r: "Medium" as const },
    { m: "15-gate defense stack", d: "Each gate has statistical backing & loss attribution", r: "Medium" as const },
    { m: "11K+ position dataset", d: "Per-second microstructure not available elsewhere", r: "Hard" as const },
    { m: "Production infrastructure", d: "Circuit breakers, auto-redemption, graceful shutdown", r: "Medium" as const },
  ],
};

export type TapeRow = {
  ts: string;
  tier: string;
  dir: string;
  margin: number;
  conf: string;
  px: string;
  result: string;
  btc: string;
};

export function generateTape(): TapeRow[] {
  const out: TapeRow[] = [];
  let ts = Date.now() - 60_000;
  let s = 7;
  const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 80; i++) {
    const dir = rand() > 0.5 ? "UP" : "DOWN";
    const tier = rand() > 0.62 ? "T3" : rand() > 0.4 ? "T2" : "T1";
    const margin = (15 + rand() * 110) | 0;
    const conf = (0.5 + rand() * 0.5).toFixed(2);
    const win = rand() < (tier === "T3" ? 0.903 : tier === "T2" ? 0.883 : 0.881);
    const px = (0.62 + rand() * 0.32).toFixed(3);
    out.push({
      ts: new Date(ts).toISOString().slice(11, 19),
      tier, dir, margin, conf, px,
      result: win ? "WIN" : "LOSS",
      btc: (94000 + ((rand() * 6000) | 0)).toLocaleString(),
    });
    ts += 30_000 + rand() * 90_000;
  }
  return out;
}
