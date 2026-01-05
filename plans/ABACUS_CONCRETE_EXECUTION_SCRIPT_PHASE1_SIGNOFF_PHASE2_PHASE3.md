# Abacus Concrete Execution Script: Phase 1 Sign-off + Phase 2 Shadow + Phase 3 Promotion

This document is the single source of truth to hand to the coding team. It replaces back-and-forth discussion with explicit deliverables, acceptance checks, and ADR scope.

Status snapshot (as of 2025-12-16):
- Phase 1.1 (reforecast stabilization + end-exclusive): COMPLETE per verification at abacus/ems/workers/reforecast_worker.py:269 and abacus/ems/providers/ccxt_ohlcv_provider.py:139
- Phase 1.2 (live-price stable horizon selection): COMPLETE per implementation in services/live_price_microservice/tasks/poller.py:182 and services/live_price_microservice/database.py:204
- Remaining work before Phase 2: Phase 1 Sign-off package (formerly called Phase 1.3)

---

## 0) Decision: What to do next

Do BOTH, in this order:

1) Complete Phase 1 Sign-off (release gate)
2) Write ADRs for Phase 2 and Phase 3 (implementation blueprint)
3) Implement Phase 2 shadow service and evaluation (no prod impact)
4) Execute Phase 3 promotion/rollback plan based on thresholds

Rationale:
- Investigation findings show the biggest modeling risk is algorithm/time-to-settlement mismatch, but you cannot validate a shadow model unless the current production system is measurable and stable.
- Phase 1 Sign-off is not a new algorithm; it is instrumentation + queries + pass/fail gates to prevent regressions and to create a reliable baseline for Phase 2 comparison.

---

## 1) Phase 1 Sign-off (was Phase 1.3): REQUIRED BEFORE PHASE 2

### 1.1 Deliverables (coding team)

#### D1 — One command sign-off script (local + CI runnable)
Create one of:
- Extend scripts/validate_live_price_phase2.py
- Or add scripts/validate_phase1_signoff.py

The script MUST:
- Run against the production DB (or staging DB) using DATABASE_URL
- Print a deterministic report with:
  - Summary table
  - PASS/FAIL per check
  - Raw counts (so reviewers can sanity-check)
- Exit code:
  - 0 if all checks PASS
  - 1 if any FAIL (optional: allow --informational to always exit 0)

Minimum report sections:
A) Live price surface correctness (Phase 1.2)
- Horizon selection:
  - Count of selection reasons (nearest_unsettled, fallback_most_recent_unsettled, not_found, query_error, db_unavailable)
  - Rate of not_found (should be low; threshold defined below)
- Prediction selection:
  - baseline vs reforecast selection rate (from metrics or DB query)
  - ADR fallback rate (no_reforecast)

B) Reforecast OHLCV integrity invariant (Phase 1.1)
- Prove reforecast jobs are using stabilized, end-exclusive windows:
  - window_end is minute_floor(reference_time) minus stabilization buffer
  - OHLCV candle timestamps are strictly less than window_end
- Prove periodic uses execution time NOW:
  - trigger_type=periodic uses execution_time, not horizon_end_ts

C) Range adjustment visibility (guardrail transparency)
- Block 2 range_adjusted and range_adjustment_reason distribution
  - especially ordering_correction rate

#### D2 — Ensure provenance is queryable (not only logs)
Requirement: the sign-off script must be able to query the provenance fields needed to validate Phase 1.1.
If provenance currently exists only in logs, persist it in prediction payloads or a stable DB column.

At minimum, persist fields per prediction:
- trigger_type (periodic | settlement)
- stabilization policy identifier
- stabilization buffer minutes
- window_start, window_end and semantics (end_exclusive)
- execution_time used (or reference_time)

Suggested location (already identified in the plan):
- abacus/ems/workers/reforecast_worker.py:899 (prediction persistence)

#### D3 — Document thresholds (explicit pass/fail)
Add thresholds inside the script output header (and/or in a small markdown section below).

---

## 2) Phase 1 Sign-off: Pass/Fail Thresholds (initial)

These are initial gates. If you want them informational-only at first, label them WARN instead of FAIL.

### 2.1 Live price surface (Phase 1.2)
- Selection reason not_found rate:
  - PASS if not_found <= 1% of live polls over a 24h window
  - WARN if 1% < not_found <= 5%
  - FAIL if not_found > 5%
- Baseline selection rate:
  - No hard fail initially (depends on reforecast coverage), but must be reported by asset and aggregated.
- ADR fallback reason no_reforecast:
  - No hard fail initially; must be reported and trended.

### 2.2 Reforecast integrity (Phase 1.1)
- End-exclusive correctness:
  - PASS if 100% of sampled periodic reforecasts have last_candle_unix_time < window_end_unix_time
  - FAIL if any sample violates the strict inequality
- Stabilization buffer correctness:
  - PASS if all sampled periodic reforecasts use stabilized window_end = minute_floor(execution_time) - buffer
  - FAIL if any sample ends at a non-minute boundary or uses current minute

### 2.3 Block 2 range adjustment (visibility)
- ordering_correction rate:
  - No fail threshold initially; MUST be reported and trended by asset + block + hours-before-settlement bucket.

---

## 3) Where Phase 1 Sign-off should live (concrete file anchors)

- Script: scripts/validate_live_price_phase2.py or scripts/validate_phase1_signoff.py
- Live price selection metrics are already in:
  - services/live_price_microservice/metrics.py (prediction selection, adr fallback, horizon selection)
- Provenance persistence:
  - abacus/ems/workers/reforecast_worker.py near prediction persistence (identified line around 899)
- Block 2 range adjustment fields:
  - abacus/ems/modules/prediction/block2_continuation.py around ordering correction (identified line around 274)

---

## 4) ADRs (to eliminate back-and-forth)

### ADR A — Phase 2 crypto-only shadow service (Option 2: TTS-aware reforecast)
Create: docs/ADR-0XX_PHASE2_TTS_SHADOW_REFORECAST.md

Must define:
1) Goal
- Validate time-to-settlement-aware prediction scaling without impacting baseline or current production reforecast output.

2) Non-goals
- No changes to baseline
- No replacement of current reforecast yet
- No user-facing changes yet

3) Service contract
- Service name: abacus-tts-shadow
- model_version: reforecast_tts_v1
- run_type: shadow_reforecast (or reuse reforecast with explicit model_version; decide and document)

4) Scheduling
- Settlement-triggered jobs for all unsettled horizons
- Periodic every 30 minutes for all unsettled horizons (crypto-only)
- Shares Phase 1.1 stabilization policy for OHLCV windows

5) Output requirements (provenance mandatory)
- Store:
  - model_version
  - generated_at
  - trigger_type
  - execution_time/reference_time
  - ohlcv_window_start/end with end-exclusive semantics
  - last candle timestamp used
  - range_adjusted fields if any

6) Evaluation plan
- Compare shadow vs current on identical horizons
- Bucket by remaining time to settlement: 0-1h, 1-2h, 2-4h, 4-8h, 8-12h, 12-24h
- Metrics:
  - hm_average error near settlement
  - swing stability (prediction deltas between successive reforecasts)
  - in-range rate (low <= actual <= high) by bucket
  - ordering correction rate visibility (especially Block 2)

7) Risk controls
- Shadow runs must not affect live price microservice selection
- Separate tables or explicit model_version filters to prevent accidental surfacing

### ADR B — Phase 3 promotion + rollback
Create: docs/ADR-0XX_PHASE3_PROMOTION_ROLLBACK.md

Must define:
1) Promotion mechanism
- Single switch:
  - either feature flag in live price selection layer
  - or view/query change to select model_version preferred order

2) Rollback mechanism
- One-switch rollback to restore current behavior immediately

3) Promotion thresholds
- Derived from Phase 2 evaluation output
- Must include:
  - no regression in Block 1 near settlement
  - improved stability for Block 3 swings
  - improved range calibration / in-range rate vs baseline/current
  - no increase in ordering correction anomalies

---

## 5) Concrete next actions for the coding team (ordered)

1) Implement Phase 1 Sign-off script (D1)
2) Persist/query provenance needed by script (D2)
3) Add Block 2 range adjustment reporting (D1 section C + D3)
4) Land a short runbook section describing how to run the sign-off and interpret it
5) Draft ADR A and ADR B
6) Start Phase 2 shadow service implementation

---

## 6) Mermaid: end-to-end execution flow

```mermaid
flowchart TD
  A[Phase 1.1 and Phase 1.2 code complete] --> B[Phase 1 Sign-off script and thresholds]
  B --> C[Phase 2 ADR and Phase 3 ADR approved]
  C --> D[Deploy abacus-tts-shadow on ECS]
  D --> E[Shadow vs current evaluation report]
  E --> F[Promotion switch with rollback]