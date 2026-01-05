# Abacus Indexer Frontend Integration Guide

**Version**: v0.1.23
**Date**: 2026-01-03
**Status**: Production-Ready

---

## Overview

The Abacus Indexer provides real-time and historical composite OHLCV data for BTC and ETH across spot and perpetual markets. This guide covers frontend integration for charting, live prices, and data quality display.

## Base URL

```
Production: https://live-price-production-alb-1621087159.ca-central-1.elb.amazonaws.com/indexer
```

All endpoints are prefixed with `/indexer` when accessed via the ALB.

---

## Quick Start

### Get Current Prices (All Markets)
```javascript
const response = await fetch('/indexer/v0/latest');
const markets = await response.json();
// Returns: [{ asset: "BTC", market_type: "spot", price: 90116.24, ... }, ...]
```

### Get Historical Candles
```javascript
const response = await fetch('/indexer/v0/candles?asset=BTC&market_type=spot&limit=60');
const data = await response.json();
// Returns: { asset, market_type, candles: [...], count, start_time, end_time }
const candles = data.candles;
// candles: [{ time: 1767470040, open: 90069.33, high: 90078.38, ... }, ...]
```

### Subscribe to Real-Time Updates (SSE)
```javascript
const eventSource = new EventSource('/indexer/v0/stream?assets=BTC,ETH');
eventSource.addEventListener('price', (e) => {
  const data = JSON.parse(e.data);
  console.log(`${data.asset}/${data.market_type}: $${data.price}`);
});
```

---

## API Reference

### GET /v0/latest

Returns current prices and last completed composite bars for all markets.

**Response**
```json
[
  {
    "asset": "BTC",
    "market_type": "spot",
    "price": 90116.24,
    "time": 1767470135,
    "degraded": false,
    "included_venues": ["binance", "coinbase", "kraken", "okx"],
    "last_bar": {
      "time": 1767470040,
      "open": 90069.33,
      "high": 90078.38,
      "low": 90069.32,
      "close": 90076.67,
      "volume": 5.717344,
      "buy_volume": 0.317414,
      "sell_volume": 5.399930,
      "buy_count": 123,
      "sell_count": 198,
      "degraded": false,
      "is_gap": false
    }
  },
  // ... ETH/spot, BTC/perp, ETH/perp
]
```

**Fields**
| Field | Type | Description |
|-------|------|-------------|
| `asset` | string | "BTC" or "ETH" |
| `market_type` | string | "spot" or "perp" |
| `price` | number | Current median price across venues |
| `time` | integer | Unix timestamp (seconds) |
| `degraded` | boolean | True if below preferred quorum (3 venues) |
| `included_venues` | string[] | Venues contributing to composite |
| `last_bar` | object | Last completed 1-minute candle |

**Usage: Price Display**
```typescript
interface MarketPrice {
  asset: string;
  market_type: string;
  price: number;
  degraded: boolean;
  included_venues: string[];
}

async function getCurrentPrices(): Promise<MarketPrice[]> {
  const res = await fetch('/indexer/v0/latest');
  return res.json();
}
```

---

### GET /v0/candles

Returns historical composite OHLCV candles.

**Query Parameters**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `asset` | string | Yes | - | "BTC" or "ETH" |
| `market_type` | string | Yes | - | "spot" or "perp" |
| `start` | integer | No | now - (limit × 60) | Start time (unix seconds). Defaults to `limit` candles ago. |
| `end` | integer | No | now | End time (unix seconds) |
| `limit` | integer | No | 60 | Max candles to return (max 1440) |

**Response**
```json
{
  "asset": "BTC",
  "market_type": "spot",
  "candles": [
    {
      "time": 1767470040,
      "open": 90069.33,
      "high": 90078.38,
      "low": 90069.32,
      "close": 90076.67,
      "volume": 5.717344,
      "buy_volume": 0.317414,
      "sell_volume": 5.399930,
      "buy_count": 123,
      "sell_count": 198,
      "degraded": false,
      "is_gap": false,
      "included_venues": ["binance", "coinbase", "kraken", "okx"]
    }
  ],
  "count": 1,
  "start_time": 1767470040,
  "end_time": 1767470100
}
```

**Usage: Charting**
```typescript
interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  degraded: boolean;
  is_gap: boolean;
}

async function getCandles(
  asset: 'BTC' | 'ETH',
  marketType: 'spot' | 'perp',
  limit = 60
): Promise<Candle[]> {
  const res = await fetch(
    `/indexer/v0/candles?asset=${asset}&market_type=${marketType}&limit=${limit}`
  );
  const data = await res.json();
  return data.candles;  // Note: Response is wrapped object, candles in .candles field
}

// For TradingView/Lightweight Charts
function convertToChartData(candles: Candle[]) {
  return candles.map(c => ({
    time: c.time,  // Unix seconds
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    // Color gap/degraded bars differently
    color: c.is_gap ? '#ff4444' : c.degraded ? '#ffaa00' : undefined
  }));
}
```

---

### GET /v0/stream

Server-Sent Events (SSE) stream for real-time updates.

**Query Parameters**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `assets` | string | No | "BTC,ETH" | Comma-separated assets |

**Event Types**
| Event | Cadence | Description |
|-------|---------|-------------|
| `price` | ~500ms | Current prices for all markets |
| `telemetry` | ~5s | Venue connection status |

**Price Event Data**
```json
{
  "asset": "BTC",
  "market_type": "spot",
  "price": 90116.24,
  "time": 1767470135,
  "included_venues": ["binance", "coinbase", "kraken", "okx"]
}
```

**Telemetry Event Data**
```json
{
  "venues": {
    "binance/BTC/spot": {
      "state": "connected",
      "uptime_percent": 99.8,
      "message_count": 12345,
      "trade_count": 8901
    }
  },
  "system": {
    "status": "healthy",
    "connected_spot": 4,
    "connected_perp": 3
  }
}
```

**Usage: Real-Time Price Ticker**
```typescript
function createPriceStream(
  onPrice: (data: any) => void,
  onTelemetry?: (data: any) => void
): EventSource {
  const es = new EventSource('/indexer/v0/stream');

  es.addEventListener('price', (e) => {
    onPrice(JSON.parse(e.data));
  });

  if (onTelemetry) {
    es.addEventListener('telemetry', (e) => {
      onTelemetry(JSON.parse(e.data));
    });
  }

  es.onerror = () => {
    console.error('SSE connection error, reconnecting...');
    // EventSource auto-reconnects
  };

  return es;
}

// Usage
const stream = createPriceStream(
  (price) => updatePriceTicker(price),
  (telemetry) => updateConnectionStatus(telemetry)
);

// Cleanup
// stream.close();
```

---

### GET /v0/telemetry

Returns detailed per-venue connection status.

**Response**
```json
{
  "venues": {
    "binance/BTC/spot": {
      "connection_state": "connected",
      "uptime_percent": 99.8,
      "last_message_at": "2026-01-03T19:55:00Z",
      "message_count": 12345,
      "trade_count": 8901,
      "reconnect_count": 0
    }
  },
  "system": {
    "status": "healthy",
    "connected_spot": 4,
    "connected_perp": 3,
    "total_venues": 14
  }
}
```

**Usage: Connection Status Display**
```typescript
async function getVenueStatus() {
  const res = await fetch('/indexer/v0/telemetry');
  const data = await res.json();

  return {
    isHealthy: data.system.status === 'healthy',
    spotVenues: data.system.connected_spot,
    perpVenues: data.system.connected_perp,
    venues: Object.entries(data.venues).map(([key, v]: [string, any]) => ({
      id: key,
      connected: v.connection_state === 'connected',
      uptime: v.uptime_percent
    }))
  };
}
```

---

### GET /v0/integrity

Returns data quality metrics for forecasting gating.

**Query Parameters**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `asset` | string | Yes | - | "BTC" or "ETH" |
| `market_type` | string | Yes | - | "spot" or "perp" |
| `lookback` | integer | No | 60 | Minutes to analyze |

**Response**
```json
{
  "asset": "BTC",
  "market_type": "spot",
  "lookback_minutes": 60,
  "expected_bars": 60,
  "actual_bars": 59,
  "gap_count": 1,
  "gap_rate": 0.017,
  "degraded_count": 5,
  "degraded_rate": 0.083,
  "tier": 1,
  "tier1_eligible": true,
  "recommendation": "PROCEED"
}
```

**Tier Classification**
| Tier | Gap Rate | Degraded Rate | Recommendation |
|------|----------|---------------|----------------|
| 1 | ≤5 gaps | ≤60 degraded | PROCEED |
| 2 | ≤30 gaps | ≤180 degraded | PROCEED_WITH_CAUTION |
| 3 | >30 gaps | >180 degraded | BACKFILL_REQUIRED |

---

### GET /health

Returns service health status.

**Response**
```json
{
  "status": "healthy",
  "service": "abacus-indexer",
  "version": "0.1.22",
  "environment": "production",
  "timestamp": "2026-01-03T19:55:03Z",
  "components": {}
}
```

---

## UI Component Patterns

### 1. Price Ticker Component

```tsx
import { useState, useEffect } from 'react';

interface PriceData {
  asset: string;
  market_type: string;
  price: number;
  degraded: boolean;
}

export function PriceTicker() {
  const [prices, setPrices] = useState<PriceData[]>([]);

  useEffect(() => {
    const es = new EventSource('/indexer/v0/stream');

    es.addEventListener('price', (e) => {
      const data = JSON.parse(e.data);
      setPrices(prev => {
        const idx = prev.findIndex(
          p => p.asset === data.asset && p.market_type === data.market_type
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = data;
          return next;
        }
        return [...prev, data];
      });
    });

    return () => es.close();
  }, []);

  return (
    <div className="price-ticker">
      {prices.map(p => (
        <div
          key={`${p.asset}-${p.market_type}`}
          className={p.degraded ? 'degraded' : ''}
        >
          <span>{p.asset}/{p.market_type}</span>
          <span>${p.price.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
```

### 2. Candlestick Chart Component

```tsx
import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

interface CandleChartProps {
  asset: 'BTC' | 'ETH';
  marketType: 'spot' | 'perp';
}

export function CandleChart({ asset, marketType }: CandleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: 800,
      height: 400,
      timeScale: { timeVisible: true }
    });

    const candleSeries = chart.addCandlestickSeries();

    // Load historical data
    fetch(`/indexer/v0/candles?asset=${asset}&market_type=${marketType}&limit=120`)
      .then(res => res.json())
      .then(data => {
        candleSeries.setData(
          data.candles.map((c: any) => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close
          }))
        );
      });

    // Subscribe to real-time updates
    const es = new EventSource('/indexer/v0/stream');
    es.addEventListener('price', (e) => {
      const data = JSON.parse(e.data);
      if (data.asset === asset && data.market_type === marketType) {
        // Update last candle
        candleSeries.update({
          time: Math.floor(data.time / 60) * 60,
          open: data.price,
          high: data.price,
          low: data.price,
          close: data.price
        });
      }
    });

    return () => {
      es.close();
      chart.remove();
    };
  }, [asset, marketType]);

  return <div ref={containerRef} />;
}
```

### 3. Connection Status Indicator

```tsx
import { useState, useEffect } from 'react';

export function ConnectionStatus() {
  const [status, setStatus] = useState<{
    healthy: boolean;
    spot: number;
    perp: number;
  }>({ healthy: true, spot: 0, perp: 0 });

  useEffect(() => {
    const es = new EventSource('/indexer/v0/stream');

    es.addEventListener('telemetry', (e) => {
      const data = JSON.parse(e.data);
      setStatus({
        healthy: data.system.status === 'healthy',
        spot: data.system.connected_spot,
        perp: data.system.connected_perp
      });
    });

    return () => es.close();
  }, []);

  return (
    <div className={`status ${status.healthy ? 'healthy' : 'degraded'}`}>
      <span className="dot" />
      <span>Spot: {status.spot}/4 | Perp: {status.perp}/3</span>
    </div>
  );
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process response |
| 400 | Invalid parameters | Check query params |
| 404 | Endpoint not found | Check URL path |
| 500 | Server error | Retry with backoff |
| 502/503 | Service unavailable | Retry with backoff |

### SSE Reconnection

EventSource automatically reconnects on connection loss. Handle `onerror` for logging:

```javascript
eventSource.onerror = (e) => {
  console.warn('SSE error, will auto-reconnect:', e);
};
```

### Degraded Data Display

When `degraded: true`, indicate reduced data quality to users:

```css
.degraded {
  opacity: 0.7;
  border-left: 3px solid #ffaa00;
}

.gap {
  opacity: 0.5;
  border-left: 3px solid #ff4444;
}
```

---

## Performance Recommendations

1. **Use SSE for live prices** - Avoid polling `/v0/latest`
2. **Limit historical requests** - Use `limit` param, max 1440
3. **Cache candle data** - Only fetch new candles, append to existing
4. **Debounce UI updates** - SSE fires at 500ms, batch if needed

---

## Testing Endpoints

```bash
# Health check
curl http://live-price-production-alb-1621087159.ca-central-1.elb.amazonaws.com/indexer/health

# Current prices
curl http://live-price-production-alb-1621087159.ca-central-1.elb.amazonaws.com/indexer/v0/latest

# Historical candles
curl "http://live-price-production-alb-1621087159.ca-central-1.elb.amazonaws.com/indexer/v0/candles?asset=BTC&market_type=spot&limit=10"

# SSE stream (will keep connection open)
curl -N http://live-price-production-alb-1621087159.ca-central-1.elb.amazonaws.com/indexer/v0/stream
```

---

## Support

- **Issues**: Report UI bugs with endpoint, request, and response details
- **Metrics**: Monitor `/indexer/metrics` for service health
- **Alerts**: CloudWatch alarms active for gap rate, degraded rate, and connectivity

---

**Document Version**: 1.0
**Last Updated**: 2026-01-03
**Author**: Claude Code
