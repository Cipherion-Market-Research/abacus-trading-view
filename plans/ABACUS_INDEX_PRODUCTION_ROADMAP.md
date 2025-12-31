# Abacus:INDEX — Production Roadmap (UI + ECS Indexer + Forecasting)

**Status:** Planning / Execution Guide

**Audience:**
- UI team working in [`ciphex-predictions/`](ciphex-predictions)
- ECS forecasting/indexer team (separate repo/service)

**Purpose:** Prevent local-maximum polishing of the browser POC and align the team on a clear production shipping path.

---

## 1. Executive Summary (one screen)

### 1.1 What we have today

This repo contains a **browser-based POC** of Abacus:INDEX that has advanced to **POC-2**:

- Multi-venue **Spot Composite**: Binance, Coinbase, OKX, Kraken
- Multi-venue **Perp Composite**: Binance, OKX, Bybit
- **Basis**: perp - spot, plus bps
- **Telemetry + degraded semantics**
- UI toggle in main chart and a debug harness route

Implementation lives in:

- Feature module: [`ciphex-predictions/src/features/abacus-index`](ciphex-predictions/src/features/abacus-index)
- Debug route: [`ciphex-predictions/src/app/debug/abacus-index/page.tsx`](ciphex-predictions/src/app/debug/abacus-index/page.tsx:1)

### 1.2 What we do NOT have

- No **production Abacus Indexer** deployed on ECS
- No **persisted historical candles** for Abacus (so MACD warm-up and no history-on-load)
- No authoritative **gap repair / backfill** pipeline
- No **versioned API contract** that both UI and forecasting consume

### 1.3 The core decision

In production, the browser must **not** ingest exchange WebSockets. The POC proved viability; the next step is to **ship an always-on ECS indexer**.

---

## 2. Roles and boundaries (what stays here vs what moves)

### 2.1 UI repo responsibilities (this repo)

Keep this repo focused on:

1. **Spec + reference behavior** (types, symbol mapping, outlier/stale logic)
2. **UX + integration** (toggle, labels, degraded status, chart behavior)
3. **Debug harness UI** (but eventually powered by indexer telemetry)

Avoid:

- Adding more venues beyond POC-2 unless it directly informs production scope
- Adding complex browser-only reliability hacks that will be discarded for ECS

### 2.2 ECS repo responsibilities

ECS owns:

- always-on ingestion (server-side connectors)
- persistence and historical backfill
- gap detection and repair
- stable APIs (REST backfill + live updates)
- telemetry for alerts and QA
- model-facing dataset extraction

---

## 3. What to extract and hand off to ECS (and what not to)

### 3.1 Copy/extract (environment-agnostic core)

These are the durable “Abacus standard” and should be shared with ECS:

- Canonical contract: [`types.ts`](ciphex-predictions/src/features/abacus-index/types.ts:1)
- Symbol mapping: [`symbolMapping.ts`](ciphex-predictions/src/features/abacus-index/symbolMapping.ts:1)
- Core math:
  - Candle building primitives: [`barBuilder.ts`](ciphex-predictions/src/features/abacus-index/utils/barBuilder.ts:1)
  - Outlier filter: [`outlierFilter.ts`](ciphex-predictions/src/features/abacus-index/utils/outlierFilter.ts:1)
  - Timestamp utilities: [`timestamps.ts`](ciphex-predictions/src/features/abacus-index/utils/timestamps.ts:1)
- Policy constants (after v0 freeze): [`constants.ts`](ciphex-predictions/src/features/abacus-index/constants.ts:1)

Preferred: publish these as a small shared library/module rather than ad-hoc copy/paste.

### 3.2 Do NOT copy (browser-only)

- React venue hooks: [`hooks/venues`](ciphex-predictions/src/features/abacus-index/hooks/venues/index.ts:1)
- React composites/hooks: [`hooks/`](ciphex-predictions/src/features/abacus-index/hooks/index.ts:1)
- Debug UI components: [`AbacusIndexDebug`](ciphex-predictions/src/features/abacus-index/components/AbacusIndexDebug.tsx:1)
- Debug page: [`/debug/abacus-index`](ciphex-predictions/src/app/debug/abacus-index/page.tsx:1)

ECS should re-implement venue connectors server-side.

---

## 4. “Indexer v0” definition (what we ship first)

### 4.1 Scope (recommended)

- Assets: BTC, ETH
- Interval: 1m only
- Outputs:
  - Spot composite candles (required)
  - Perp composite candles (optional v0, but desirable)
  - Basis/basis_bps (optional v0)
  - Quality flags + telemetry (required)

### 4.2 Quality flags (required)

Each output candle (and latest snapshot) must include:

- `degraded: boolean`
- `excluded_venues: [{ venue, reason: disconnected|stale|outlier|no_data }]`
- `included_venues: [venue]`
- `stale_count`, `outlier_count`
- `is_gap`, `is_backfilled`

These flags are mandatory for forecasting integrity and honest UI rendering.

---

## 5. Production API contract (recommended)

### 5.1 REST (history/backfill)

`GET /abacus/v0/candles?asset=BTC&marketType=spot&interval=1m&from=...&to=...`

Returns 1m candles with quality flags.

### 5.2 REST (latest snapshot)

`GET /abacus/v0/latest?asset=BTC`

Returns:

- last composite price
- current forming candle
- last completed candle
- current degraded status + excluded venues

### 5.3 Push channel (live feel)

**Default recommendation:** SSE

`GET /abacus/v0/stream?asset=BTC`

Event payload cadence options:

- 250–500ms: “trade-level feel” without sending trades
- 1s: usually sufficient

Payload sends updates for:

- last price
- forming candle
- quality flags

---

## 6. Roadmap milestones (what the UI team should do vs ECS team)

### Milestone 0 — Finish POC stabilization (UI repo)

Goal: POC remains a reliable reference implementation.

Work:

- ✅ Add stale WS callback guards across all venue hooks (completed — all 8 hooks have guards)
- Run a 4-hour soak for BTC and ETH in POC-2 and record: uptime/reconnects/gaps/outliers/CPU/memory

Deliverable: evidence + confirmation that types/policies are stable enough to freeze.

### Milestone 1 — Freeze Indexer v0 spec (UI repo + stakeholders)

Goal: create a stable target for ECS implementation.

Work:

- Freeze:
  - venues/assets scope
  - outlier threshold
  - stale thresholds
  - quality flag schema
  - API contract

Deliverable: a “handoff package” (Section 7).

### Milestone 2 — Implement ECS Abacus Indexer v0 (ECS team)

Goal: always-on source of truth for candles + latest updates.

Work:

- server-side venue connectors
- composite + candle formation
- persistence + backfill
- REST + SSE endpoints

Deliverable: deployed service in ECS.

### Milestone 3 — Switch UI to indexer-backed data (UI repo)

Goal: UI uses ECS outputs for production reliability.

Work:

- chart history loads via `/candles`
- live feel via SSE `/stream`
- `/debug/abacus-index` reads `/telemetry`

Deliverable: production UI no longer connects to exchanges.

### Milestone 4 — Forecasting dataset proof (ECS team)

Goal: forecasting pipeline consumes reliable candles.

Work:

- model reads last X completed candles
- model-side gating based on quality flags
- optional: basis/funding
- optional later: trade-flow aggregates

---

## 7. Handoff package (what you send the ECS team)

When Milestone 1 is done, send:

1. "Core module subset" files (Section 3.1)
2. The frozen API contract (Section 5)
3. POC evidence (soak results)
4. A short "correctness invariants" list:
   - median composite rules
   - outlier threshold
   - stale thresholds
   - degraded semantics
   - gap/backfill semantics

---

## 8. Anti-goals (explicit)

To avoid wasting time:

- Do not optimize the browser POC for perfect uptime
- Do not add more venues/assets until indexer v0 is deployed
- Do not forward raw trade frequency to the UI in production

---

## 9. Team feedback addenda (incorporated)

### 9.1 Timeframe strategy (avoid premature complexity)

**Production v0 recommendation:** treat `1m` as the canonical series.

- Derive `15m` and `1h` server-side via deterministic aggregation of the `1m` composite candles.
- Defer sub-minute candles (`15s`, `10s`) until there is a proven need; they cannot be derived from `1m` without losing information.

Reason: this keeps the indexer contract simple and prevents “polishing the browser POC” into a dead-end.

### 9.2 SSE reconnection strategy (implementation guidance)

If using SSE for live updates:

- Prefer native browser `EventSource` reconnection.
- On reconnect, the client should call `GET /abacus/v0/latest` to resynchronize the current forming candle.
- Consider including a monotonic `sequence` number on each SSE event so the UI can detect missed events.

### 9.3 Gap detection and QA endpoints

In ECS, gaps should be persisted and surfaced:

- Candle payload flags: `is_gap`, `is_backfilled`
- Optional QA endpoint: `GET /abacus/v0/gaps?asset=BTC&from=&to=`

### 9.4 Clock drift handling (production consideration)

The browser POC uses local receipt timestamps for telemetry, but production must be more explicit:

- Use exchange-reported timestamps for event time.
- Ensure ECS nodes are NTP-synced.
- Document expected per-venue latency bounds.

### 9.5 Venue weighting (future consideration)

Median is the correct v0 default. If weighting is introduced later, do it in ECS (not in the browser) and prefer liquidity/volume measures that are robust to manipulation.