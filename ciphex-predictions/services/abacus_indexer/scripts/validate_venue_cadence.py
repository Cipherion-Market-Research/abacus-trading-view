#!/usr/bin/env python3
"""
Venue Cadence Validation Script

Validates WebSocket connectivity from the deployment region (ca-central-1) and
measures inter-message gap distributions against stale thresholds.

This script is Phase 1b of the Abacus Indexer deployment — run BEFORE
investing in connector code to de-risk the deployment environment.

Usage:
    python scripts/validate_venue_cadence.py --duration 300  # 5 minutes
    python scripts/validate_venue_cadence.py --venue binance --market spot
    python scripts/validate_venue_cadence.py --all --duration 600  # 10 minutes, all venues

Output:
    - Per-venue inter-message gap distributions (p50, p95, p99, max)
    - Comparison against STALE_THRESHOLDS_MS
    - GO/NO-GO recommendation per venue

References:
    - Stale thresholds: plans/abacus-index/constants.ts:86
    - Validation criteria: plans/abacus-index/plans/ABACUS_INDEXER_V0_IMPLEMENTATION_SPEC.md
"""

import argparse
import asyncio
import json
import ssl
import statistics
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

try:
    import websockets
except ImportError:
    print("ERROR: websockets library not installed. Run: pip install websockets")
    sys.exit(1)


# =============================================================================
# Configuration (from constants.ts)
# =============================================================================

STALE_THRESHOLDS_MS = {
    "binance": {"spot": 10_000, "perp": 10_000},
    "coinbase": {"spot": 30_000, "perp": 30_000},
    "kraken": {"spot": 30_000, "perp": 30_000},
    "okx": {"spot": 15_000, "perp": 15_000},
    "bybit": {"spot": 15_000, "perp": 10_000},
}

# WebSocket endpoints (from constants.ts)
WS_ENDPOINTS = {
    "binance": {
        "spot": "wss://stream.binance.com:9443/ws",
        "perp": "wss://fstream.binance.com/ws",
    },
    "coinbase": {
        "spot": "wss://ws-feed.exchange.coinbase.com",
    },
    "kraken": {
        "spot": "wss://ws.kraken.com",
    },
    "okx": {
        "spot": "wss://ws.okx.com:8443/ws/v5/public",
        "perp": "wss://ws.okx.com:8443/ws/v5/public",
    },
    "bybit": {
        "perp": "wss://stream.bybit.com/v5/public/linear",
    },
}

# Subscription messages (from symbolMapping.ts)
SUBSCRIPTIONS = {
    "binance": {
        "spot": {"method": "SUBSCRIBE", "params": ["btcusdt@aggTrade"], "id": 1},
        "perp": {"method": "SUBSCRIBE", "params": ["btcusdt@aggTrade"], "id": 1},
    },
    "coinbase": {
        "spot": {"type": "subscribe", "product_ids": ["BTC-USD"], "channels": ["matches"]},
    },
    "kraken": {
        "spot": {"event": "subscribe", "pair": ["XBT/USD"], "subscription": {"name": "trade"}},
    },
    "okx": {
        "spot": {"op": "subscribe", "args": [{"channel": "trades", "instId": "BTC-USDT"}]},
        "perp": {"op": "subscribe", "args": [{"channel": "trades", "instId": "BTC-USDT-SWAP"}]},
    },
    "bybit": {
        "perp": {"op": "subscribe", "args": ["publicTrade.BTCUSDT"]},
    },
}


# =============================================================================
# Data Structures
# =============================================================================

@dataclass
class VenueMetrics:
    """Metrics collected for a venue during validation."""
    venue: str
    market_type: str
    message_gaps_ms: list[float] = field(default_factory=list)
    message_count: int = 0
    first_message_time: Optional[float] = None
    last_message_time: Optional[float] = None
    errors: list[str] = field(default_factory=list)
    connected: bool = False
    connection_time_ms: Optional[float] = None


@dataclass
class ValidationResult:
    """Result of venue validation."""
    venue: str
    market_type: str
    status: str  # "GO", "NO-GO", "WARNING", "ERROR"
    stale_threshold_ms: int
    message_count: int
    duration_seconds: float
    gap_p50_ms: Optional[float] = None
    gap_p95_ms: Optional[float] = None
    gap_p99_ms: Optional[float] = None
    gap_max_ms: Optional[float] = None
    exceeds_threshold_pct: float = 0.0
    connection_time_ms: Optional[float] = None
    recommendation: str = ""
    errors: list[str] = field(default_factory=list)


# =============================================================================
# Venue Connectors
# =============================================================================

async def connect_and_collect(
    venue: str,
    market_type: str,
    duration_seconds: float,
) -> VenueMetrics:
    """
    Connect to a venue WebSocket and collect message timing metrics.
    """
    metrics = VenueMetrics(venue=venue, market_type=market_type)

    endpoint = WS_ENDPOINTS.get(venue, {}).get(market_type)
    subscription = SUBSCRIPTIONS.get(venue, {}).get(market_type)

    if not endpoint:
        metrics.errors.append(f"No endpoint configured for {venue}/{market_type}")
        return metrics

    if not subscription:
        metrics.errors.append(f"No subscription configured for {venue}/{market_type}")
        return metrics

    ssl_context = ssl.create_default_context()
    start_time = time.time()
    end_time = start_time + duration_seconds

    try:
        connect_start = time.time()
        async with websockets.connect(
            endpoint,
            ssl=ssl_context,
            ping_interval=20,
            ping_timeout=10,
            close_timeout=5,
        ) as ws:
            metrics.connection_time_ms = (time.time() - connect_start) * 1000
            metrics.connected = True

            # Send subscription
            await ws.send(json.dumps(subscription))

            # Collect messages until duration expires
            while time.time() < end_time:
                try:
                    # Set timeout to remaining duration
                    remaining = end_time - time.time()
                    if remaining <= 0:
                        break

                    msg = await asyncio.wait_for(
                        ws.recv(),
                        timeout=min(remaining, 30.0),
                    )

                    now = time.time() * 1000  # Convert to ms

                    # Skip non-trade messages (subscriptions confirmations, etc.)
                    if _is_trade_message(venue, msg):
                        if metrics.first_message_time is None:
                            metrics.first_message_time = now
                        else:
                            gap = now - metrics.last_message_time
                            metrics.message_gaps_ms.append(gap)

                        metrics.last_message_time = now
                        metrics.message_count += 1

                except asyncio.TimeoutError:
                    # No message received within timeout, continue
                    if metrics.last_message_time:
                        # Record gap from last message to now
                        now = time.time() * 1000
                        gap = now - metrics.last_message_time
                        metrics.message_gaps_ms.append(gap)
                        metrics.last_message_time = now
                    continue

    except websockets.exceptions.ConnectionClosed as e:
        metrics.errors.append(f"Connection closed: {e}")
    except Exception as e:
        metrics.errors.append(f"Error: {type(e).__name__}: {str(e)[:100]}")

    return metrics


def _is_trade_message(venue: str, msg: str) -> bool:
    """Check if a message is a trade message (not subscription confirmation, etc.)."""
    try:
        data = json.loads(msg)

        if venue == "binance":
            return data.get("e") == "aggTrade"
        elif venue == "coinbase":
            return data.get("type") == "match"
        elif venue == "kraken":
            # Kraken trade messages are arrays
            return isinstance(data, list) and len(data) >= 4
        elif venue == "okx":
            return data.get("arg", {}).get("channel") == "trades" and "data" in data
        elif venue == "bybit":
            return data.get("topic", "").startswith("publicTrade")

        return False
    except json.JSONDecodeError:
        return False


# =============================================================================
# Analysis
# =============================================================================

def analyze_metrics(metrics: VenueMetrics, duration_seconds: float) -> ValidationResult:
    """Analyze collected metrics and produce validation result."""
    stale_threshold = STALE_THRESHOLDS_MS.get(metrics.venue, {}).get(metrics.market_type, 30_000)

    result = ValidationResult(
        venue=metrics.venue,
        market_type=metrics.market_type,
        status="PENDING",  # Will be set below
        stale_threshold_ms=stale_threshold,
        message_count=metrics.message_count,
        duration_seconds=duration_seconds,
        connection_time_ms=metrics.connection_time_ms,
        errors=list(metrics.errors),
    )

    if metrics.errors and not metrics.connected:
        result.status = "ERROR"
        result.recommendation = f"Failed to connect: {metrics.errors[0]}"
        return result

    if not metrics.message_gaps_ms:
        if metrics.message_count < 2:
            result.status = "WARNING"
            result.recommendation = f"Only {metrics.message_count} messages received. Extend duration or check subscription."
        else:
            result.status = "WARNING"
            result.recommendation = "No gap data collected. Check message parsing."
        return result

    gaps = metrics.message_gaps_ms

    # Calculate percentiles
    result.gap_p50_ms = statistics.median(gaps)
    result.gap_p95_ms = _percentile(gaps, 95)
    result.gap_p99_ms = _percentile(gaps, 99)
    result.gap_max_ms = max(gaps)

    # Calculate percentage exceeding threshold
    exceeds_count = sum(1 for g in gaps if g > stale_threshold)
    result.exceeds_threshold_pct = (exceeds_count / len(gaps)) * 100

    # Determine status
    if result.gap_p99_ms > stale_threshold:
        result.status = "NO-GO"
        result.recommendation = (
            f"p99 gap ({result.gap_p99_ms:.0f}ms) exceeds stale threshold ({stale_threshold}ms). "
            f"Options: (1) Increase threshold for {metrics.venue}, (2) Move collector to different region."
        )
    elif result.gap_p95_ms > stale_threshold * 0.8:
        result.status = "WARNING"
        result.recommendation = (
            f"p95 gap ({result.gap_p95_ms:.0f}ms) approaching stale threshold ({stale_threshold}ms). "
            f"Monitor closely in production."
        )
    elif result.exceeds_threshold_pct > 1.0:
        result.status = "WARNING"
        result.recommendation = (
            f"{result.exceeds_threshold_pct:.1f}% of gaps exceed threshold. "
            f"May cause occasional stale exclusions."
        )
    else:
        result.status = "GO"
        result.recommendation = "Cadence within acceptable bounds for stale threshold."

    return result


def _percentile(data: list[float], pct: float) -> float:
    """Calculate percentile of a list."""
    if not data:
        return 0.0
    sorted_data = sorted(data)
    idx = int(len(sorted_data) * pct / 100)
    idx = min(idx, len(sorted_data) - 1)
    return sorted_data[idx]


# =============================================================================
# Main
# =============================================================================

async def validate_venue(venue: str, market_type: str, duration: float) -> ValidationResult:
    """Validate a single venue."""
    print(f"\n[{venue}/{market_type}] Connecting...")
    metrics = await connect_and_collect(venue, market_type, duration)

    if metrics.connected:
        print(f"[{venue}/{market_type}] Connected in {metrics.connection_time_ms:.0f}ms")
        print(f"[{venue}/{market_type}] Collecting for {duration}s...")

    result = analyze_metrics(metrics, duration)
    return result


async def validate_all(duration: float) -> list[ValidationResult]:
    """Validate all configured venues."""
    tasks = []

    for venue, markets in WS_ENDPOINTS.items():
        for market_type in markets.keys():
            tasks.append(validate_venue(venue, market_type, duration))

    results = await asyncio.gather(*tasks)
    return list(results)


def print_results(results: list[ValidationResult]) -> None:
    """Print validation results in a formatted table."""
    print("\n" + "=" * 100)
    print("VENUE CADENCE VALIDATION RESULTS")
    print("=" * 100)

    # Header
    print(f"{'Venue':<12} {'Market':<6} {'Status':<8} {'Msgs':<8} {'p50':<10} {'p95':<10} {'p99':<10} {'Max':<10} {'Threshold':<10} {'Exceeds%':<8}")
    print("-" * 100)

    for r in sorted(results, key=lambda x: (x.venue, x.market_type)):
        p50 = f"{r.gap_p50_ms:.0f}ms" if r.gap_p50_ms else "N/A"
        p95 = f"{r.gap_p95_ms:.0f}ms" if r.gap_p95_ms else "N/A"
        p99 = f"{r.gap_p99_ms:.0f}ms" if r.gap_p99_ms else "N/A"
        max_gap = f"{r.gap_max_ms:.0f}ms" if r.gap_max_ms else "N/A"
        threshold = f"{r.stale_threshold_ms}ms"
        exceeds = f"{r.exceeds_threshold_pct:.1f}%"

        status_icon = {"GO": "✓", "NO-GO": "✗", "WARNING": "⚠", "ERROR": "✗"}
        status = f"{status_icon.get(r.status, '?')} {r.status}"

        print(f"{r.venue:<12} {r.market_type:<6} {status:<8} {r.message_count:<8} {p50:<10} {p95:<10} {p99:<10} {max_gap:<10} {threshold:<10} {exceeds:<8}")

    # Recommendations
    print("\n" + "=" * 100)
    print("RECOMMENDATIONS")
    print("=" * 100)

    for r in sorted(results, key=lambda x: (x.status != "NO-GO", x.status != "WARNING", x.venue)):
        if r.recommendation:
            print(f"\n[{r.venue}/{r.market_type}] {r.status}")
            print(f"  → {r.recommendation}")
            if r.errors:
                for err in r.errors:
                    print(f"  ! {err}")

    # Summary
    print("\n" + "=" * 100)
    print("SUMMARY")
    print("=" * 100)

    go_count = sum(1 for r in results if r.status == "GO")
    warn_count = sum(1 for r in results if r.status == "WARNING")
    nogo_count = sum(1 for r in results if r.status == "NO-GO")
    error_count = sum(1 for r in results if r.status == "ERROR")

    print(f"GO: {go_count}  |  WARNING: {warn_count}  |  NO-GO: {nogo_count}  |  ERROR: {error_count}")

    if nogo_count > 0:
        print("\n⚠️  ACTION REQUIRED: Some venues failed validation.")
        print("   Review NO-GO recommendations before proceeding with implementation.")
    elif warn_count > 0:
        print("\n⚠️  PROCEED WITH CAUTION: Some venues have warnings.")
        print("   Monitor closely during staging soak test.")
    else:
        print("\n✓  ALL VENUES PASSED: Cadence validation successful.")
        print("   Proceed to Phase 2: Core module port.")


def main():
    parser = argparse.ArgumentParser(
        description="Validate venue WebSocket cadence against stale thresholds",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/validate_venue_cadence.py --duration 300
  python scripts/validate_venue_cadence.py --venue binance --market spot --duration 60
  python scripts/validate_venue_cadence.py --all --duration 600

This script should be run from the deployment region (ca-central-1 ECS)
to validate actual production connectivity.
        """,
    )

    parser.add_argument(
        "--duration",
        type=float,
        default=120,
        help="Duration to collect data per venue (seconds, default: 120)",
    )
    parser.add_argument(
        "--venue",
        type=str,
        choices=list(WS_ENDPOINTS.keys()),
        help="Specific venue to test",
    )
    parser.add_argument(
        "--market",
        type=str,
        choices=["spot", "perp"],
        help="Specific market type to test",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Test all venues (default if no venue specified)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON",
    )

    args = parser.parse_args()

    print("=" * 100)
    print("ABACUS INDEXER — VENUE CADENCE VALIDATION")
    print("=" * 100)
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print(f"Duration per venue: {args.duration}s")
    print()

    if args.venue and args.market:
        # Single venue/market
        results = [asyncio.run(validate_venue(args.venue, args.market, args.duration))]
    elif args.venue:
        # Single venue, all markets
        markets = WS_ENDPOINTS.get(args.venue, {}).keys()
        results = asyncio.run(asyncio.gather(*[
            validate_venue(args.venue, m, args.duration) for m in markets
        ]))
    else:
        # All venues
        results = asyncio.run(validate_all(args.duration))

    if args.json:
        output = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "duration_seconds": args.duration,
            "results": [
                {
                    "venue": r.venue,
                    "market_type": r.market_type,
                    "status": r.status,
                    "stale_threshold_ms": r.stale_threshold_ms,
                    "message_count": r.message_count,
                    "gap_p50_ms": r.gap_p50_ms,
                    "gap_p95_ms": r.gap_p95_ms,
                    "gap_p99_ms": r.gap_p99_ms,
                    "gap_max_ms": r.gap_max_ms,
                    "exceeds_threshold_pct": r.exceeds_threshold_pct,
                    "recommendation": r.recommendation,
                    "errors": r.errors,
                }
                for r in results
            ],
        }
        print(json.dumps(output, indent=2))
    else:
        print_results(results)


if __name__ == "__main__":
    main()
