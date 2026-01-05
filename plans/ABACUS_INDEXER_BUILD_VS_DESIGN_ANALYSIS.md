# Abacus Indexer: Build vs Design Analysis

**Date**: 2026-01-02 (Updated with v0.1.18 security release)
**Version**: v0.1.18
**Status**: Production-Viable for Type B Contract (P0 Security Complete)

---

## Executive Summary

The Abacus Indexer v0.1.17 is **production-deployed** and **viable for the Type B forecasting contract** (fixed-length dataset + integrity gating). The remaining work is dominated by (a) venue expansion and (b) production hardening/observability.

### Current State
- **API Surface**: Complete (8 GET + 1 POST endpoints)
- **Venues**: 2 of 5 implemented (Binance, Coinbase)
- **Backfill**: 1 of 4 fetchers implemented, gated by `BACKFILL_FETCHERS_IMPLEMENTED`
- **Infrastructure**: Core complete + auth, monitoring missing

### Critical Path to Full Design
1. ~~**P0**: WAF protection on `/v0/backfill` (security)~~ ✅ **COMPLETE (v0.1.18)**
2. **P1**: Kraken connector (achieves spot preferred_quorum=3)
3. **P1**: OKX connector (unlocks perp quorum + basis)
4. **P1**: Metrics + alarms (observability)
5. **P1/P2**: Remaining backfill fetchers
6. **P2**: Bybit connector + threshold recalibration

---

## I. API Endpoint Analysis

### Complete (8 GET + 1 POST)

The API surface is **fully implemented**. Remaining gaps are quality-of-service, not missing endpoints.

| Endpoint | Type | Status | Notes |
|----------|------|--------|-------|
| `GET /v0/latest` | Read | ✅ COMPLETE | Current prices + last completed bars |
| `GET /v0/candles` | Read | ✅ COMPLETE | Historical composite candles |
| `GET /v0/telemetry` | Read | ✅ COMPLETE | Per-venue connection state |
| `GET /v0/stream` | Read | ✅ COMPLETE | SSE for price + telemetry (bar events = UX optimization) |
| `GET /v0/venue-candles` | Read | ✅ COMPLETE | Per-venue traceability |
| `GET /v0/gaps` | Read | ✅ COMPLETE | Gap detection |
| `GET /v0/integrity` | Read | ✅ COMPLETE | Type B tier classification |
| `GET /v0/dataset/candles` | Read | ✅ COMPLETE | Fixed-length forecasting interface |
| `POST /v0/backfill` | Mutation | ✅ PROTECTED | X-Admin-Key required (v0.1.18) |

### SSE Bar Completion Events
**Status**: Not implemented (poll-driven via `/latest` and `/candles`)
**Impact**: Latency/UX optimization, not correctness
**Priority**: P2 (Enhancement)

Per the `/v0/stream` docstring: SSE is for **price + telemetry** updates. Bar completion can be derived from price cadence or polled.

---

## II. Venue Connector Analysis

### Implemented (2/5 = 40%)

| Venue | Spot | Perp | Connector | Backfill Fetcher | Status |
|-------|------|------|-----------|------------------|--------|
| **Binance** | ✅ | ✅ | ✅ | ✅ | COMPLETE |
| **Coinbase** | ✅ | N/A | ✅ | ⚠️ (realtime-only) | COMPLETE |
| **Kraken** | ❌ | N/A | ❌ | ❌ | NOT STARTED |
| **OKX** | ❌ | ❌ | ❌ | ❌ | NOT STARTED |
| **Bybit** | N/A | ❌ | ❌ | ❌ | NOT STARTED |

### Current Production Configuration
```
SPOT_VENUES=binance,coinbase     # 2 venues (min_quorum=2 ✓)
PERP_VENUES=binance              # 1 venue (below min_quorum)
PREFERRED_QUORUM=3               # Forward-looking configuration
```

### Impact of Missing Venues

**Spot Composite**:
- Always `degraded=true` (2 venues < preferred_quorum=3)
- This is **acceptable** because forecasting gating uses `quality_degraded` (venues excluded from composite), not `degraded` (below preferred quorum)
- Implemented in `CompositeBarRepository.get_integrity_stats()`

**Perp Composite**:
- **Below min_quorum** (1 venue < min_quorum=2)
- Does not meet v0 composite contract until OKX/Bybit are live
- Effectively unusable as a *composite* until venue expansion

---

## III. Backfill Fetcher Analysis

### Implemented (1/4 = 25%)

| Venue | Fetcher | Pagination | Time-Range | Status |
|-------|---------|------------|------------|--------|
| **Binance** | `_fetch_binance_trades()` | ✅ fromId | ✅ startTime/endTime | COMPLETE |
| **Kraken** | ❌ | - | - | NOT STARTED |
| **OKX** | ❌ | - | - | NOT STARTED |
| **Bybit** | ❌ | - | - | NOT STARTED |

### Safety Invariant (v0.1.17)

Backfill venues are now **gated by implemented fetchers**:

```python
# From constants.py
BACKFILL_FETCHERS_IMPLEMENTED = {VenueId.BINANCE}

def get_backfill_venues(market_type):
    enabled = get_enabled_venues(market_type)
    return [v for v in enabled if v in BACKFILL_VENUES and v in BACKFILL_FETCHERS_IMPLEMENTED]
```

This gate ensures v0.1.17 is **safe to operate** even though `ENABLED_SPOT_VENUES` includes venues not yet connected in production (Kraken, OKX).

### Coinbase Exclusion (Approved - Option A)
Per `COINBASE_BACKFILL_ARCHITECTURE_DECISION.md`:
- Coinbase is **REALTIME-only** (no historical time-range API)
- Backfilled bars mark Coinbase as `BACKFILL_UNAVAILABLE`
- This is intentional architecture, not a limitation

---

## IV. Infrastructure Analysis

### Implemented

| Component | Status | Notes |
|-----------|--------|-------|
| Docker container | ✅ | Multi-stage build, health check |
| ECS Fargate deployment | ✅ | Task definition v18 |
| PostgreSQL persistence | ✅ | Composite + venue bar storage |
| Database retention | ✅ | Configurable (default 14 days) |
| Configuration management | ✅ | Pydantic settings |
| Health endpoints | ✅ | /health, /liveness, /readiness |

### Missing

| Component | Priority | Impact |
|-----------|----------|--------|
| ~~**WAF on /v0/backfill**~~ | ~~P0 CRITICAL~~ | ✅ **COMPLETE** - X-Admin-Key auth (v0.1.18) |
| **Prometheus metrics** | P1 HIGH | No operator-grade observability |
| **CloudWatch alarms** | P1 HIGH | No alerting for gap growth, reconnect thrash |
| **Distributed tracing** | P2 MEDIUM | Debugging difficulty |

---

## V. Type B Acceptance Criteria Analysis

### Criteria Status

| Criterion | Requirement | Current Status |
|-----------|-------------|----------------|
| 24h window = 1440 bars | Exact count | ✅ PASSING |
| Explicit gap bars | Not silent omission | ✅ PASSING |
| Buy/sell volume invariant | buy + sell = total | ✅ PASSING |
| Integrity tier classification | Tier 1/2/3 | ✅ PASSING |
| Fixed-length dataset | /v0/dataset/candles | ✅ PASSING |
| Spot ≥95% uptime | Type A soak | ✅ PASSING (v0.1.16 validated) |
| Backfill from Binance | Gap repair | ✅ PASSING |
| Backfill from Kraken/OKX | Gap repair | ❌ NOT IMPLEMENTED |

### Gating Logic Implementation
```python
# From routes/v0.py - uses quality_degraded, not degraded
Tier 1: gaps ≤ 5 AND quality_degraded ≤ 60 → "PROCEED"
Tier 2: gaps ≤ 30 AND quality_degraded ≤ 180 → "PROCEED_WITH_CAUTION"
Tier 3: Otherwise → "BACKFILL_REQUIRED"
```

**Important**: Forecasting gating uses `quality_degraded` (count of bars with excluded venues), not `degraded` (below preferred quorum). This distinction is critical because with only 2 spot venues, all bars are `degraded=true` but may still be `quality_degraded=false`.

---

## VI. Frozen Contract Compliance

### Fully Compliant

| Specification | Status |
|--------------|--------|
| Assets: BTC, ETH only | ✅ |
| Timeframe: 1m canonical | ✅ |
| min_quorum = 2 | ✅ |
| preferred_quorum = 3 | ✅ |
| OUTLIER_THRESHOLD_BPS = 100 | ✅ |
| Exclusion order: DISCONNECTED → STALE → OUTLIER | ✅ |
| Stale thresholds per venue | ✅ |
| CompositeBar schema | ✅ |
| ExcludeReason enum | ✅ (including BACKFILL_UNAVAILABLE) |
| Spot ≠ Perp separation | ✅ |
| is_backfilled monotonic | ✅ |
| Backfill gating by implemented fetchers | ✅ (v0.1.17) |

### Partially Compliant (Venue Coverage)

| Specification | Status | Gap |
|--------------|--------|-----|
| Spot venues: Binance, Coinbase, Kraken, OKX | ⚠️ | Missing Kraken, OKX connectors |
| Perp venues: Binance, OKX, Bybit | ⚠️ | Missing OKX, Bybit connectors |
| Backfill priority: Binance > Kraken > OKX | ⚠️ | Only Binance implemented |

---

## VII. Risk Assessment

### Critical Risks (P0)

1. ~~**Unprotected Backfill Endpoint**~~ ✅ **RESOLVED (v0.1.18)**
   - `/v0/backfill` now requires `X-Admin-Key` header
   - Returns 401 if missing, 403 if invalid
   - Key stored in AWS SSM Parameter Store (SecureString)

### High Risks (P1)

2. **Limited Backfill Coverage**
   - Only Binance fetcher implemented
   - If Binance REST API fails, no fallback
   - **Mitigation**: Implement Kraken/OKX fetchers

3. **No Operator-Grade Alerting**
   - No visibility into gap growth, reconnect thrash, DB write failures
   - **Mitigation**: Add Prometheus metrics + CloudWatch alarms

### Medium Risks (P2)

4. **Perp Below Min Quorum**
   - Binance-only for perp = below min_quorum
   - Does not meet v0 composite contract
   - **Mitigation**: Add OKX/Bybit perp connectors

5. **Spot Always Degraded (UI Signal Only)**
   - 2 venues < preferred_quorum=3
   - All spot bars marked `degraded=true`
   - **Note**: Acceptable because forecasting uses `quality_degraded`
   - **Mitigation**: Add Kraken connector (achieves 3 venues)

---

## VIII. Remaining Work Items

### Refined Priority Order (per POC team)

| Priority | Item | Description | Effort |
|----------|------|-------------|--------|
| ~~**P0**~~ | ~~WAF/Auth on backfill~~ | ~~Protect `/v0/backfill` from abuse~~ | ✅ **DONE** |
| **P1** | Kraken spot connector | Achieves preferred_quorum=3 for spot | 1d |
| **P1** | OKX spot+perp connector | Unlocks perp quorum; enables basis | 1.5d |
| **P1** | Metrics + Alarms | Minimal operator-grade observability | 4h |
| **P1/P2** | Kraken REST fetcher | Add to BACKFILL_FETCHERS_IMPLEMENTED | 4h |
| **P1/P2** | OKX REST fetcher | Add to BACKFILL_FETCHERS_IMPLEMENTED | 4h |
| **P2** | Bybit perp connector | 3rd perp venue, full coverage | 1d |
| **P2** | Bybit REST fetcher | Complete backfill coverage | 4h |
| **P2** | SSE bar completion | Latency/UX optimization | 2h |
| **After expansion** | Threshold recalibration | Adjust Tier thresholds | 2h |

---

## IX. Deployment Checklist

### Production-Viable (Current v0.1.17)
- [x] Core composite calculation
- [x] Binance + Coinbase connectors
- [x] Database persistence
- [x] Type B forecasting interface
- [x] Integrity tier gating (using quality_degraded)
- [x] Option A architecture (Coinbase realtime-only)
- [x] Backfill venue selection gating (BACKFILL_FETCHERS_IMPLEMENTED)

### Production Hardening (Required)
- [x] WAF protection on /v0/backfill ✅ (v0.1.18)
- [x] Admin authentication on backfill ✅ (X-Admin-Key)
- [ ] Prometheus metrics endpoint
- [ ] CloudWatch alarms defined

### Full Design (Target)
- [ ] Kraken connector (spot quorum → 3)
- [ ] OKX connector (spot + perp)
- [ ] Bybit connector (perp)
- [ ] All 4 backfill fetchers
- [ ] SSE bar completion events
- [ ] Threshold recalibration

---

## X. Summary

### What's Working
- Type B forecasting contract is satisfied
- Fixed-length datasets with explicit gaps
- Integrity tier gating is correct
- Backfill is safe (gated by implemented fetchers)
- Option A architecture is formalized

### What's Missing
- 3 venue connectors (Kraken, OKX, Bybit)
- 3 backfill fetchers (Kraken, OKX, Bybit)
- ~~WAF protection (P0 security issue)~~ ✅ **RESOLVED (v0.1.18)**
- Observability stack (Prometheus metrics, CloudWatch alarms)

### Bottom Line
v0.1.18 is **production-viable for Type B** with **P0 security complete**. Remaining work is venue expansion (Kraken, OKX, Bybit) and observability (Prometheus, CloudWatch).

---

## Appendix: File References

| Component | File Path |
|-----------|-----------|
| API Routes | `services/abacus_indexer/app/routes/v0.py` |
| Venue Constants | `services/abacus_indexer/core/constants.py` |
| Backfill Service | `services/abacus_indexer/backfill/service.py` |
| Binance Connector | `services/abacus_indexer/connectors/binance.py` |
| Coinbase Connector | `services/abacus_indexer/connectors/coinbase.py` |
| Composite Aggregator | `services/abacus_indexer/aggregator/composite_aggregator.py` |
| Types | `services/abacus_indexer/core/types.py` |
| Config | `services/abacus_indexer/app/config.py` |
| Auth (v0.1.18) | `services/abacus_indexer/app/routes/v0.py:verify_admin_key()` |
| Task Definition | `abacus-indexer-task-def.json` |
| Option A Decision | `plans/COINBASE_BACKFILL_ARCHITECTURE_DECISION.md` |
