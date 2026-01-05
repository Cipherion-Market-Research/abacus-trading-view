# Abacus Indexer CloudWatch Alarms Documentation

**Version**: 1.0
**Created**: 2026-01-03
**Last Updated**: 2026-01-03
**Author**: Claude Code
**Status**: Production

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Resources Created](#resources-created)
4. [Metric Filters](#metric-filters)
5. [Alarms](#alarms)
6. [SNS Topic & Notifications](#sns-topic--notifications)
7. [Reproduction Scripts](#reproduction-scripts)
8. [Threshold Tuning Guide](#threshold-tuning-guide)
9. [Troubleshooting](#troubleshooting)
10. [Issue Resolution Procedures](#issue-resolution-procedures)
11. [Maintenance](#maintenance)

---

## Overview

### Purpose

This document describes the CloudWatch observability infrastructure for the Abacus Indexer service. The alarms provide early warning for:

- **Data quality issues**: Gaps in composite bars, degraded composites
- **System stability issues**: Connector reconnects, database errors
- **Availability issues**: No running tasks, unhealthy hosts

### Design Principles

1. **Log-based metrics**: All custom metrics are derived from application logs via CloudWatch Metric Filters
2. **Conservative thresholds**: Alarms trigger on sustained issues, not transient spikes
3. **Actionable alerts**: Each alarm has a clear resolution procedure
4. **No false positives**: Thresholds tuned based on observed production behavior

### Scope

| Component | Covered |
|-----------|---------|
| Composite bar gaps | Yes |
| Degraded composites | Yes |
| Connector reconnects | Yes |
| Database errors | Yes |
| Task availability | Yes (pre-existing) |
| Target health | Yes (pre-existing) |
| API latency | Yes (pre-existing) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ECS Task (abacus-indexer)                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Application Logs                                            │    │
│  │  - Composite: BTC/spot time=... included=3 degraded=False   │    │
│  │  - GAP: ETH/spot time=... included=1                        │    │
│  │  - [binance/spot/BTC] Reconnecting in 2000ms                │    │
│  │  - Failed to connect to database: ...                       │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                CloudWatch Log Group                                  │
│                /ecs/abacus-indexer-production                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │ Metric      │ │ Metric      │ │ Metric      │
            │ Filter:     │ │ Filter:     │ │ Filter:     │
            │ Gaps        │ │ Degraded    │ │ Reconnects  │
            └─────────────┘ └─────────────┘ └─────────────┘
                    │               │               │
                    ▼               ▼               ▼
            ┌─────────────────────────────────────────────┐
            │         CloudWatch Metrics                   │
            │         Namespace: AbacusIndexer             │
            │  - CompositeGaps                             │
            │  - DegradedComposites                        │
            │  - ConnectorReconnects                       │
            │  - DatabaseErrors                            │
            │  - HealthyComposites                         │
            └─────────────────────────────────────────────┘
                                    │
                                    ▼
            ┌─────────────────────────────────────────────┐
            │         CloudWatch Alarms                    │
            │  - abacus-indexer-high-gap-rate             │
            │  - abacus-indexer-high-degraded-rate        │
            │  - abacus-indexer-connector-instability     │
            │  - abacus-indexer-database-errors           │
            └─────────────────────────────────────────────┘
                                    │
                                    ▼
            ┌─────────────────────────────────────────────┐
            │              SNS Topic                       │
            │  arn:aws:sns:ca-central-1:484907497221:     │
            │  abacus-indexer-alerts                       │
            └─────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
                 Email          Slack           PagerDuty
              (subscribe)    (webhook)        (integration)
```

---

## Resources Created

### AWS Region
All resources are in **ca-central-1**.

### Resource Summary

| Resource Type | Name | ARN/ID |
|--------------|------|--------|
| Log Group | /ecs/abacus-indexer-production | - |
| Metric Filter | abacus-indexer-gaps | - |
| Metric Filter | abacus-indexer-degraded | - |
| Metric Filter | abacus-indexer-reconnects | - |
| Metric Filter | abacus-indexer-db-errors | - |
| Metric Filter | abacus-indexer-composite-ok | - |
| Alarm | abacus-indexer-high-gap-rate | - |
| Alarm | abacus-indexer-high-degraded-rate | - |
| Alarm | abacus-indexer-connector-instability | - |
| Alarm | abacus-indexer-database-errors | - |
| SNS Topic | abacus-indexer-alerts | arn:aws:sns:ca-central-1:484907497221:abacus-indexer-alerts |

---

## Metric Filters

### 1. Composite Gaps (`abacus-indexer-gaps`)

**Purpose**: Counts bars where quorum was not met (gap in data).

**Log Pattern**: `"GAP:"`

**Example Log Line**:
```
2026-01-03 04:38:02,018 - services.abacus_indexer.aggregator.composite_aggregator - WARNING - GAP: ETH/spot time=1767415020 included=1
```

**Metric**:
- Namespace: `AbacusIndexer`
- Name: `CompositeGaps`
- Value: 1 per occurrence
- Default: 0

**Creation Command**:
```bash
aws logs put-metric-filter \
  --log-group-name /ecs/abacus-indexer-production \
  --filter-name "abacus-indexer-gaps" \
  --filter-pattern "\"GAP:\"" \
  --metric-transformations \
    metricName=CompositeGaps,metricNamespace=AbacusIndexer,metricValue=1,defaultValue=0 \
  --region ca-central-1
```

---

### 2. Degraded Composites (`abacus-indexer-degraded`)

**Purpose**: Counts composites where included venues < preferred quorum.

**Log Pattern**: `"degraded=True"`

**Example Log Line**:
```
2026-01-03 04:41:02,009 - services.abacus_indexer.aggregator.composite_aggregator - INFO - Composite: ETH/spot time=1767415200 close=3117.31 vol=160.0091 ... included=2 degraded=True
```

**Metric**:
- Namespace: `AbacusIndexer`
- Name: `DegradedComposites`
- Value: 1 per occurrence
- Default: 0

**Creation Command**:
```bash
aws logs put-metric-filter \
  --log-group-name /ecs/abacus-indexer-production \
  --filter-name "abacus-indexer-degraded" \
  --filter-pattern "\"degraded=True\"" \
  --metric-transformations \
    metricName=DegradedComposites,metricNamespace=AbacusIndexer,metricValue=1,defaultValue=0 \
  --region ca-central-1
```

---

### 3. Connector Reconnects (`abacus-indexer-reconnects`)

**Purpose**: Counts WebSocket reconnection attempts (indicates instability).

**Log Pattern**: `"Reconnecting in"`

**Example Log Line**:
```
2026-01-03 04:15:32,456 - services.abacus_indexer.connectors.base - INFO - [binance/spot/BTC] Reconnecting in 2000ms (attempt 3)
```

**Metric**:
- Namespace: `AbacusIndexer`
- Name: `ConnectorReconnects`
- Value: 1 per occurrence
- Default: 0

**Creation Command**:
```bash
aws logs put-metric-filter \
  --log-group-name /ecs/abacus-indexer-production \
  --filter-name "abacus-indexer-reconnects" \
  --filter-pattern "\"Reconnecting in\"" \
  --metric-transformations \
    metricName=ConnectorReconnects,metricNamespace=AbacusIndexer,metricValue=1,defaultValue=0 \
  --region ca-central-1
```

---

### 4. Database Errors (`abacus-indexer-db-errors`)

**Purpose**: Counts database connection or write failures.

**Log Pattern**: `"Failed to connect to database" OR "Database write error" OR "DB error"`

**Example Log Lines**:
```
2026-01-03 04:15:32,456 - services.abacus_indexer.app.main - ERROR - Failed to connect to database: connection refused
2026-01-03 04:15:32,456 - services.abacus_indexer.persistence.pool - ERROR - Database write error: timeout
```

**Metric**:
- Namespace: `AbacusIndexer`
- Name: `DatabaseErrors`
- Value: 1 per occurrence
- Default: 0

**Creation Command**:
```bash
aws logs put-metric-filter \
  --log-group-name /ecs/abacus-indexer-production \
  --filter-name "abacus-indexer-db-errors" \
  --filter-pattern "\"Failed to connect to database\" OR \"Database write error\" OR \"DB error\"" \
  --metric-transformations \
    metricName=DatabaseErrors,metricNamespace=AbacusIndexer,metricValue=1,defaultValue=0 \
  --region ca-central-1
```

---

### 5. Healthy Composites (`abacus-indexer-composite-ok`)

**Purpose**: Counts successful non-degraded composite calculations (for dashboards).

**Log Pattern**: `"Composite:" "degraded=False"`

**Example Log Line**:
```
2026-01-03 04:37:02,011 - services.abacus_indexer.aggregator.composite_aggregator - INFO - Composite: BTC/spot time=1767414960 close=90226.68 vol=1.2435 ... included=3 degraded=False
```

**Metric**:
- Namespace: `AbacusIndexer`
- Name: `HealthyComposites`
- Value: 1 per occurrence
- Default: 0

**Creation Command**:
```bash
aws logs put-metric-filter \
  --log-group-name /ecs/abacus-indexer-production \
  --filter-name "abacus-indexer-composite-ok" \
  --filter-pattern "\"Composite:\" \"degraded=False\"" \
  --metric-transformations \
    metricName=HealthyComposites,metricNamespace=AbacusIndexer,metricValue=1,defaultValue=0 \
  --region ca-central-1
```

---

## Alarms

### 1. High Gap Rate (`abacus-indexer-high-gap-rate`)

**Purpose**: Alert when too many composite bars are gaps.

**Threshold Logic**:
- Normal: 4 composites/minute × 5 minutes = 20 composites
- 5 gaps in 5 minutes = 25% gap rate (unacceptable)

| Setting | Value |
|---------|-------|
| Namespace | AbacusIndexer |
| Metric | CompositeGaps |
| Statistic | Sum |
| Period | 300 seconds (5 min) |
| Threshold | > 5 |
| Evaluation Periods | 1 |
| Actions | SNS: abacus-indexer-alerts |

**Creation Command**:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "abacus-indexer-high-gap-rate" \
  --alarm-description "Too many gaps in composite bars (>5 in 5 min)" \
  --namespace AbacusIndexer \
  --metric-name CompositeGaps \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:ca-central-1:484907497221:abacus-indexer-alerts \
  --region ca-central-1
```

---

### 2. High Degraded Rate (`abacus-indexer-high-degraded-rate`)

**Purpose**: Alert when too many composites are below preferred quorum.

**Threshold Logic**:
- Normal: 4 composites/minute × 5 minutes = 20 composites
- 10 degraded in 5 minutes = 50% degraded rate

| Setting | Value |
|---------|-------|
| Namespace | AbacusIndexer |
| Metric | DegradedComposites |
| Statistic | Sum |
| Period | 300 seconds (5 min) |
| Threshold | > 10 |
| Evaluation Periods | 1 |
| Actions | SNS: abacus-indexer-alerts |

**Creation Command**:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "abacus-indexer-high-degraded-rate" \
  --alarm-description "Too many degraded composites (>10 in 5 min)" \
  --namespace AbacusIndexer \
  --metric-name DegradedComposites \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:ca-central-1:484907497221:abacus-indexer-alerts \
  --region ca-central-1
```

---

### 3. Connector Instability (`abacus-indexer-connector-instability`)

**Purpose**: Alert when connectors are repeatedly reconnecting.

**Threshold Logic**:
- 14 connectors total (2 assets × 4 spot + 2 assets × 3 perp)
- 3 reconnects in 5 minutes suggests systemic issue

| Setting | Value |
|---------|-------|
| Namespace | AbacusIndexer |
| Metric | ConnectorReconnects |
| Statistic | Sum |
| Period | 300 seconds (5 min) |
| Threshold | > 3 |
| Evaluation Periods | 1 |
| Actions | SNS: abacus-indexer-alerts |

**Creation Command**:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "abacus-indexer-connector-instability" \
  --alarm-description "Connector reconnects indicate instability (>3 in 5 min)" \
  --namespace AbacusIndexer \
  --metric-name ConnectorReconnects \
  --statistic Sum \
  --period 300 \
  --threshold 3 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:ca-central-1:484907497221:abacus-indexer-alerts \
  --region ca-central-1
```

---

### 4. Database Errors (`abacus-indexer-database-errors`)

**Purpose**: Alert on ANY database errors (critical).

**Threshold Logic**:
- Database errors are never acceptable in normal operation
- Any error requires immediate attention

| Setting | Value |
|---------|-------|
| Namespace | AbacusIndexer |
| Metric | DatabaseErrors |
| Statistic | Sum |
| Period | 300 seconds (5 min) |
| Threshold | > 0 |
| Evaluation Periods | 1 |
| Actions | SNS: abacus-indexer-alerts |

**Creation Command**:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "abacus-indexer-database-errors" \
  --alarm-description "Database errors detected (any in 5 min)" \
  --namespace AbacusIndexer \
  --metric-name DatabaseErrors \
  --statistic Sum \
  --period 300 \
  --threshold 0 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:ca-central-1:484907497221:abacus-indexer-alerts \
  --region ca-central-1
```

---

## SNS Topic & Notifications

### Topic Details

| Property | Value |
|----------|-------|
| Name | abacus-indexer-alerts |
| ARN | arn:aws:sns:ca-central-1:484907497221:abacus-indexer-alerts |
| Region | ca-central-1 |

### Subscribing to Alerts

#### Email Subscription
```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:ca-central-1:484907497221:abacus-indexer-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --region ca-central-1
```

#### Slack Webhook (via Lambda)
1. Create Lambda function that posts to Slack webhook
2. Subscribe Lambda to SNS topic:
```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:ca-central-1:484907497221:abacus-indexer-alerts \
  --protocol lambda \
  --notification-endpoint arn:aws:lambda:ca-central-1:484907497221:function:slack-notifier \
  --region ca-central-1
```

#### PagerDuty Integration
```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:ca-central-1:484907497221:abacus-indexer-alerts \
  --protocol https \
  --notification-endpoint https://events.pagerduty.com/integration/YOUR_INTEGRATION_KEY/enqueue \
  --region ca-central-1
```

### List Current Subscriptions
```bash
aws sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:ca-central-1:484907497221:abacus-indexer-alerts \
  --region ca-central-1
```

---

## Reproduction Scripts

### Full Setup Script

Save as `scripts/setup_cloudwatch_alarms.sh`:

```bash
#!/bin/bash
# Abacus Indexer CloudWatch Alarms Setup
# Run this to recreate all monitoring infrastructure

set -e

REGION="ca-central-1"
LOG_GROUP="/ecs/abacus-indexer-production"
NAMESPACE="AbacusIndexer"
SNS_TOPIC_ARN="arn:aws:sns:ca-central-1:484907497221:abacus-indexer-alerts"

echo "=== Setting up Abacus Indexer CloudWatch Alarms ==="

# Create SNS Topic (idempotent)
echo "Creating SNS topic..."
aws sns create-topic --name abacus-indexer-alerts --region $REGION

# Create Metric Filters
echo "Creating metric filters..."

aws logs put-metric-filter \
  --log-group-name $LOG_GROUP \
  --filter-name "abacus-indexer-gaps" \
  --filter-pattern "\"GAP:\"" \
  --metric-transformations \
    metricName=CompositeGaps,metricNamespace=$NAMESPACE,metricValue=1,defaultValue=0 \
  --region $REGION

aws logs put-metric-filter \
  --log-group-name $LOG_GROUP \
  --filter-name "abacus-indexer-degraded" \
  --filter-pattern "\"degraded=True\"" \
  --metric-transformations \
    metricName=DegradedComposites,metricNamespace=$NAMESPACE,metricValue=1,defaultValue=0 \
  --region $REGION

aws logs put-metric-filter \
  --log-group-name $LOG_GROUP \
  --filter-name "abacus-indexer-reconnects" \
  --filter-pattern "\"Reconnecting in\"" \
  --metric-transformations \
    metricName=ConnectorReconnects,metricNamespace=$NAMESPACE,metricValue=1,defaultValue=0 \
  --region $REGION

aws logs put-metric-filter \
  --log-group-name $LOG_GROUP \
  --filter-name "abacus-indexer-db-errors" \
  --filter-pattern "\"Failed to connect to database\" OR \"Database write error\" OR \"DB error\"" \
  --metric-transformations \
    metricName=DatabaseErrors,metricNamespace=$NAMESPACE,metricValue=1,defaultValue=0 \
  --region $REGION

aws logs put-metric-filter \
  --log-group-name $LOG_GROUP \
  --filter-name "abacus-indexer-composite-ok" \
  --filter-pattern "\"Composite:\" \"degraded=False\"" \
  --metric-transformations \
    metricName=HealthyComposites,metricNamespace=$NAMESPACE,metricValue=1,defaultValue=0 \
  --region $REGION

# Create Alarms
echo "Creating alarms..."

aws cloudwatch put-metric-alarm \
  --alarm-name "abacus-indexer-high-gap-rate" \
  --alarm-description "Too many gaps in composite bars (>5 in 5 min)" \
  --namespace $NAMESPACE \
  --metric-name CompositeGaps \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions $SNS_TOPIC_ARN \
  --region $REGION

aws cloudwatch put-metric-alarm \
  --alarm-name "abacus-indexer-high-degraded-rate" \
  --alarm-description "Too many degraded composites (>10 in 5 min)" \
  --namespace $NAMESPACE \
  --metric-name DegradedComposites \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions $SNS_TOPIC_ARN \
  --region $REGION

aws cloudwatch put-metric-alarm \
  --alarm-name "abacus-indexer-connector-instability" \
  --alarm-description "Connector reconnects indicate instability (>3 in 5 min)" \
  --namespace $NAMESPACE \
  --metric-name ConnectorReconnects \
  --statistic Sum \
  --period 300 \
  --threshold 3 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions $SNS_TOPIC_ARN \
  --region $REGION

aws cloudwatch put-metric-alarm \
  --alarm-name "abacus-indexer-database-errors" \
  --alarm-description "Database errors detected (any in 5 min)" \
  --namespace $NAMESPACE \
  --metric-name DatabaseErrors \
  --statistic Sum \
  --period 300 \
  --threshold 0 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions $SNS_TOPIC_ARN \
  --region $REGION

echo "=== Setup Complete ==="
echo ""
echo "Metric Filters:"
aws logs describe-metric-filters --log-group-name $LOG_GROUP --region $REGION \
  --query 'metricFilters[*].filterName' --output table

echo ""
echo "Alarms:"
aws cloudwatch describe-alarms --alarm-name-prefix "abacus-indexer" --region $REGION \
  --query 'MetricAlarms[*].[AlarmName,StateValue]' --output table
```

### Teardown Script

Save as `scripts/teardown_cloudwatch_alarms.sh`:

```bash
#!/bin/bash
# Remove all Abacus Indexer CloudWatch alarms and metric filters

set -e

REGION="ca-central-1"
LOG_GROUP="/ecs/abacus-indexer-production"

echo "=== Removing Abacus Indexer CloudWatch Alarms ==="

# Delete Alarms
echo "Deleting alarms..."
aws cloudwatch delete-alarms \
  --alarm-names \
    "abacus-indexer-high-gap-rate" \
    "abacus-indexer-high-degraded-rate" \
    "abacus-indexer-connector-instability" \
    "abacus-indexer-database-errors" \
  --region $REGION

# Delete Metric Filters
echo "Deleting metric filters..."
for filter in abacus-indexer-gaps abacus-indexer-degraded abacus-indexer-reconnects abacus-indexer-db-errors abacus-indexer-composite-ok; do
  aws logs delete-metric-filter \
    --log-group-name $LOG_GROUP \
    --filter-name $filter \
    --region $REGION 2>/dev/null || echo "Filter $filter not found"
done

echo "=== Teardown Complete ==="
```

---

## Threshold Tuning Guide

### When to Adjust Thresholds

| Scenario | Action |
|----------|--------|
| Too many false alarms | Increase threshold or evaluation periods |
| Missing real incidents | Decrease threshold |
| Normal operation changed | Re-baseline based on new behavior |
| New venues added | May need to adjust expected counts |

### Adjusting a Threshold

Example: Change gap rate threshold from 5 to 10:

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "abacus-indexer-high-gap-rate" \
  --alarm-description "Too many gaps in composite bars (>10 in 5 min)" \
  --namespace AbacusIndexer \
  --metric-name CompositeGaps \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:ca-central-1:484907497221:abacus-indexer-alerts \
  --region ca-central-1
```

### Recommended Baseline Values

Based on 30-minute soak test (2026-01-03):

| Metric | Observed Normal | Current Threshold | Recommended |
|--------|-----------------|-------------------|-------------|
| Gaps | 0-2 per 5 min | > 5 | Keep |
| Degraded | 0-3 per 5 min | > 10 | Keep |
| Reconnects | 0 per 5 min | > 3 | Keep |
| DB Errors | 0 per 5 min | > 0 | Keep |

---

## Troubleshooting

### Alarm States Explained

| State | Meaning |
|-------|---------|
| OK | Metric within threshold |
| ALARM | Metric exceeded threshold |
| INSUFFICIENT_DATA | Not enough data points yet (normal for new metrics) |

### Common Issues

#### 1. Alarm stuck in INSUFFICIENT_DATA

**Cause**: Metric filter pattern not matching any logs.

**Diagnosis**:
```bash
# Check if logs match the pattern
aws logs filter-log-events \
  --log-group-name /ecs/abacus-indexer-production \
  --filter-pattern "\"GAP:\"" \
  --limit 5 \
  --region ca-central-1
```

**Resolution**: Verify log format matches filter pattern exactly.

#### 2. False positive on database-errors alarm

**Cause**: Log message contains "DB error" in a non-error context.

**Diagnosis**:
```bash
# Check what's triggering the alarm
aws logs filter-log-events \
  --log-group-name /ecs/abacus-indexer-production \
  --filter-pattern "\"Failed to connect to database\" OR \"Database write error\" OR \"DB error\"" \
  --limit 10 \
  --region ca-central-1
```

**Resolution**: Refine filter pattern to be more specific.

#### 3. Alarm not firing when expected

**Cause**: Metric not being published or threshold too high.

**Diagnosis**:
```bash
# Check metric data points
aws cloudwatch get-metric-statistics \
  --namespace AbacusIndexer \
  --metric-name CompositeGaps \
  --start-time $(date -u -v-1H '+%Y-%m-%dT%H:%M:%SZ') \
  --end-time $(date -u '+%Y-%m-%dT%H:%M:%SZ') \
  --period 300 \
  --statistics Sum \
  --region ca-central-1
```

**Resolution**: Lower threshold or check metric filter.

---

## Issue Resolution Procedures

### High Gap Rate Alarm

**Severity**: High

**Symptoms**:
- `/v0/latest` returns old prices
- `/v0/integrity` shows elevated gap_rate

**Immediate Actions**:
1. Check which market is gapping:
   ```bash
   aws logs filter-log-events \
     --log-group-name /ecs/abacus-indexer-production \
     --filter-pattern "\"GAP:\"" \
     --limit 20 \
     --region ca-central-1
   ```

2. Check connector health:
   ```bash
   curl -s "https://ALB/indexer/v0/telemetry" | jq '.venues'
   ```

3. If specific venue down, check exchange status pages

**Resolution**:
- If exchange outage: Wait for recovery, gaps will be backfilled
- If connector bug: Restart ECS task
- If network issue: Check VPC/NAT gateway

---

### High Degraded Rate Alarm

**Severity**: Medium

**Symptoms**:
- Composites computed with fewer venues than preferred
- Higher price variance possible

**Immediate Actions**:
1. Check which venues are excluded:
   ```bash
   curl -s "https://ALB/indexer/v0/latest" | jq '.[] | {asset, market_type, included_venues}'
   ```

2. Check for stale venues:
   ```bash
   curl -s "https://ALB/indexer/v0/telemetry" | jq '.venues[] | select(.is_stale == true)'
   ```

**Resolution**:
- If venue stale: Check stale thresholds in constants.py
- If venue disconnected: Check connector logs for errors
- If outlier: Check for exchange-specific issues

---

### Connector Instability Alarm

**Severity**: High

**Symptoms**:
- Frequent WebSocket disconnections
- Gaps in data during reconnection windows

**Immediate Actions**:
1. Identify affected connector:
   ```bash
   aws logs filter-log-events \
     --log-group-name /ecs/abacus-indexer-production \
     --filter-pattern "\"Reconnecting in\"" \
     --limit 20 \
     --region ca-central-1
   ```

2. Check for pattern (specific venue vs. all):
   - Single venue: Exchange or network issue
   - All venues: Container or VPC issue

**Resolution**:
- Single venue: Check exchange status, wait for stability
- All venues: Restart ECS task, check NAT gateway/ENI limits
- Persistent: Increase reconnect thresholds in constants.py

---

### Database Errors Alarm

**Severity**: Critical

**Symptoms**:
- Data not being persisted
- `/v0/candles` returns stale data
- Gaps will not be backfillable

**Immediate Actions**:
1. Check RDS status:
   ```bash
   aws rds describe-db-instances \
     --db-instance-identifier abacus-indexer-db \
     --region ca-central-1 \
     --query 'DBInstances[0].DBInstanceStatus'
   ```

2. Check connection pool errors:
   ```bash
   aws logs filter-log-events \
     --log-group-name /ecs/abacus-indexer-production \
     --filter-pattern "\"database\" \"error\"" \
     --limit 20 \
     --region ca-central-1
   ```

3. Check RDS metrics:
   - CPU utilization
   - Connection count
   - Free storage

**Resolution**:
- If RDS unavailable: Check RDS events, may need failover
- If connection exhaustion: Increase max_connections or restart task
- If storage full: Increase storage or run retention cleanup

---

## Maintenance

### Regular Checks

**Daily**:
- Verify all alarms in OK state
- Check for any INSUFFICIENT_DATA (may indicate logging issue)

**Weekly**:
- Review alarm history for patterns
- Check metric trends for anomalies

**Monthly**:
- Audit threshold values against recent data
- Review and update this documentation

### Updating Log Patterns

If application log format changes:

1. Identify new pattern in logs
2. Test pattern:
   ```bash
   aws logs filter-log-events \
     --log-group-name /ecs/abacus-indexer-production \
     --filter-pattern "NEW_PATTERN" \
     --limit 5 \
     --region ca-central-1
   ```
3. Update metric filter:
   ```bash
   aws logs put-metric-filter \
     --log-group-name /ecs/abacus-indexer-production \
     --filter-name "abacus-indexer-METRIC" \
     --filter-pattern "NEW_PATTERN" \
     --metric-transformations \
       metricName=METRIC_NAME,metricNamespace=AbacusIndexer,metricValue=1,defaultValue=0 \
     --region ca-central-1
   ```

### Verification Commands

Check all resources exist:
```bash
# Metric Filters
aws logs describe-metric-filters \
  --log-group-name /ecs/abacus-indexer-production \
  --region ca-central-1 \
  --query 'metricFilters[*].filterName'

# Alarms
aws cloudwatch describe-alarms \
  --alarm-name-prefix "abacus-indexer" \
  --region ca-central-1 \
  --query 'MetricAlarms[*].[AlarmName,StateValue]' \
  --output table

# SNS Subscriptions
aws sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:ca-central-1:484907497221:abacus-indexer-alerts \
  --region ca-central-1
```

---

## Appendix: Related Documents

- `plans/ABACUS_INDEXER_BUILD_VS_DESIGN_ANALYSIS.md` - System architecture
- `plans/SOAK_TEST_V0121_ARTIFACT.md` - Soak test results
- `services/abacus_indexer/core/constants.py` - Threshold configurations
- `services/abacus_indexer/connectors/base.py` - Reconnection logic

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-03 | Claude Code | Initial creation |
