# Abacus Indexer Prometheus Metrics

**Date**: 2026-01-03
**Version**: v0.1.22 (pending release)
**Author**: Claude Code

## Overview

The Abacus Indexer exposes Prometheus-compatible metrics at `/metrics` (and `/indexer/metrics` via ALB routing). These metrics enable:

- Real-time monitoring dashboards
- Alerting on data quality issues
- Capacity planning and performance analysis
- SLA compliance tracking

## Endpoint

```
GET /metrics
GET /indexer/metrics  (ALB routing)
```

**Response Format**: `text/plain; version=0.0.4; charset=utf-8` (Prometheus exposition format)

## Metrics Reference

### Composite Bar Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `abacus_composite_bars_total` | Counter | `asset`, `market_type` | Total composite bars produced |
| `abacus_gap_bars_total` | Counter | `asset`, `market_type` | Gap bars (below minimum quorum) |
| `abacus_degraded_bars_total` | Counter | `asset`, `market_type` | Degraded bars (below preferred quorum) |
| `abacus_venues_included` | Histogram | `asset`, `market_type` | Distribution of venues included per bar |

**Example Queries:**
```promql
# Gap rate over last hour
rate(abacus_gap_bars_total[1h]) / rate(abacus_composite_bars_total[1h])

# Bars per minute by market
rate(abacus_composite_bars_total[5m]) * 60
```

### Venue Connection Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `abacus_venue_connected` | Gauge | `venue`, `asset`, `market_type` | Connection status (1=connected, 0=disconnected) |
| `abacus_venue_uptime_percent` | Gauge | `venue`, `asset`, `market_type` | Uptime since service start (0-100) |
| `abacus_venue_reconnects_total` | Counter | `venue`, `asset`, `market_type` | Total WebSocket reconnections |
| `abacus_venue_messages_total` | Counter | `venue`, `asset`, `market_type` | Messages received from venue |
| `abacus_venue_trades_total` | Counter | `venue`, `asset`, `market_type` | Trades processed from venue |

**Example Queries:**
```promql
# Connected venue count
sum(abacus_venue_connected)

# Venues with <99% uptime
abacus_venue_uptime_percent < 99

# Reconnects per hour by venue
rate(abacus_venue_reconnects_total[1h]) * 60
```

### Database Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `abacus_db_writes_total` | Counter | `table`, `status` | Write operations (success/error) |
| `abacus_db_write_latency_seconds` | Histogram | `table` | Write latency distribution |

**Example Queries:**
```promql
# DB error rate
rate(abacus_db_writes_total{status="error"}[5m]) / rate(abacus_db_writes_total[5m])

# 99th percentile write latency
histogram_quantile(0.99, rate(abacus_db_write_latency_seconds_bucket[5m]))
```

### Service Info

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `abacus_service_info` | Gauge | `version`, `environment` | Service metadata |

## Sample Output

```
# HELP abacus_composite_bars_total Total composite bars produced
# TYPE abacus_composite_bars_total counter
abacus_composite_bars_total{asset="BTC",market_type="spot"} 1440.0
abacus_composite_bars_total{asset="BTC",market_type="perp"} 1440.0
abacus_composite_bars_total{asset="ETH",market_type="spot"} 1440.0
abacus_composite_bars_total{asset="ETH",market_type="perp"} 1440.0

# HELP abacus_gap_bars_total Total gap bars (below minimum quorum)
# TYPE abacus_gap_bars_total counter
abacus_gap_bars_total{asset="BTC",market_type="spot"} 0.0
abacus_gap_bars_total{asset="BTC",market_type="perp"} 0.0
abacus_gap_bars_total{asset="ETH",market_type="spot"} 3.0
abacus_gap_bars_total{asset="ETH",market_type="perp"} 0.0

# HELP abacus_venue_connected Venue WebSocket connection status
# TYPE abacus_venue_connected gauge
abacus_venue_connected{asset="BTC",market_type="spot",venue="binance"} 1.0
abacus_venue_connected{asset="BTC",market_type="spot",venue="coinbase"} 1.0
abacus_venue_connected{asset="BTC",market_type="spot",venue="kraken"} 1.0
abacus_venue_connected{asset="BTC",market_type="spot",venue="okx"} 1.0
abacus_venue_connected{asset="BTC",market_type="perp",venue="binance"} 1.0
abacus_venue_connected{asset="BTC",market_type="perp",venue="okx"} 1.0
abacus_venue_connected{asset="BTC",market_type="perp",venue="bybit"} 1.0

# HELP abacus_db_write_latency_seconds Database write latency in seconds
# TYPE abacus_db_write_latency_seconds histogram
abacus_db_write_latency_seconds_bucket{table="composite_bars",le="0.001"} 50.0
abacus_db_write_latency_seconds_bucket{table="composite_bars",le="0.005"} 1200.0
abacus_db_write_latency_seconds_bucket{table="composite_bars",le="0.01"} 1400.0
abacus_db_write_latency_seconds_bucket{table="composite_bars",le="+Inf"} 1440.0
abacus_db_write_latency_seconds_sum{table="composite_bars"} 5.2
abacus_db_write_latency_seconds_count{table="composite_bars"} 1440.0

# HELP abacus_service_info Service information
# TYPE abacus_service_info gauge
abacus_service_info{environment="production",version="0.1.22"} 1.0
```

## Prometheus Configuration

### Scrape Configuration

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'abacus-indexer'
    static_configs:
      - targets: ['abacus-prod-alb-1847291847.ca-central-1.elb.amazonaws.com']
    metrics_path: '/indexer/metrics'
    scheme: https
    scrape_interval: 15s
    scrape_timeout: 10s
```

### For ECS Service Discovery:

```yaml
scrape_configs:
  - job_name: 'abacus-indexer-ecs'
    ec2_sd_configs:
      - region: ca-central-1
        port: 8000
    relabel_configs:
      - source_labels: [__meta_ec2_tag_Service]
        regex: abacus-indexer
        action: keep
    metrics_path: '/metrics'
```

## Alerting Rules

### Example Prometheus Alert Rules

```yaml
groups:
  - name: abacus-indexer
    rules:
      # High gap rate alert
      - alert: AbacusHighGapRate
        expr: >
          sum(rate(abacus_gap_bars_total[5m])) /
          sum(rate(abacus_composite_bars_total[5m])) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High gap rate in composite bars"
          description: "Gap rate is {{ $value | humanizePercentage }} over 5 minutes"

      # Venue disconnected
      - alert: AbacusVenueDisconnected
        expr: abacus_venue_connected == 0
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Venue {{ $labels.venue }} disconnected"
          description: "{{ $labels.venue }}/{{ $labels.asset }}/{{ $labels.market_type }} is disconnected"

      # All venues disconnected (critical)
      - alert: AbacusAllVenuesDown
        expr: sum(abacus_venue_connected) == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "All venues disconnected"
          description: "No venue connections active - service is producing gap bars"

      # High DB latency
      - alert: AbacusHighDBLatency
        expr: >
          histogram_quantile(0.99, rate(abacus_db_write_latency_seconds_bucket[5m])) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database write latency"
          description: "99th percentile write latency is {{ $value }}s"

      # DB errors
      - alert: AbacusDBErrors
        expr: rate(abacus_db_writes_total{status="error"}[5m]) > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database write errors detected"
          description: "{{ $value }} errors per second"
```

## Grafana Dashboard

### Recommended Panels

1. **Overview Row**
   - Bars produced per minute (timeseries)
   - Gap rate percentage (gauge, 0-5% green, 5-10% yellow, >10% red)
   - Connected venues (stat panel)

2. **Venue Health Row**
   - Connection status heatmap (venue x asset/market)
   - Uptime percentage table
   - Reconnects timeline

3. **Database Performance Row**
   - Write latency distribution (histogram)
   - Error rate (timeseries)
   - Writes per second by table (stacked bar)

4. **Quality Metrics Row**
   - Venues included histogram
   - Degraded rate by market
   - Gap timeline (annotations)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Abacus Indexer                           │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │ Aggregator  │───▶│  Metrics    │───▶│  /metrics   │    │
│  │             │    │  Module     │    │  Endpoint   │    │
│  │ - Bars      │    │             │    │             │    │
│  │ - Venues    │    │ - Counters  │    │ Prometheus  │    │
│  │ - Quality   │    │ - Gauges    │    │ Format      │    │
│  └─────────────┘    │ - Histograms│    └──────┬──────┘    │
│                     └─────────────┘           │           │
│  ┌─────────────┐                              │           │
│  │ Persistence │─────────────────────────────▶│           │
│  │ - Latency   │                              │           │
│  │ - Errors    │                              │           │
│  └─────────────┘                              │           │
└───────────────────────────────────────────────┼───────────┘
                                                │
                                                ▼
                                    ┌───────────────────┐
                                    │    Prometheus     │
                                    │                   │
                                    │  Scrape every 15s │
                                    └─────────┬─────────┘
                                              │
                                              ▼
                                    ┌───────────────────┐
                                    │     Grafana       │
                                    │                   │
                                    │  Dashboards &     │
                                    │  Alerting         │
                                    └───────────────────┘
```

## Files Changed

| File | Changes |
|------|---------|
| `services/abacus_indexer/core/metrics.py` | **New** - Metric definitions |
| `services/abacus_indexer/app/routes/metrics.py` | **New** - `/metrics` endpoint |
| `services/abacus_indexer/app/routes/__init__.py` | Added metrics module export |
| `services/abacus_indexer/app/main.py` | Added metrics router, DB instrumentation |
| `services/abacus_indexer/aggregator/composite_aggregator.py` | Added bar metrics recording |

## Testing

### Local Testing

```bash
# Start service locally
cd services/abacus_indexer
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Fetch metrics
curl http://localhost:8000/metrics
```

### Production Verification

```bash
# Via ALB
curl https://abacus-prod-alb-1847291847.ca-central-1.elb.amazonaws.com/indexer/metrics

# Expected: Prometheus text format with all metrics
```

## Integration with CloudWatch

The Prometheus metrics complement the CloudWatch alarms:

| CloudWatch Alarm | Prometheus Metric |
|-----------------|-------------------|
| `abacus-indexer-high-gap-rate` | `abacus_gap_bars_total` |
| `abacus-indexer-high-degraded-rate` | `abacus_degraded_bars_total` |
| `abacus-indexer-connector-instability` | `abacus_venue_reconnects_total` |
| `abacus-indexer-database-errors` | `abacus_db_writes_total{status="error"}` |

CloudWatch provides log-based alerting; Prometheus provides metric-based dashboards and more flexible querying.

## Future Enhancements

1. **Histogram buckets tuning** - Adjust latency buckets based on observed distributions
2. **Request latency** - Add HTTP request latency metrics via middleware
3. **Memory/CPU metrics** - Add process resource consumption
4. **Custom exporters** - Per-venue trade volume, price spreads
5. **Exemplars** - Link traces to metrics for debugging

---

**Prepared by**: Claude Code
**Status**: Implementation complete, pending deployment
