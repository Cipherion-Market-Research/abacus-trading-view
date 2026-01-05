"""
Prometheus Metrics for Abacus Indexer

Exposes operational metrics for monitoring and alerting.

Metrics:
- Composite bar counters (total, gaps, degraded)
- Venue connection gauges
- Venue message/trade counters
- Processing latency histograms
"""

from prometheus_client import Counter, Gauge, Histogram, CollectorRegistry

# Create a custom registry to avoid conflicts with default registry
REGISTRY = CollectorRegistry()


# =============================================================================
# Composite Bar Metrics
# =============================================================================

# Total composite bars produced
COMPOSITE_BARS_TOTAL = Counter(
    "abacus_composite_bars_total",
    "Total composite bars produced",
    ["asset", "market_type"],
    registry=REGISTRY,
)

# Gap bars (below minimum quorum)
GAP_BARS_TOTAL = Counter(
    "abacus_gap_bars_total",
    "Total gap bars (below minimum quorum)",
    ["asset", "market_type"],
    registry=REGISTRY,
)

# Degraded bars (below preferred quorum but above minimum)
DEGRADED_BARS_TOTAL = Counter(
    "abacus_degraded_bars_total",
    "Total degraded bars (below preferred quorum)",
    ["asset", "market_type"],
    registry=REGISTRY,
)

# Venues included in composite
VENUES_INCLUDED = Histogram(
    "abacus_venues_included",
    "Number of venues included in composite bar",
    ["asset", "market_type"],
    buckets=[0, 1, 2, 3, 4, 5],
    registry=REGISTRY,
)


# =============================================================================
# Venue Connection Metrics
# =============================================================================

# Venue connection status (1=connected, 0=disconnected)
VENUE_CONNECTED = Gauge(
    "abacus_venue_connected",
    "Venue WebSocket connection status (1=connected, 0=disconnected)",
    ["venue", "asset", "market_type"],
    registry=REGISTRY,
)

# Venue uptime percentage
VENUE_UPTIME = Gauge(
    "abacus_venue_uptime_percent",
    "Venue uptime percentage since service start",
    ["venue", "asset", "market_type"],
    registry=REGISTRY,
)

# Venue reconnect counter
VENUE_RECONNECTS = Counter(
    "abacus_venue_reconnects_total",
    "Total venue WebSocket reconnections",
    ["venue", "asset", "market_type"],
    registry=REGISTRY,
)

# Venue message counter
VENUE_MESSAGES = Counter(
    "abacus_venue_messages_total",
    "Total messages received from venue WebSocket",
    ["venue", "asset", "market_type"],
    registry=REGISTRY,
)

# Venue trade counter
VENUE_TRADES = Counter(
    "abacus_venue_trades_total",
    "Total trades processed from venue",
    ["venue", "asset", "market_type"],
    registry=REGISTRY,
)


# =============================================================================
# Database Metrics
# =============================================================================

# Database write success counter
DB_WRITES_TOTAL = Counter(
    "abacus_db_writes_total",
    "Total database write operations",
    ["table", "status"],  # status: success, error
    registry=REGISTRY,
)

# Database write latency
DB_WRITE_LATENCY = Histogram(
    "abacus_db_write_latency_seconds",
    "Database write latency in seconds",
    ["table"],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
    registry=REGISTRY,
)


# =============================================================================
# Service Info Metrics
# =============================================================================

# Service info (version, environment)
SERVICE_INFO = Gauge(
    "abacus_service_info",
    "Service information",
    ["version", "environment"],
    registry=REGISTRY,
)


# =============================================================================
# Helper Functions
# =============================================================================

def record_composite_bar(asset: str, market_type: str, is_gap: bool, is_degraded: bool, venue_count: int) -> None:
    """Record metrics for a produced composite bar."""
    COMPOSITE_BARS_TOTAL.labels(asset=asset, market_type=market_type).inc()
    VENUES_INCLUDED.labels(asset=asset, market_type=market_type).observe(venue_count)

    if is_gap:
        GAP_BARS_TOTAL.labels(asset=asset, market_type=market_type).inc()
    elif is_degraded:
        DEGRADED_BARS_TOTAL.labels(asset=asset, market_type=market_type).inc()


def update_venue_status(
    venue: str,
    asset: str,
    market_type: str,
    connected: bool,
    uptime_percent: float,
) -> None:
    """Update venue connection status metrics."""
    VENUE_CONNECTED.labels(
        venue=venue, asset=asset, market_type=market_type
    ).set(1 if connected else 0)

    VENUE_UPTIME.labels(
        venue=venue, asset=asset, market_type=market_type
    ).set(uptime_percent)


def increment_venue_reconnects(venue: str, asset: str, market_type: str) -> None:
    """Increment venue reconnect counter."""
    VENUE_RECONNECTS.labels(
        venue=venue, asset=asset, market_type=market_type
    ).inc()


def add_venue_messages(venue: str, asset: str, market_type: str, count: int) -> None:
    """Add to venue message counter."""
    VENUE_MESSAGES.labels(
        venue=venue, asset=asset, market_type=market_type
    ).inc(count)


def add_venue_trades(venue: str, asset: str, market_type: str, count: int) -> None:
    """Add to venue trade counter."""
    VENUE_TRADES.labels(
        venue=venue, asset=asset, market_type=market_type
    ).inc(count)


def record_db_write(table: str, success: bool, latency_seconds: float) -> None:
    """Record database write metrics."""
    status = "success" if success else "error"
    DB_WRITES_TOTAL.labels(table=table, status=status).inc()
    if success:
        DB_WRITE_LATENCY.labels(table=table).observe(latency_seconds)


def set_service_info(version: str, environment: str) -> None:
    """Set service info gauge."""
    SERVICE_INFO.labels(version=version, environment=environment).set(1)
