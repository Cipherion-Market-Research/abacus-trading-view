# Abacus Indexer: Build vs Design Analysis

**Date**: 2026-01-03 (Updated with v0.1.22 observability)
**Version**: v0.1.22
**Status**: Production-Ready for UI and Forecasting Dependency

---

## Executive Summary

The Abacus Indexer v0.1.22 is **production-ready** for downstream integration. All venues are connected, observability is complete, and alerting is active.

### Current State
- **API Surface**: Complete (9 GET + 1 POST endpoints, including `/metrics`)
- **Venues**: 5 of 5 implemented (Binance, Coinbase, Kraken, OKX, Bybit)
- **Backfill**: 4 of 4 fetchers implemented (Bybit is recent-only, see Section III)
- **Observability**: Complete (Prometheus metrics + CloudWatch alarms)
- **Infrastructure**: Production-ready

### Critical Path to Full Design
1. ~~**P0**: Admin auth on `/v0/backfill` (security)~~ ✅ **COMPLETE (v0.1.18)**
2. ~~**P1**: Kraken connector (achieves spot preferred_quorum=3)~~ ✅ **COMPLETE (v0.1.19)**
3. ~~**P1**: OKX connector (unlocks perp quorum + basis)~~ ✅ **COMPLETE (v0.1.20)**
4. ~~**P2**: Bybit connector + threshold recalibration~~ ✅ **COMPLETE (v0.1.21)**
5. ~~**P1**: Metrics + alarms (observability)~~ ✅ **COMPLETE (v0.1.22)**
6. **P2**: SSE bar completion events
7. **P2**: Exclusion reason metrics (threshold tuning)

---

## I. API Endpoint Analysis

### Complete (9 GET + 1 POST)

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
| `GET /metrics` | Read | ✅ COMPLETE | Prometheus metrics (v0.1.22) |
| `POST /v0/backfill` | Mutation | ✅ PROTECTED | X-Admin-Key required (v0.1.18) |

### SSE Bar Completion Events
**Status**: Not implemented (poll-driven via `/latest` and `/candles`)
**Impact**: Latency/UX optimization, not correctness
**Priority**: P2 (Enhancement)

Per the `/v0/stream` docstring: SSE is for **price + telemetry** updates. Bar completion can be derived from price cadence or polled.

---

## II. Venue Connector Analysis

### Implemented (5/5 = 100%)

| Venue | Spot | Perp | Connector | Backfill Fetcher | Status |
|-------|------|------|-----------|------------------|--------|
| **Binance** | ✅ | ✅ | ✅ | ✅ Full historical | COMPLETE |
| **Coinbase** | ✅ | N/A | ✅ | ⚠️ Realtime-only | COMPLETE |
| **Kraken** | ✅ | N/A | ✅ | ✅ Full historical | COMPLETE (v0.1.19) |
| **OKX** | ✅ | ✅ | ✅ | ✅ Full historical | COMPLETE (v0.1.20) |
| **Bybit** | N/A | ✅ | ✅ | ⚠️ Recent-only | COMPLETE (v0.1.21) |

### Current Production Configuration
```
SPOT_VENUES=binance,coinbase,kraken,okx    # 4 venues (preferred_quorum=3 ✓)
PERP_VENUES=binance,okx,bybit              # 3 venues (preferred_quorum=3 ✓)
PREFERRED_QUORUM=3
```

### Venue Coverage Status

**Spot Composite**:
- **4 venues available** - exceeds preferred_quorum=3
- `degraded=false` when 3+ venues contributing
- Full coverage with Kraken + OKX expansion

**Perp Composite**:
- **3 venues available** - meets preferred_quorum=3
- `degraded=false` when all 3 venues contributing
- Full coverage with OKX + Bybit expansion

---

## III. Backfill Fetcher Analysis

### Implemented (4/4 = 100%)

| Venue | Fetcher | Pagination | Time-Range | Coverage | Status |
|-------|---------|------------|------------|----------|--------|
| **Binance** | `_fetch_binance_trades()` | ✅ fromId | ✅ startTime/endTime | Full historical | COMPLETE |
| **Kraken** | `_fetch_kraken_trades()` | ✅ since (ns) | ✅ since param | Full historical | COMPLETE (v0.1.19) |
| **OKX** | `_fetch_okx_trades()` | ✅ after cursor | ✅ before/after | Full historical | COMPLETE (v0.1.20) |
| **Bybit** | `_fetch_bybit_trades()` | ❌ None | ❌ None | **Recent-only** | COMPLETE (v0.1.21) |

### Bybit Backfill Limitation ⚠️

The Bybit backfill fetcher uses the **public recent-trade endpoint** which:
- Returns only the most recent ~1000 trades
- Has no time-range query parameters
- Has no cursor pagination for historical data

**Implications**:
- ✅ Suitable for repairing **very recent gaps** (within last few minutes)
- ❌ NOT suitable for arbitrary historical window recovery
- For full historical backfill, Bybit would require authenticated access to `trading-records` endpoint (not implemented)

This limitation is acceptable because:
1. Bybit is only used for perp (3rd venue, redundancy with Binance + OKX)
2. Binance and OKX have full historical coverage for perp
3. Recent-only is sufficient for short reconnection gaps

### Safety Invariant

Backfill venues are **gated by implemented fetchers**:

```python
# From constants.py
BACKFILL_FETCHERS_IMPLEMENTED = {
    VenueId.BINANCE,   # Full historical
    VenueId.KRAKEN,    # Full historical
    VenueId.OKX,       # Full historical
    VenueId.BYBIT,     # Recent-only
}
```

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

### Observability (Complete)

| Component | Status | Notes |
|-----------|--------|-------|
| ~~**Admin auth on /v0/backfill**~~ | ✅ **COMPLETE** | X-Admin-Key via SSM (v0.1.18) |
| **Prometheus metrics** | ✅ **COMPLETE** | `/metrics` endpoint with 12+ metrics (v0.1.22) |
| **CloudWatch alarms** | ✅ **COMPLETE** | 7 alarms active (gap rate, degraded, reconnects, DB errors) |
| **Distributed tracing** | P2 MEDIUM | Future enhancement |

### Active CloudWatch Alarms (v0.1.22)

| Alarm | Threshold | Status |
|-------|-----------|--------|
| `abacus-indexer-high-gap-rate` | >5 gaps/5min | OK |
| `abacus-indexer-high-degraded-rate` | >10 degraded/5min | OK |
| `abacus-indexer-connector-instability` | >3 reconnects/5min | OK |
| `abacus-indexer-database-errors` | any errors | OK |
| `abacus-indexer-high-latency` | p99 >500ms | OK |
| `abacus-indexer-unhealthy-hosts` | unhealthy targets | OK |
| `abacus-indexer-no-running-tasks` | task count <1 | OK |

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
| Backfill from Kraken/OKX | Gap repair | ✅ PASSING (v0.1.19/v0.1.20) |
| Backfill from Bybit | Gap repair (recent) | ✅ PASSING (v0.1.21, recent-only) |

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

### Fully Compliant (Venue Coverage)

| Specification | Status | Notes |
|--------------|--------|-------|
| Spot venues: Binance, Coinbase, Kraken, OKX | ✅ | All 4 venues implemented |
| Perp venues: Binance, OKX, Bybit | ✅ | All 3 venues implemented |
| Backfill priority: Binance > Kraken > OKX | ✅ | All fetchers implemented (Bybit recent-only) |

---

## VII. Risk Assessment

### Critical Risks (P0)

1. ~~**Unprotected Backfill Endpoint**~~ ✅ **RESOLVED (v0.1.18)**
   - `/v0/backfill` now requires `X-Admin-Key` header
   - Returns 401 if missing, 403 if invalid
   - Key stored in AWS SSM Parameter Store (SecureString)

### High Risks (P1)

2. ~~**Limited Backfill Coverage**~~ ✅ **RESOLVED (v0.1.21)**
   - All 4 backfill fetchers implemented
   - Binance, Kraken, OKX have full historical coverage
   - Bybit has recent-only coverage (acceptable for 3rd perp venue)

3. **No Operator-Grade Alerting**
   - No visibility into gap growth, reconnect thrash, DB write failures
   - **Mitigation**: Add Prometheus metrics + CloudWatch alarms
   - **Status**: PENDING

### Medium Risks (P2)

4. ~~**Perp Below Min Quorum**~~ ✅ **RESOLVED (v0.1.21)**
   - 3 perp venues now available (Binance, OKX, Bybit)
   - Meets preferred_quorum=3

5. ~~**Spot Always Degraded**~~ ✅ **RESOLVED (v0.1.20)**
   - 4 spot venues now available (Binance, Coinbase, Kraken, OKX)
   - Exceeds preferred_quorum=3

6. **Bybit Backfill Recent-Only**
   - Bybit fetcher only retrieves ~1000 most recent trades
   - Cannot recover from extended outages via Bybit alone
   - **Mitigation**: Bybit is 3rd perp venue; Binance + OKX provide full historical coverage

---

## VIII. Remaining Work Items

### Completed Items

| Priority | Item | Description | Status |
|----------|------|-------------|--------|
| ~~**P0**~~ | ~~Admin API key auth~~ | ~~Protect `/v0/backfill` via X-Admin-Key~~ | ✅ v0.1.18 |
| ~~**P1**~~ | ~~Kraken spot connector~~ | ~~Achieves preferred_quorum=3 for spot~~ | ✅ v0.1.19 |
| ~~**P1**~~ | ~~Kraken REST fetcher~~ | ~~Full historical backfill~~ | ✅ v0.1.19 |
| ~~**P1**~~ | ~~OKX spot+perp connector~~ | ~~Unlocks perp quorum~~ | ✅ v0.1.20 |
| ~~**P1**~~ | ~~OKX REST fetcher~~ | ~~Full historical backfill~~ | ✅ v0.1.20 |
| ~~**P2**~~ | ~~Bybit perp connector~~ | ~~3rd perp venue~~ | ✅ v0.1.21 |
| ~~**P2**~~ | ~~Bybit REST fetcher~~ | ~~Recent-only backfill~~ | ✅ v0.1.21 |

### Remaining Items

| Priority | Item | Description | Effort |
|----------|------|-------------|--------|
| ~~**P1**~~ | ~~Metrics + Alarms~~ | ~~Prometheus endpoint + CloudWatch alarms~~ | ✅ v0.1.22 |
| **P2** | SSE bar completion | Latency/UX optimization for bar events | 2h |
| **P2** | Threshold recalibration | Adjust Tier thresholds post-expansion | 2h |
| **P2** | Exclusion reason metrics | Per-venue exclusion counters for tuning | 2h |

---

## IX. Deployment Checklist

### Core Infrastructure (Complete)
- [x] Core composite calculation
- [x] Database persistence
- [x] Type B forecasting interface
- [x] Integrity tier gating (using quality_degraded)
- [x] Option A architecture (Coinbase realtime-only)
- [x] Backfill venue selection gating (BACKFILL_FETCHERS_IMPLEMENTED)
- [x] Admin API key auth on /v0/backfill ✅ (v0.1.18)

### Venue Coverage (Complete)
- [x] Binance connector (spot + perp) ✅
- [x] Coinbase connector (spot) ✅
- [x] Kraken connector (spot) ✅ (v0.1.19)
- [x] OKX connector (spot + perp) ✅ (v0.1.20)
- [x] Bybit connector (perp) ✅ (v0.1.21)

### Backfill Fetchers (Complete)
- [x] Binance fetcher (full historical) ✅
- [x] Kraken fetcher (full historical) ✅ (v0.1.19)
- [x] OKX fetcher (full historical) ✅ (v0.1.20)
- [x] Bybit fetcher (recent-only) ✅ (v0.1.21)

### Observability (Complete)
- [x] Prometheus metrics endpoint ✅ (v0.1.22)
- [x] CloudWatch alarms defined ✅ (v0.1.22)
- [ ] (Optional) AWS WAF allowlist for defense-in-depth
- [ ] Exclusion reason metrics (P2 - threshold tuning)

### UX Enhancements (Pending)
- [ ] SSE bar completion events
- [ ] Threshold recalibration post-expansion

---

## X. Summary

### What's Complete (v0.1.22)
- Type B forecasting contract is satisfied
- Fixed-length datasets with explicit gaps
- Integrity tier gating is correct
- Backfill is safe (gated by implemented fetchers)
- Option A architecture is formalized
- **All 5 venue connectors implemented** (Binance, Coinbase, Kraken, OKX, Bybit)
- **All 4 backfill fetchers implemented** (Bybit is recent-only)
- Admin API key auth on `/v0/backfill`
- **Prometheus metrics endpoint** (`/metrics` with 12+ metrics)
- **CloudWatch alarms** (7 alarms for gap rate, degraded, reconnects, DB errors)

### What's Remaining
- SSE bar completion events (P2 - UX enhancement)
- Exclusion reason metrics (P2 - threshold tuning)
- Type B threshold recalibration (post-expansion tuning)

### Known Limitations
- **Bybit backfill is recent-only**: Uses public `recent-trade` endpoint (~1000 trades max), not suitable for arbitrary historical recovery. Acceptable because Binance + OKX provide full historical coverage for perp.
- **Coinbase backfill unavailable**: By design (Option A architecture), Coinbase is realtime-only.

### Bottom Line
v0.1.22 is **production-ready for downstream integration**. All venues are connected with full quorum on both market types. Observability is complete with Prometheus metrics and CloudWatch alerting. The system can now be used as a reliable upstream dependency for:
- **UI Charting**: Frontend can consume `/v0/candles`, `/v0/latest`, and `/v0/stream`
- **Forecasting**: EMS providers can consume `/v0/dataset/candles` for Type B datasets

---

## Appendix: File References

| Component | File Path |
|-----------|-----------|
| API Routes | `services/abacus_indexer/app/routes/v0.py` |
| Venue Constants | `services/abacus_indexer/core/constants.py` |
| Backfill Service | `services/abacus_indexer/backfill/service.py` |
| Binance Connector | `services/abacus_indexer/connectors/binance.py` |
| Coinbase Connector | `services/abacus_indexer/connectors/coinbase.py` |
| Kraken Connector | `services/abacus_indexer/connectors/kraken.py` |
| OKX Connector | `services/abacus_indexer/connectors/okx.py` |
| Bybit Connector | `services/abacus_indexer/connectors/bybit.py` |
| Composite Aggregator | `services/abacus_indexer/aggregator/composite_aggregator.py` |
| Types | `services/abacus_indexer/core/types.py` |
| Config | `services/abacus_indexer/app/config.py` |
| Auth (v0.1.18) | `services/abacus_indexer/app/routes/v0.py:verify_admin_key()` |
| Task Definition | `abacus-indexer-task-def.json` |
| Option A Decision | `plans/COINBASE_BACKFILL_ARCHITECTURE_DECISION.md` |
