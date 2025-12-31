# Abacus:INDEX POC

**Status:** POC-0 (In Development)
**Last Updated:** 2025-12-30

## Overview

This module implements the Abacus:INDEX proof-of-concept for multi-venue cryptocurrency price composites. The goal is to validate the architecture for computing robust spot and perpetual price indices suitable for short-horizon forecasting (2h/12h/24h).

## POC Limitations

> **This is a browser-based POC, not a production system.**

The following limitations apply:

| Limitation | Impact | Production Solution |
|------------|--------|---------------------|
| Tab backgrounding | Inactive tabs throttle/pause WS connections | ECS always-on service |
| Memory pressure | High-frequency trades can accumulate | Aggressive windowing + Web Workers |
| No persistent state | Page refresh loses in-progress bars | Server-side state + REST backfill |
| Network variability | Local latency biases lead/lag measurement | Consistent ECS networking + NTP |

**Interpret reliability metrics from this POC as lower bounds, not production expectations.**

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Vercel)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Binance Spot │  │Coinbase Spot │  │ Binance Perp │  POC-0   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌─────────────────────────────────────────────────────┐       │
│  │              Bar Builder (1m OHLCV)                 │       │
│  └─────────────────────────┬───────────────────────────┘       │
│                            │                                    │
│         ┌──────────────────┼──────────────────┐                │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │Spot Composite│    │Perp Composite│    │  Telemetry │         │
│  │   (median)  │    │   (median)  │    │   Harness   │         │
│  └──────┬──────┘    └──────┬──────┘    └─────────────┘         │
│         │                  │                                    │
│         ▼                  ▼                                    │
│  ┌─────────────────────────────────────┐                       │
│  │         Basis Features              │                       │
│  │  basis = perp - spot                │                       │
│  │  basis_bps = 10000 * basis / spot   │                       │
│  └─────────────────────────────────────┘                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## POC Phases

| Phase | Spot | Perp | Asset | Status |
|-------|------|------|-------|--------|
| POC-0 | Binance, Coinbase | Binance | BTC | In Progress |
| POC-1 | +OKX | +OKX, +Bybit | BTC | Planned |
| POC-2 | +Kraken | — | BTC, +ETH | Planned |

## Key Design Decisions

### 1. Spot and Perp are Separate

We do **not** blend perp prices into the spot composite. Basis (perp - spot) and funding rates are signals themselves.

### 2. Median-Based Composites

We use **median** of venue closes per minute, not volume-weighted average. This is robust to:
- Wash trading (inflated volume)
- Single-venue anomalies
- Partial outages

### 3. 100bps Outlier Threshold

Any venue deviating >100bps from the cross-venue median is excluded from that minute's composite. This is a stale/bad-feed guardrail, not a microstructure filter.

### 4. Degraded Mode

When venues drop, we continue computing with available venues (minimum quorum: 2) and set `degraded: true`. For forecasting, partial data beats no data.

## Directory Structure

```
abacus-index/
├── README.md              # This file
├── types.ts               # Canonical types
├── symbolMapping.ts       # Venue → symbol mapping
├── constants.ts           # Thresholds, configs
│
├── hooks/
│   ├── venues/            # Per-venue WS hooks
│   ├── composites/        # Spot/Perp composite hooks
│   ├── features/          # Derived features (basis, funding)
│   └── telemetry/         # Reliability measurement
│
├── utils/
│   ├── barBuilder.ts      # Trade → 1m bar
│   ├── outlierFilter.ts   # Median-deviation filter
│   └── timestamps.ts      # Timestamp handling
│
└── components/
    └── AbacusIndexDebug.tsx  # POC harness UI
```

## Usage

```tsx
import { useSpotComposite } from '@/features/abacus-index/hooks/composites/useSpotComposite';
import { usePerpComposite } from '@/features/abacus-index/hooks/composites/usePerpComposite';
import { useBasisFeatures } from '@/features/abacus-index/hooks/features/useBasisFeatures';

function MyComponent() {
  const spot = useSpotComposite({ asset: 'BTC' });
  const perp = usePerpComposite({ asset: 'BTC' });
  const basis = useBasisFeatures({ spot, perp });

  return (
    <div>
      <p>Spot: {spot.price}</p>
      <p>Perp: {perp.price}</p>
      <p>Basis: {basis.basisBps} bps</p>
      <p>Degraded: {spot.degraded || perp.degraded ? 'Yes' : 'No'}</p>
    </div>
  );
}
```

## Related Documentation

- [EXCHANGE_INDEX_ANALYSIS.md](../../../docs/EXCHANGE_INDEX_ANALYSIS.md) - Full analysis and decisions
- Sections A17-A20 contain the finalized POC specification

## Handoff Notes

When handing off to the ECS production team:

1. **Symbol mapping** (`symbolMapping.ts`) is production-ready
2. **Types** (`types.ts`) define the API contract
3. **Outlier logic** (`outlierFilter.ts`) should be reviewed for threshold tuning
4. **WS hooks** are browser-specific; replace with CCXT Pro for ECS
5. **Telemetry schema** should inform production monitoring
