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
    { id: "full", label: "Full conviction", wr: 90.3, n: 3112, perDay: 82, blurb: "Full validation — all criteria met" },
    { id: "m60", label: "High conviction", wr: 91.8, n: 868, perDay: 23, blurb: "Strong directional conviction" },
    { id: "m100", label: "Extreme conviction", wr: 96.3, n: 109, perDay: 3, blurb: "Peak conviction · near-perfect signal quality" },
    { id: "probe", label: "Initial probe", wr: 86.5, n: 3959, perDay: 105, blurb: "Directional probe · smaller sizing" },
  ],
  marginBands: [
    { range: "Band I", wr: 88.8, n: 2224 },
    { range: "Band II", wr: 86.7, n: 2348 },
    { range: "Band III", wr: 87.6, n: 1566 },
    { range: "Band IV", wr: 90.3, n: 618 },
    { range: "Band V", wr: 91.0, n: 199 },
    { range: "Band VI", wr: 96.6, n: 116 },
  ],
  wrSeries: [87.6, 88.1, 88.0, 87.9, 88.4, 88.2, 88.5, 88.3, 88.1, 88.4, 88.6, 88.2, 88.3, 88.2],
  tranches: [
    { id: "T1", label: "Probe", timing: "Early window", capital: 5, wr: 88.1, blurb: "Establishes initial directional position" },
    { id: "T2", label: "Confirm", timing: "Mid window", capital: 5, wr: 88.3, blurb: "Validates signal stability and execution quality" },
    { id: "T3", label: "Conviction", timing: "Final window", capital: 90, wr: 90.3, blurb: "Full validation suite — complete confirmation required" },
  ],
  gates: [
    { n: 1, v: "v20", name: "Entry Quality Screen", fired: 0, blurb: "Multi-factor entry quality screen" },
    { n: 2, v: "v20", name: "Tier Isolation Filter", fired: 118, blurb: "Position class isolation" },
    { n: 3, v: "v23", name: "Conviction Floor Screen", fired: 1351, blurb: "Conviction threshold enforcement" },
    { n: 4, v: "v18", name: "Entry Price Screen", fired: 94, blurb: "Entry price quality filter" },
    { n: 5, v: "v16", name: "Signal Confidence Screen", fired: 0, blurb: "Minimum confidence enforcement" },
    { n: 6, v: "v16", name: "Market Stability Filter", fired: 2188, blurb: "Market stability validation" },
    { n: 7, v: "v16", name: "Liquidity Quality Filter", fired: 10475, blurb: "Execution quality pre-screen" },
    { n: 8, v: "v21", name: "Momentum Decay Screen", fired: 0, blurb: "Position sizing on reversal signals" },
    { n: 9, v: "v25b", name: "Signal Convergence Screen", fired: 156, blurb: "Signal trajectory validation" },
    { n: 10, v: "v29", name: "Market Regime Filter", fired: 29, blurb: "Market activity regime gate" },
    { n: 11, v: "v27", name: "Historical Quality Screen", fired: 573, blurb: "Rolling performance quality gate" },
    { n: 12, v: "v30", name: "Execution Window Filter", fired: 11, blurb: "Window timing enforcement" },
    { n: 13, v: "v30", name: "Order Depth Screen", fired: 9, blurb: "Order book concentration filter" },
    { n: 14, v: "v30", name: "Directional Ceiling Screen", fired: 35, blurb: "Directional entry price ceiling" },
    { n: 15, v: "v30", name: "Cross-Venue Signal Screen", fired: 12, blurb: "Cross-venue flow regime validation" },
  ],
  t3Eras: [
    { era: "Phase I", span: "Feb 22 – Mar 7", w: 153, l: 19, wr: 89.0, gates: 11 },
    { era: "Phase II", span: "Mar 7 – Mar 20", w: 116, l: 18, wr: 86.6, gates: 12 },
    { era: "Phase III", span: "Mar 20 – Apr 27", w: 56, l: 6, wr: 90.3, gates: 15 },
  ],
  feeds: [
    { name: "Decentralized Price Oracle", rate: "1/sec", proto: "WebSocket", role: "Price direction and momentum", propr: false },
    { name: "Proprietary Institutional Feed", rate: "1/sec", proto: "WebSocket", role: "Market microstructure signal", propr: true },
    { name: "Prediction Market Order Book", rate: "real-time", proto: "WebSocket", role: "Depth and concentration signals", propr: false },
    { name: "Abacus Multi-Venue Indexer", rate: "30s poll", proto: "REST", role: "Cross-venue flow analysis", propr: true },
    { name: "Market Metadata Provider", rate: "on-demand", proto: "REST", role: "Event resolution and market lifecycle", propr: false },
    { name: "On-Chain Settlement Layer", rate: "on-demand", proto: "JSON-RPC", role: "Transaction verification and settlement", propr: false },
  ],
  dataset: [
    { what: "Position records", count: "11,000+", fields: "60+ each", note: "Complete since market inception" },
    { what: "Per-tranche signal snapshots", count: "33,000+", fields: "20 each", note: "Per-stage microstructure captured at each entry point" },
    { what: "Pre-entry signals", count: "44,000+", fields: "12 each", note: "Multi-horizon directional probes prior to entry" },
    { what: "Conviction trajectory samples", count: "500,000+", fields: "3 each", note: "High-frequency intra-window sampling" },
    { what: "Post-conviction snapshots", count: "2,000+", fields: "10 each", note: "High-resolution signal capture through resolution" },
    { what: "Live fill records", count: "3,000+", fields: "10 each", note: "On-chain verified execution data" },
  ],
  expansion: [
    { asset: "BTC/USD", venue: "Binary Prediction Market", status: "Production" as const, perDay: "187", note: "Current deployment" },
    { asset: "ETH/USD", venue: "Prediction Market / CEX", status: "Planned" as const, perDay: "~150", note: "Standard asset port" },
    { asset: "SOL/USD", venue: "Prediction Market / CEX", status: "Planned" as const, perDay: "~150", note: "Standard asset port" },
    { asset: "XRP/USD", venue: "Prediction Market / CEX", status: "Planned" as const, perDay: "~150", note: "Standard asset port" },
    { asset: "BTC/USD", venue: "Regulated Event Exchange", status: "Planned" as const, perDay: "—", note: "Equivalent window structure" },
    { asset: "BTC perp", venue: "Derivatives Exchange", status: "Exploration" as const, perDay: "187", note: "Symmetric payoffs · full expansion" },
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
    const conf = (0.62 + rand() * 0.36).toFixed(2);
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
