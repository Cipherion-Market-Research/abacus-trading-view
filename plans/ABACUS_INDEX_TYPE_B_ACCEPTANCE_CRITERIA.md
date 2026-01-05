# Abacus Indexer Type B Acceptance Criteria (Forecasting-Dependent)

**Scope:** Defines the minimum correctness/contract requirements for forecasting consumers to depend on the Abacus Indexer **without** re-implementing data integrity handling.

**Primary endpoints in scope:**
- [`/indexer/v0/dataset/candles`](ciphex-predictions/services/abacus_indexer/app/routes/v0.py:1046)
- [`CompositeBarRepository.get_integrity_stats()`](ciphex-predictions/services/abacus_indexer/persistence/repository.py:770)
- [`/indexer/v0/backfill`](ciphex-predictions/services/abacus_indexer/app/routes/v0.py:1000) (admin/mutation)
- [`/indexer/v0/venue-candles`](ciphex-predictions/services/abacus_indexer/app/routes/v0.py:540) (traceability)

---

## 0) Definitions

### Canonical bar cadence
- **Unit:** 1-minute OHLCV bars.
- **Timestamping:** `time` is the **bar start** timestamp in unix seconds, floored to minute.
- **Windowing convention:** dataset window is **[start_time, end_time)** minute-aligned.

### Quorum vs Quality Degradation (frozen semantics)
- `degraded`: **below preferred quorum** (UI-facing continuity signal).
- `quality_degraded`: **exclusions occurred** (forecasting-facing quality signal), counted using `excluded_venues != []` in [`CompositeBarRepository.get_integrity_stats()`](ciphex-predictions/services/abacus_indexer/persistence/repository.py:770).

Rationale: avoids breaking the meaning of `degraded` while making Tier 1 achievable when only 2 venues exist.

### Gap candle
- `is_gap = true`
- `open/high/low/close = null`
- `volume = 0`, `buy_volume = 0`, `sell_volume = 0`
- Indicates **missing composite minute** (indexer down, DB gap, upstream outage) and must be treated as missing data by forecasting consumers.

---

## 1) Type B Dataset Contract (Forecasting Interface)

### Endpoint
- [`GET /indexer/v0/dataset/candles`](ciphex-predictions/services/abacus_indexer/app/routes/v0.py:1046)

### Acceptance Criteria
1. **Fixed-length output (shape guarantee)**
   - For any `lookback`, response contains **exactly `lookback` candles**.
   - Implemented via timestamp iteration and explicit gap synthesis in [`get_dataset_candles()`](ciphex-predictions/services/abacus_indexer/app/routes/v0.py:1115).

2. **Deterministic time alignment**
   - `end_time` must be minute-aligned (floor) and `start_time = end_time - lookback*60`.
   - Response candles’ `time` must equal `start_time + i*60` for i in [0..lookback-1].

3. **No duplicates / stable ordering**
   - Candles must be strictly increasing by `time` and unique.

4. **Gap candle semantics are canonical**
   - If a minute is missing in DB, synthesize a gap candle (Rule A).
   - Forecasting consumers must not need to infer missingness via list length.

5. **Integrity block is present and consistent with the window**
   - Integrity `window_start/window_end` must match the dataset candle window.
   - `expected_bars == lookback`.

6. **Buy/sell volumes are present (when available) and bounded**
   - For non-gap bars, `buy_volume + sell_volume` should be approximately `volume` (allowing for rounding) if both are populated.
   - Types are defined in [`Bar`](ciphex-predictions/services/abacus_indexer/core/types.py:150).

---

## 2) Type B Integrity Tiering Contract

### Computation
- [`CompositeBarRepository.get_integrity_stats()`](ciphex-predictions/services/abacus_indexer/persistence/repository.py:770)

### Acceptance Criteria
1. **Tier gating uses `total_gaps` and `quality_degraded`**
   - `quality_degraded` must not be derived from quorum (`degraded`) when the venue set can be < preferred quorum.

2. **Missing DB bars count as implicit gaps**
   - `missing_bars = expected_bars - actual_bars`.
   - `total_gaps = gaps + missing_bars`.

3. **Tier rules are explicit and stable**
   - Tier 1: `total_gaps <= 5` AND `quality_degraded <= 60`
   - Tier 2: `total_gaps <= 30` AND `quality_degraded <= 180`
   - Else Tier 3
   - These appear in [`CompositeBarRepository.get_integrity_stats()`](ciphex-predictions/services/abacus_indexer/persistence/repository.py:824).

4. **Recommendation mapping is stable**
   - Tier 1: `PROCEED`
   - Tier 2: `PROCEED_WITH_CAUTION`
   - Tier 3: `BACKFILL_REQUIRED`
   - Implemented in [`get_dataset_candles()`](ciphex-predictions/services/abacus_indexer/app/routes/v0.py:1151).

---

## 3) Backfill Contract (Correctness + Safety)

### Endpoint
- [`POST /indexer/v0/backfill`](ciphex-predictions/services/abacus_indexer/app/routes/v0.py:1000)

### Correctness Acceptance Criteria
1. **Binance pagination correctness**
   - Must not silently truncate high-trade minutes.
   - Pagination via `fromId` implemented in [`BackfillService._fetch_binance_trades()`](ciphex-predictions/services/abacus_indexer/backfill/service.py:307).

2. **Coinbase taker-side semantics**
   - Coinbase REST `side` must map to taker side as implemented in [`BackfillService._fetch_coinbase_trades()`](ciphex-predictions/services/abacus_indexer/backfill/service.py:391).

3. **Monotonic `is_backfilled` invariant**
   - Once repaired, composite bars must remain `is_backfilled=true`.
   - Backfill path explicitly sets `is_backfilled=True` in [`BackfillService._repair_gap()`](ciphex-predictions/services/abacus_indexer/backfill/service.py:250).

4. **Idempotency**
   - Re-running the same backfill window must not create duplicates, and must preserve monotonic backfilled state.

### Safety / Ops Acceptance Criteria
1. **Admin-only mutation**
   - `/v0/backfill` must not be generally exposed to public clients.
   - Enforce via WAF allowlist and/or auth token.
   - Use ALB domain only (no raw task IP dependency).

---

## 4) Venue Traceability Contract (Debug + Model Auditing)

### Endpoint
- [`GET /indexer/v0/venue-candles`](ciphex-predictions/services/abacus_indexer/app/routes/v0.py:540)

### Acceptance Criteria
1. **Inclusion fields are truthful**
   - Response must reflect persisted `included_in_composite` and `exclude_reason`, not hardcoded defaults.
   - Current handler uses the bar fields via `getattr(...)` in [`get_venue_candles()`](ciphex-predictions/services/abacus_indexer/app/routes/v0.py:617).

2. **Buy/sell fields reflect taker-side definitions**
   - Must align with the schema in [`Bar`](ciphex-predictions/services/abacus_indexer/core/types.py:150).

---

## 5) Open Risks (Still Relevant)

1. **Coinbase historical backfill limitation**
   - Current Coinbase backfill pulls last 1000 trades and filters locally in [`BackfillService._fetch_coinbase_trades()`](ciphex-predictions/services/abacus_indexer/backfill/service.py:391).
   - For older minutes, those trades may not be present in the last 1000; this can cause silent missing minutes.
   - Type B readiness requires either pagination support or switching to a Coinbase endpoint that supports cursoring by time.

2. **Retention enforcement scheduling**
   - Retention config exists in [`Settings.retention_days`](ciphex-predictions/services/abacus_indexer/app/config.py:49) but requires a concrete scheduling mechanism.

