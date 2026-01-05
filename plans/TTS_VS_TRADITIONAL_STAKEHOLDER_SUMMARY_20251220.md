# TTS-aware Shadow Reforecast vs Traditional Reforecast — Stakeholder Summary

**Date:** 2025-12-20  
**Scope:** CEX crypto only (BTC/USDT, ETH/USDT, ZEC/USDT)  
**Systems Compared:**
- **Traditional reforecast**: production `run_type='reforecast'`
- **TTS-aware shadow** (ADR-021 Stage A): `run_type='adhoc'` + payload markers `(is_shadow=true, model_version='reforecast_tts_v1')`

This is a cross-team summary intended for Engineering + Product + Stakeholders. It focuses on *what changed*, *why*, and *what early evidence says*.

---

## 1) What’s different between the models?

### Traditional model (current production)

Traditional reforecasting re-runs the existing block prediction modules (Block 1/2/3). Those modules are calibrated around **fixed time constants** (e.g., “24-hour constants” for Block 3), regardless of when the reforecast occurs.

Consequence (validated in investigation): a Block 3 horizon that is only **~2 hours** from settlement can still be computed using **24-hour-style scaling**, which causes exaggerated volatility / instability near settlement.

References:
- Problem framing: [`docs/investigation/CROSS_FUNCTIONAL_PRESENTATION.md`](docs/investigation/CROSS_FUNCTIONAL_PRESENTATION.md:8)
- Root cause math/scale: [`docs/investigation/REFORECAST_OHLCV_ALIGNMENT_FINDINGS.md`](docs/investigation/REFORECAST_OHLCV_ALIGNMENT_FINDINGS.md:265)

### TTS-aware model (ADR-021 shadow service)

The TTS-aware model replaces “fixed constants by block” with a **time-to-settlement mapping**.

**Core mapping (ADR-021 Stage A):**

`t_minutes = clamp(remaining_minutes, 5, 720)`

This is implemented in [`abacus/ems/modules/prediction/tts_predictor.py`](abacus/ems/modules/prediction/tts_predictor.py:163).

Interpretation:
- When settlement is close, use **short-horizon scaling** (smaller `t`)
- When settlement is far, allow `t` to increase but cap at 12 hours to prevent pathological amplification

Stage A constraints (by design, for clean attribution):
- Fixed candle count (N=5) to match production behavior
- No adaptive candle sizing and no outlier guardrail (those are Stage B)

Service overview: [`docs/ADR-021_TTS_SHADOW_REFORECAST.md`](docs/ADR-021_TTS_SHADOW_REFORECAST.md:120)

---

## 2) Safety & Isolation (no user impact)

The TTS service is deployed as a **shadow pipeline**:
- It writes `scoring_runs.run_type='adhoc'` (not `reforecast`)
- It tags prediction payloads with `is_shadow=true` and `model_version='reforecast_tts_v1'`
- Live price selection continues to use production reforecast (`run_type='reforecast'`), so shadow predictions are **not user-facing**

Deployment / operations record:
- [`infrastructure/ecs/TTS_SHADOW_DEPLOYMENT_SUMMARY_20251217.md`](infrastructure/ecs/TTS_SHADOW_DEPLOYMENT_SUMMARY_20251217.md:1)

---

## 3) Evidence-backed comparison (last ~2 baseline cycles, settled horizons)

### Method (important)

To avoid “peeking into the future”, we compare **the most recent prediction available *at or before settlement time*** for each horizon.

For each settled horizon (`horizon_metadata.status='settled'`) in the last ~2 baseline cycles per asset:
- Traditional metric: last `run_type='reforecast'` prediction where `prediction.created_at <= settled_at`
- Shadow metric: last `run_type='adhoc'` prediction with `(is_shadow=true, model_version='reforecast_tts_v1')` where `created_at <= settled_at`

Then we compute:
- **MAE** (absolute $ error) on `hm_average`
- **In-range rate** where `low_range <= actual_price <= high_range`
- **Shadow beats rate**: fraction of horizons where `shadow_abs_err < reforecast_abs_err`
- Average minutes between prediction timestamp and settlement timestamp

### Aggregate results (all 3 assets, horizons where both models had an as-of prediction)

| Group      | N horizons | Reforecast MAE | Shadow MAE | Shadow beats reforecast | Reforecast in-range | Shadow in-range |
|-----------:|-----------:|---------------:|-----------:|------------------------:|--------------------:|----------------:|
| Block 1    | 9          | 14.60          | 164.37     | 22.2%                   | 22.2%               | 11.1%           |
| Blocks 2–3 | 30         | 211.81         | 44.83      | 93.3%                   | 20.0%               | 26.7%           |

**Interpretation:**
- **Blocks 2–3:** Shadow is materially better on *center accuracy* (MAE) and beats traditional reforecast on **93%** of matched horizons.
- **Block 1:** Shadow is worse. This is expected: Block 1 already uses short-horizon scaling in the traditional model; TTS adds less value there and may be over/under-scaling or suffering from timing differences.

### Recency / trigger differences (why Block 1 comparison is noisy)

Shadow service is currently producing predictions much closer to settlement than traditional reforecast in many cases.

Across matched horizons:
- Block 1: traditional prediction is ~39.6 minutes before settlement vs shadow ~20.7 minutes.
- Blocks 2–3: traditional prediction is ~249.5 minutes before settlement vs shadow ~17.7 minutes.

This is a confounder for “model vs model” attribution (recency advantage). Next reporting iteration should compare *within the same time-to-settlement window* (see Next Steps).

---

## 4) Per-asset highlights (matched horizons, Blocks 2–3)

Matched-horizon results (where both models have as-of predictions):

| Asset    | Block | N | Reforecast MAE | Shadow MAE | Shadow beats rate | Reforecast in-range | Shadow in-range |
|----------|------:|--:|---------------:|-----------:|------------------:|--------------------:|----------------:|
| BTC/USDT | 2     | 5 | 664.67         | 130.16     | 80%               | 20%                 | 0%              |
| BTC/USDT | 3     | 5 | 474.26         | 115.68     | 100%              | 0%                  | 20%             |
| ETH/USDT | 2     | 5 | 39.17          | 11.91      | 100%              | 80%                 | 20%             |
| ETH/USDT | 3     | 5 | 67.30          | 5.81       | 100%              | 0%                  | 40%             |
| ZEC/USDT | 2     | 5 | 12.90          | 1.72       | 100%              | 20%                 | 60%             |
| ZEC/USDT | 3     | 5 | 12.56          | 3.69       | 80%               | 0%                  | 20%             |

**Key takeaways:**
- Center accuracy improvements on Blocks 2–3 appear consistent across assets.
- In-range rate is mixed and remains low overall; Stage A is not directly widening ranges. (Range calibration remains a separate concern raised in [`docs/investigation/PREDICTION_RANGE_ANALYSIS_STAKEHOLDER_REPORT.md`](docs/investigation/PREDICTION_RANGE_ANALYSIS_STAKEHOLDER_REPORT.md:11).)

---

## 5) What this means (decision framing)

### What the evidence supports now

1. **TTS-aware scaling is promising for Blocks 2–3 center accuracy.**
2. **Range calibration is still not solved** by Stage A; it was never intended to be.
3. **Block 1 should likely remain “traditional Block 1”** (or be explicitly handled) rather than using the same TTS approach.

### What’s still uncertain

Even after time-matching, the current evidence is **not a clean “TTS always wins” story**.

What we know now:
- The earlier “as-of settlement” results were confounded by recency.
- We addressed that by running **time-matched** comparisons at multiple checkpoints.

What remains uncertain:
- The **time-matched curve is mixed** (TTS is very strong at T-30m in this sample, but not consistently better at every earlier checkpoint).
- This could be due to small sample size, regime changes, or that the current `reforecast_tts_v1` mapping is only optimal near settlement.

---

## 3.1) Time-matched evaluation (Blocks 2–3 only)

Because both models persist full prediction histories (via [`predictions.created_at`](abacus/ems/models/prediction.py:1) and `horizon_metadata.settled_at`), we can compare them at the **same time-to-settlement** checkpoints without any service refactor.

**Method:** For each settled horizon in Blocks 2–3 and each checkpoint (**T-30/60/90/120/180/240m**), select the **latest prediction at-or-before** `settled_at - checkpoint` for each model, then compute MAE and in-range.

### Aggregate (BTC/ETH/ZEC combined, Blocks 2–3)

| Checkpoint | Matched horizons (both models) | Reforecast MAE | Shadow MAE | Shadow beats rate | Reforecast in-range | Shadow in-range |
|-----------:|-------------------------------:|---------------:|-----------:|------------------:|--------------------:|----------------:|
| T-30m      | 30                             | 213.70         | 68.54      | 83.3%             | 10.0%               | 20.0%           |
| T-60m      | 30                             | 211.67         | 206.37     | 60.0%             | 13.3%               | 13.3%           |
| T-90m      | 27                             | 198.72         | 285.19     | 37.0%             | 14.8%               | 0.0%            |
| T-120m     | 26                             | 206.17         | 377.94     | 38.5%             | 15.4%               | 23.1%           |
| T-180m     | 24                             | 462.06         | 242.36     | 75.0%             | 16.7%               | 8.3%            |
| T-240m     | 21                             | 418.61         | 1066.62    | 38.1%             | 14.3%               | 4.8%            |

**Interpretation (simple):**
- TTS shadow looks **very strong at T-30m** in this sample.
- Results are **mixed** at other checkpoints (wins at T-60m and T-180m; loses at T-90m, T-120m, T-240m).
- In-range remains low for both; Stage A is not a range-calibration fix.

**Important:** These are early numbers from a small window (last ~2 cycles per asset) and should be treated as directional, not final.

---

## 6) Next steps (tighten the evaluation)

1. **Time-matched evaluation (DONE for an initial curve; repeat + enrich):**
   - ✅ Completed for Blocks 2–3 at **T-30/60/90/120/180/240m** (see Section 3.1).
   - Next: rerun daily as more horizons settle and add:
     - per-asset tables (BTC vs ETH vs ZEC)
     - per-block tables (Block 2 vs Block 3)
     - median / P80 error (not just mean)
     - confidence bands (or bootstrap intervals) once sample size is larger

2. **Coverage analysis (still relevant):**
   - For each checkpoint (T-30…T-240), report coverage for both models.
   - Identify whether coverage gaps are due to:
     - traditional scheduler cadence/eligibility,
     - settlement-trigger behavior,
     - or data availability.
   - Decide if we want *production parity* (ensure we always have a prediction at each checkpoint) regardless of which model wins.

3. **Decision framing: pick a policy that matches the curve (new):**
   - Current time-matched curve is **mixed** (strong at T-30m, mixed elsewhere).
   - Candidate production policy (if it holds with more data):
     - keep traditional for earlier windows
     - switch to TTS only inside a “near-settlement window” (e.g., last 30–60m)
   - Alternatively: tune the mapping and increment `model_version` (e.g., `reforecast_tts_v2`) to improve earlier checkpoints.

4. **Stage B gating (still relevant):**
   - Only after Stage A shows non-regression for Blocks 2–3 under time-matched evaluation with a larger sample.
   - Stage B candidates remain: adaptive candle count and outlier guardrail (ADR-021).

5. **Range calibration remains a separate track (still relevant):**
   - Stage A TTS is primarily a *center/scale* fix.
   - The “bands too narrow” issue from [`PREDICTION_RANGE_ANALYSIS_STAKEHOLDER_REPORT.md`](docs/investigation/PREDICTION_RANGE_ANALYSIS_STAKEHOLDER_REPORT.md:11) still needs a dedicated solution.

---

## Appendix: Implementation references

- ADR-021 spec: [`docs/ADR-021_TTS_SHADOW_REFORECAST.md`](docs/ADR-021_TTS_SHADOW_REFORECAST.md:120)
- TTS mapping code: [`TTSPredictor.clamp()`](abacus/ems/modules/prediction/tts_predictor.py:163)
- Shadow worker provenance markers: [`tts_shadow_worker.py` params payload](abacus/ems/workers/tts_shadow_worker.py:402)
