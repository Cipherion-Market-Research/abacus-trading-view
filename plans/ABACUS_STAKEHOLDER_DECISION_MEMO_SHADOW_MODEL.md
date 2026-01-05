# Stakeholder Decision Memo — Abacus Reforecast Refactor (Shadow Model)

Date: 2025-12-15  
Purpose: Provide a decision-ready proposal to address later-horizon out-of-range behavior and “several thousand dollars” swings, grounded in production code and production data findings.

This memo is based on the unified assessment in:
- [`plans/ABACUS_STACK_REVIEW_DIAGNOSIS_AND_PLAN.md`](plans/ABACUS_STACK_REVIEW_DIAGNOSIS_AND_PLAN.md:1)

---

## 1) Decision Requested

Approve a refactor that changes **reforecast behavior** while keeping **baseline initialization** intact:

### Primary Decision
Adopt a **Shadow Model** for reforecasting:
- Baseline continues to run Blocks 1/2/3 to initialize a full 24-hour cycle.
- Reforecast stops re-running Block 2/3 “by identity”.
- Reforecast computes predictions for each remaining horizon using a **single Block 1-style direct formula** scaled by **remaining time-to-settlement** (now → horizon_end_ts).

Rollout: Shadow (parallel) first, then promote to primary after evaluation.

---

## 2) Why We Need This (Plain Language)

We currently use different “model settings” depending on which block a horizon belongs to (Block 1, 2, or 3). During reforecasting, that block label stays the same even when the horizon is now much closer.

Example:
- A Block 3 horizon may be only 2 hours away near the end of the cycle.
- It should behave like a 2-hour prediction, but today it still uses Block 3 scaling.

This is the “wrong telescope” problem described in:
- [`docs/investigation/CROSS_FUNCTIONAL_PRESENTATION.md`](docs/investigation/CROSS_FUNCTIONAL_PRESENTATION.md:10)

---

## 3) Evidence (Code-Backed)

### 3.1 The reforecast worker currently runs Blocks 1 → 2 → 3 each time
- [`abacus/ems/workers/reforecast_worker.py`](abacus/ems/workers/reforecast_worker.py:832)

### 3.2 The long-horizon blocks use fixed, non-monotonic constants and exponentials
- Block 2 constants: [`abacus/ems/modules/prediction/block2_continuation.py`](abacus/ems/modules/prediction/block2_continuation.py:42)
- Block 3 constants: [`abacus/ems/modules/prediction/block3_persistency.py`](abacus/ems/modules/prediction/block3_persistency.py:33)
- Block 2 asymmetry (high/low use different time scaling):
  - [`abacus/ems/modules/prediction/block2_continuation.py`](abacus/ems/modules/prediction/block2_continuation.py:249)
  - [`abacus/ems/modules/prediction/block2_continuation.py`](abacus/ems/modules/prediction/block2_continuation.py:267)

### 3.3 Reforecast input integrity has an avoidable weakness for periodic CEX jobs
Periodic CEX reforecasts can include a partial current-minute candle due to end-time semantics:
- [`abacus/ems/providers/ccxt_ohlcv_provider.py`](abacus/ems/providers/ccxt_ohlcv_provider.py:139)

This is not the root cause of large deviations, but it is a correctness risk and increases noise.

---

## 4) What Changes With the Shadow Model (Conceptual)

Baseline (unchanged):
- Create horizons for the next 24 hours.
- Run Blocks 1/2/3 to initialize predictions for all 15 horizons.

Reforecast (changed):
- For every unsettled horizon, compute:
  - remaining_time = horizon_end_ts - now
  - choose a time-scale based on remaining_time (not block membership)
  - run a single direct formula (Block 1 style) using fresh OHLCV

Key principle:
- A horizon 2 hours away should be predicted with the same scaling regardless of whether it is “Block 1” or “Block 3”.

---

## 5) Risks and Mitigations

### Risk A: Algorithm change could regress baseline behavior
Mitigation:
- Shadow mode rollout (parallel predictions) first; baseline remains unchanged.

### Risk B: Reforecast still depends on stable inputs
Mitigation:
- Standardize stabilization (avoid partial candles) for periodic CEX reforecasts.

### Risk C: Stakeholders want “in-range settlements,” not just lower swing
Mitigation:
- Define acceptance metrics focused on settlement coverage (see below), not only variance/swing.

---

## 6) Acceptance Metrics (What “Success” Means)

We will evaluate on production-like historical data (backtest against settled horizons):

1) **In-range settlement rate** by block and by hours-before-settlement  
   Target: materially higher for later horizons near settlement (0–2 hours remaining).

2) **Range width reasonableness**  
   Bands should not “reset narrower” across block boundaries.

3) **Center alignment** (hm_average vs actual/spot as we approach settlement)  
   Reforecast should continue to improve center alignment; no regression vs current.

4) **Prediction stability** (intra-cycle swing)  
   Reforecast-to-reforecast swings should be reduced, especially for horizons close to settlement.

---

## 7) Rollout Plan (Shadow → Promote)

1) Implement shadow output alongside current reforecast predictions (separate version tag or payload marker).
2) Run for a defined validation period and compare metrics.
3) Promote shadow model to primary reforecast if metrics meet thresholds; retain rollback path.

---

## 8) Secondary Follow-Up (Not Required for Initial Approval)

### Structural repair of Block 2/3
Even with Block 1-style reforecasting, we recommend fixing:
- Block 2 asymmetry and non-monotonic constants
to improve baseline correctness and make the model family internally coherent.

This is described in:
- [`plans/ABACUS_STACK_REVIEW_DIAGNOSIS_AND_PLAN.md`](plans/ABACUS_STACK_REVIEW_DIAGNOSIS_AND_PLAN.md:1)

---

## 9) Explicit Stakeholder Approvals Needed

1) Approve the Shadow Model approach for reforecasting (baseline unchanged).
2) Approve the evaluation criteria and success thresholds.
3) Approve the rollout method (shadow parallel run before promotion).
