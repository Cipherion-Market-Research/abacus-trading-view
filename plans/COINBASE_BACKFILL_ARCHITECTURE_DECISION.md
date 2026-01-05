# Abacus Indexer: Coinbase Backfill Architecture Decision

**Date**: 2026-01-02
**Status**: APPROVED - Option A
**Authors**: ECS Dev Team + POC Team Whiteboarding Session

---

## Decision Summary

**Coinbase is REALTIME-only. Backfill uses venues with historical APIs.**

This is intentional architecture, not a limitation. Each venue contributes what it's good at.

---

## Current Framework (Deployed v0.1.16)

```
Abacus Indexer Service (ECS Fargate)
├── Realtime Layer (WebSocket)
│   ├── Binance spot + perp
│   └── Coinbase spot
│
├── Composite Builder
│   ├── Median OHLC (multi-venue)
│   ├── Sum volumes (buy + sell separated by taker side)
│   └── Quality flags (degraded, is_gap, excluded_venues)
│
├── Persistence (TimescaleDB/RDS)
│   ├── composite_bars (pre-computed buy/sell volumes)
│   └── venue_bars (per-venue traceability)
│
└── API Endpoints
    ├── GET /v0/dataset/candles   → Fixed-length response, gaps explicit
    ├── GET /v0/integrity         → Quality tier for gating decisions
    └── POST /v0/backfill         → Gap repair via REST APIs
```

**Key Design Principle**: The indexer runs continuously, recording every trade via websocket. The persistent DB IS the primary data source for forecasting. Backfill is only needed for outage recovery.

---

## The Issue

**Coinbase REST API limitation**: The `/products/{symbol}/trades` endpoint only returns the most recent ~1000 trades with no time-range query capability.

```python
# From backfill/service.py:391-444
async def _fetch_coinbase_trades(self, client, asset, market_type, start_ms, end_ms):
    response = await client.get(url, params={"limit": 1000})  # Recent only!
    for item in data:
        if timestamp < start_ms or timestamp > end_ms:
            continue  # For old gaps, ALL trades filtered out
```

**Impact**: Historical gaps (>5 minutes old) cannot be repaired using Coinbase data.

---

## Options Considered

### Option A: Coinbase Realtime-Only (APPROVED ✅)

- Coinbase contributes to live composite bars via websocket
- Backfill uses Binance + Kraken + OKX (venues with historical APIs)
- Backfilled bars explicitly mark Coinbase as excluded

**Pros**: Clean architecture, no workarounds, scales with venue expansion
**Cons**: Backfilled bars have one fewer venue (acceptable - still meets quorum)

### Option B: 15s Granularity Storage (REJECTED ❌)

- Store Coinbase data at 15-second intervals
- Compute 1m bars from 15s snapshots

**Why Rejected**: Does not solve the backfill problem. The limitation is Coinbase's API design (no historical time-range queries), not our polling frequency. 15s granularity adds 4x storage overhead without changing backfill capability.

### Option C: Implement Coinbase Pagination Workaround (REJECTED ❌)

- Complex, time-consuming implementation
- Unnecessary given other venues have better APIs
- Delays Type B signoff

---

## Approved Architecture: Intentional Venue Roles

| Venue | Realtime | Backfill | Rationale |
|-------|----------|----------|-----------|
| **Binance** | ✅ | ✅ | Best API, highest volume, price leader |
| **Coinbase** | ✅ | ❌ | US regulatory value, poor historical API |
| **Kraken** | ✅ (planned) | ✅ | Good historical API, European presence |
| **OKX** | ✅ (planned) | ✅ | Good historical API, Asian presence |
| **Bybit** | ✅ (perp, planned) | ✅ | Good historical API |

### Venue Role Constants (To Be Added)

```python
# In constants.py
REALTIME_VENUES = {"binance", "coinbase", "kraken", "okx", "bybit"}
BACKFILL_VENUES = {"binance", "kraken", "okx", "bybit"}  # Coinbase excluded

# Decision tree for new venue:
# 1. Does it have a historical trades API with time-range queries?
#    - YES: Add to both REALTIME_VENUES and BACKFILL_VENUES
#    - NO:  Add to REALTIME_VENUES only (like Coinbase)
```

---

## Evidence-Based Analysis

### 1. Exchange API Capabilities

| Venue | Historical Trade API | Pagination | Time-Range Query |
|-------|---------------------|------------|------------------|
| **Binance** | `/aggTrades` | ✅ fromId | ✅ startTime/endTime |
| **Coinbase** | `/trades` | ❌ | ❌ recent only |
| **Kraken** | `/Trades` | ✅ since | ✅ timestamp-based |
| **OKX** | `/history-trades` | ✅ | ✅ time-range |
| **Bybit** | `/public/recent-trading-records` | ✅ | ✅ |

### 2. Price Correlation Evidence

From crypto market microstructure research:
- Major exchanges show **20-40 bps** price deviation typically
- Binance acts as **price leader** (highest volume, fastest updates)
- During low volatility: <10 bps spread across venues
- During high volatility: spreads widen but direction remains consistent

**Key Insight**: Technical indicators (MACD, EMA, RSI) care about **trend direction**, not absolute price. Multi-venue median is MORE stable than single-exchange data because it filters venue-specific noise.

### 3. CCXT Does Not Solve This

CCXT wraps the same underlying exchange APIs. Same limitation applies.

---

## Why This Works for Forecasting

### Recent Data (5-60 minutes) — What Forecasting Actually Uses

```
┌─────────────────────────────────────────────────────────────┐
│ GET /v0/dataset/candles?asset=BTC&lookback=60              │
├─────────────────────────────────────────────────────────────┤
│ Returns 60 bars from RDS, captured in REALTIME             │
│ → Coinbase IS contributing to these bars                   │
│ → Buy/sell volumes pre-computed from websocket trades      │
│ → Gaps are explicit (is_gap=true), not silent              │
└─────────────────────────────────────────────────────────────┘
```

### Gap Repair (Outage Recovery)

Backfill is only needed when the indexer itself was down. In that case:
- Use Binance + Kraken + OKX (when added) for gap repair
- 3 venues with good historical APIs > 2 venues including one that can't backfill
- Coinbase explicitly marked as excluded in repaired bars

---

## POC Team Caveats (Incorporated)

### Caveat A: Explicit Exclusion Reason for Backfilled Bars

For backfilled bars, Coinbase must be explicitly marked as excluded with a clear reason:

```python
class ExcludeReason(str, Enum):
    DISCONNECTED = "disconnected"
    STALE = "stale"
    OUTLIER = "outlier"
    NO_DATA = "no_data"
    BACKFILL_UNAVAILABLE = "backfill_unavailable"  # NEW
```

This ensures:
- `excluded_venues` reflects reality
- Type B `quality_degraded` correctly counts Coinbase exclusion
- `/venue-candles` makes it obvious Coinbase bars are absent for repaired intervals

### Caveat B: Quorum Configuration Mismatch

Current production config:
- `PREFERRED_QUORUM=3` (from task definition)
- Only 2 spot venues deployed (binance, coinbase)

**Result**: ALL spot bars are currently `degraded=true` (2 < 3).

**Resolution**: Document as "forward-looking configuration". When Kraken/OKX are added, preferred_quorum=3 becomes achievable. Current degraded status is expected and acceptable.

### Caveat C: Threshold Recalibration After Venue Expansion

When moving from 2→4 spot venues:
1. Run Type A soak test post-expansion
2. Compare gap rates, exclusion reasons, composite drift
3. Recalibrate Tier thresholds if needed (currently: ≤5 gaps = Tier 1)

---

## Integration with Forecasting Stack

### API Contract (Correct Parameters)

```python
# GET /v0/dataset/candles
# Parameters:
#   - asset: str (BTC, ETH)
#   - market_type: str (spot, perp)  # Note: snake_case
#   - lookback: int (60-20160 minutes)
```

### AbacusIndexerProvider Implementation

```python
class AbacusIndexerProvider:
    """
    Primary data source for forecasting.
    Falls back to MultiCEXResolver if indexer unavailable.
    """

    async def fetch_candles(self, asset: str, lookback: int) -> List[Candle]:
        response = await self.client.get(
            f"{INDEXER_URL}/v0/dataset/candles",
            params={
                "asset": asset,
                "market_type": "spot",  # snake_case per API contract
                "lookback": lookback     # not "periods"
            }
        )

        # Already has pre-computed buy_volume, sell_volume
        # Already has integrity flags (degraded, is_gap)
        # Fixed-length response (no silent gaps)
        return [self._to_birdeye_format(bar) for bar in response.json()["data"]]
```

---

## Action Items

### Immediate (Option A Formalization)

1. **Add `BACKFILL_UNAVAILABLE` to ExcludeReason enum**
   - File: `services/abacus_indexer/core/types.py`
   - Purpose: Explicit exclusion reason for venues without historical APIs

2. **Add venue role constants**
   - File: `services/abacus_indexer/core/constants.py`
   - Add: `REALTIME_VENUES`, `BACKFILL_VENUES` sets

3. **Update backfill service to use venue roles**
   - File: `services/abacus_indexer/backfill/service.py`
   - Check `BACKFILL_VENUES` instead of hardcoded list
   - Mark excluded venues with `BACKFILL_UNAVAILABLE`

4. **Document quorum config in contract freeze**
   - File: `plans/ABACUS_INDEXER_V0_CONTRACT_FREEZE.md`
   - Note: `preferred_quorum=3` is forward-looking, currently always degraded for spot

### Infrastructure (Required Before Public Exposure)

5. **Protect `/v0/backfill` endpoint**
   - WAF allowlist and/or authentication
   - This is a synchronous mutation endpoint

### Future (Post Venue Expansion)

6. **Add Kraken/OKX connectors**
   - Enables 3-venue backfill capability
   - Improves composite quality

7. **Threshold recalibration**
   - Run integrity analysis pre/post expansion
   - Adjust Tier thresholds if needed

---

## Summary

**Decision**: Option A approved. Coinbase is REALTIME-only; backfill uses Binance + Kraken + OKX for spot and Binance + OKX + Bybit for perps.

**Rationale**: This is intentional venue-role architecture. Each venue contributes what it's good at. Coinbase provides US market signal in realtime; other venues provide historical gap repair capability.

**Key Implementation**: Backfilled bars explicitly encode Coinbase exclusion with `BACKFILL_UNAVAILABLE` reason, maintaining traceability and correct quality metrics.

**Future-Proofing**: Pattern scales for venue expansion. New venues are categorized as REALTIME-only or REALTIME+BACKFILL based on their API capabilities.
