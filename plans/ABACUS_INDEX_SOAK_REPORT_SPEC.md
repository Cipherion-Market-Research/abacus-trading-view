# Abacus:INDEX POC Soak Report — Spec (UI Debug Harness)

**Audience:** UI repo coding team

**Goal:** Add an automated soak reporting mechanism so a developer can run `/debug/abacus-index` for a long window and export a structured JSON artifact for ECS handoff.

**Non-goal:** This is not production monitoring. This is an evidence artifact to freeze the Indexer v0 contract and validate POC stability.

---

## 1) Where this lives

Primary UI surface:

- [`ciphex-predictions/src/features/abacus-index/components/AbacusIndexDebug.tsx`](ciphex-predictions/src/features/abacus-index/components/AbacusIndexDebug.tsx:1)

Route:

- [`ciphex-predictions/src/app/debug/abacus-index/page.tsx`](ciphex-predictions/src/app/debug/abacus-index/page.tsx:1)

Data source:

- Abacus hook: [`useAbacusCandles()`](ciphex-predictions/src/features/abacus-index/hooks/useAbacusCandles.ts:79)
- Venue telemetry available via: `spotComposite.telemetry.venues` and `perpComposite.telemetry.venues` (already displayed in debug UI)

---

## 2) Output artifact

### 2.1 Export format

- JSON file download: `abacus_soak_report_<asset>_<startIso>_<duration>.json`
- Also store the latest report in `localStorage` under key: `abacus:soak:lastReport`

### 2.2 Report structure (minimum)

```ts
type SoakReport = {
  version: 'v0';
  createdAtIso: string;

  run: {
    asset: 'BTC' | 'ETH';
    startedAtMs: number;
    endedAtMs: number;
    durationMs: number;
    userAgent: string;
    pageVisibleApprox: boolean; // from document.visibilityState at end
  };

  config: {
    pocPhase: string; // from CURRENT_POC_PHASE
    venues: {
      spot: string[]; // expected spot venues
      perp: string[]; // expected perp venues
    };
    staleThresholdsMs: Record<string, { spot: number; perp: number }>;
    outlierThresholdBps: number;
    maxBarsPerVenue: number;
  };

  snapshots: Array<{
    tMs: number;
    tIso: string;
    asset: 'BTC' | 'ETH';
    spot: {
      compositePrice: number | null;
      degraded: boolean;
      degradedReason: string;
      connectedVenues: number;
      totalVenues: number;
      outliersTotal: number;
      gapsTotal: number;
    };
    perp: {
      compositePrice: number | null;
      degraded: boolean;
      connectedVenues: number;
      totalVenues: number;
    };
    basisBps: number | null;

    venues: Array<{
      venue: string;
      marketType: 'spot' | 'perp';
      connectionState: string;
      lastMessageTime: number | null;
      messageCount: number;
      tradeCount: number;
      reconnectCount: number;
      gapCount: number;
      uptimePercent: number;
      avgMessageRate: number;
    }>;
  }>;

  summary: {
    // Derived from snapshots
    connectedPctByVenue: Record<string, number>; // % snapshots connected
    reconnectsByVenue: Record<string, number>;   // delta from first->last
    gapsByVenue: Record<string, number>;         // max gapCount observed
    outliersTotal: number;                       // max outliers observed
    degradedPctSpot: number;                     // % snapshots spot degraded
    degradedPctPerp: number;                     // % snapshots perp degraded
    notes: string[];
  };
};
```

Notes:

- “Snapshots” are sampled periodically and allow deriving connected/degraded rates without needing continuous logging.
- Do not attempt sub-second exact uptime. This is a POC evidence artifact.

---

## 3) Sampling schedule

### 3.1 Default schedule

- Sample every **15 seconds** (configurable)

This is low overhead and still yields 240 samples/hour.

### 3.4 Clarifications (resolved defaults)

These items were ambiguous; the defaults below are approved for implementation.

1) **Asset switching during an active soak**

- **Decision:** Lock the asset toggle while a soak run is active.
- Rationale: keeps `run.asset` single-valued and avoids mixed-asset data.

2) **Page visibility transitions**

- Add `pageWentBackground: boolean` to `run`.
- Set true if `document.visibilityState !== 'visible'` at any point during the run.
- Do not pause sampling; instead mark the run as potentially compromised.

3) **Snapshot memory budget**

- No hard cap.
- Add a UI warning once snapshots exceed **1000**.
- Add `summary.notes[]` entry automatically when threshold is exceeded.

4) **Outlier tracking scope**

- **Decision:** Track outliers on **spot composite only** (current behavior in POC).
- Keep `spot.outliersTotal` only; do not add a perp outlier field until perp filtering exists.

5) **Auto-persist to localStorage**

- Auto-save the in-progress report to localStorage every **60s** while running.
- Also save on Stop and on Download.

### 3.2 Manual controls

Add buttons:

- Start Soak
- Stop Soak
- Add Note (free text appended to `summary.notes[]`)
- Download JSON
- Reset

The soak should continue running until Stop Soak, then persist the report.

### 3.3 Optional “milestone snapshots”

Optionally show recommended manual checkpoints in the UI:

- 0 min (start)
- 15 min
- 30 min
- 60 min

But sampling will already capture these.

---

## 4) UI guidance (what the user must do)

### 4.1 Foreground vs background

- **Preferred:** keep the tab **foreground**.
- Background tabs may throttle timers and WS activity and can invalidate the “best case” soak.

If the user must walk away:

- keep the tab visible on a monitor
- do not minimize the browser

### 4.2 Recommended test windows

- If you only have 1 hour: do BTC for 60 minutes.
- Long-run evidence: BTC 4 hours; ETH 60–120 minutes.

---

## 5) Acceptance targets (POC evidence thresholds)

These are “good enough to freeze Indexer v0 contract,” not production SLOs.

For a 60-minute BTC run:

- spot composite connected (>= 2 spot venues) in >= 95% of samples
- perp composite connected (>= 2 perp venues) in >= 90% of samples
- gaps: near-zero after cold start (gapCount should not continuously grow)
- reconnects: no repeated thrashing (reconnectCount should not climb steadily minute-over-minute)
- asset switching (if tested): no stale BTC prices when ETH is selected

If these fail, fix before spec freeze.

---

## 6) Go / No-go for spec freeze and ECS handoff

This soak report is used for a specific decision: whether we can freeze “Indexer v0” and hand off the stable contract to ECS.

### 6.1 Go criteria (typical)

For a **BTC 60-minute** run:

- Spot connected samples >= 95%
- Perp connected samples >= 90%
- `pageWentBackground === false` (preferred)
- Gap counts do not steadily grow after cold start
- Reconnect counts are not thrashing (no continuous reconnect loop)

For **ETH**, a 60–120 minute run is recommended, but BTC is primary.

### 6.2 No-go criteria (examples)

- Frequent stale/incorrect asset prices after switching (race conditions)
- Persistent degraded status without clear cause
- GapCount grows steadily (missing minutes) without recovery
- ReconnectCount climbs continuously (reconnect loop)

### 6.3 What a “successful soak” unlocks

If the run is a Go:

- Freeze Indexer v0 scope + API contract
- Assemble ECS handoff package (see [`plans/ABACUS_INDEX_PRODUCTION_ROADMAP.md`](plans/ABACUS_INDEX_PRODUCTION_ROADMAP.md:1))
- ECS team begins implementing the always-on indexer service (server-side connectors + persistence + REST backfill + SSE stream)

---

## 7) Implementation notes

- Store state in React `useState` + `useRef` to avoid re-render storms.
- Take snapshots from already-available hook outputs (no new WS work).
- Use `window.crypto.getRandomValues` or `Date.now()` for run identifiers.
- Keep it robust: if a field is missing, record `null` and continue.

---

## 8) Deliverable

One PR that:

- Adds the soak report controls + JSON export to the debug harness UI
- Documents how to run the soak (short note at top of debug page)
