"""
Abacus Indexer Constants

Central configuration for thresholds, intervals, and venue settings.
Matches POC constants.ts with production frozen values.

IMPORTANT: These values are frozen per ABACUS_INDEXER_V0_CONTRACT_FREEZE.md.
Changes require stakeholder sign-off.
"""

from typing import Literal

from .types import AssetId, MarketType, QuoteCurrency, VenueConfig, VenueId


# =============================================================================
# Outlier Detection (FROZEN)
# =============================================================================

# Maximum deviation from median before a venue is excluded (in basis points)
# 100 bps = 1.0%
# This is intentionally conservative for BTC/ETH where normal spreads are 5-50 bps.
OUTLIER_THRESHOLD_BPS: int = 100

# Convert bps threshold to decimal for calculations
OUTLIER_THRESHOLD_DECIMAL: float = OUTLIER_THRESHOLD_BPS / 10000  # 0.01


# =============================================================================
# Quorum Configuration (FROZEN)
# =============================================================================

class QuorumPolicy:
    """Quorum policy configuration."""
    def __init__(
        self,
        min_quorum: int,
        preferred_quorum: int,
        allow_single_source: bool,
    ):
        self.min_quorum = min_quorum
        self.preferred_quorum = preferred_quorum
        self.allow_single_source = allow_single_source


QUORUM_POLICIES = {
    # POC policy: allow 1-of-N fallback but mark as degraded
    "poc": QuorumPolicy(
        min_quorum=1,
        preferred_quorum=2,
        allow_single_source=True,
    ),
    # Production policy: require proper quorum, output null when below
    "production": QuorumPolicy(
        min_quorum=2,
        preferred_quorum=3,
        allow_single_source=False,
    ),
}

# FROZEN: Production uses strict quorum
CURRENT_QUORUM_POLICY: Literal["poc", "production"] = "production"


def get_quorum_config() -> QuorumPolicy:
    """Get the active quorum configuration."""
    return QUORUM_POLICIES[CURRENT_QUORUM_POLICY]


# =============================================================================
# Stale Detection (FROZEN with Amendment 1)
# =============================================================================

# Per-venue stale thresholds (ms)
# A venue is considered stale if no trade/update has been received for this duration.
# Stale venues are excluded from composite calculation same as disconnected venues.
#
# Amendment 1 (2025-12-31): Bybit perp increased from 10,000ms to 15,000ms
# based on cadence validation showing p99 at 11,399ms from ca-central-1.
STALE_THRESHOLDS_MS: dict[VenueId, dict[MarketType, int]] = {
    VenueId.BINANCE: {MarketType.SPOT: 10_000, MarketType.PERP: 10_000},
    VenueId.COINBASE: {MarketType.SPOT: 30_000, MarketType.PERP: 30_000},
    VenueId.KRAKEN: {MarketType.SPOT: 30_000, MarketType.PERP: 30_000},
    VenueId.OKX: {MarketType.SPOT: 15_000, MarketType.PERP: 15_000},
    VenueId.BYBIT: {MarketType.SPOT: 15_000, MarketType.PERP: 15_000},  # Amendment 1
}

# Default stale threshold for unknown venue/market combinations
DEFAULT_STALE_THRESHOLD_MS: int = 30_000


def get_stale_threshold(venue: VenueId, market_type: MarketType) -> int:
    """Get stale threshold for a specific venue and market type."""
    venue_thresholds = STALE_THRESHOLDS_MS.get(venue, {})
    return venue_thresholds.get(market_type, DEFAULT_STALE_THRESHOLD_MS)


# =============================================================================
# Bar Building
# =============================================================================

# Bar interval in seconds (1 minute)
BAR_INTERVAL_SECONDS: int = 60

# Maximum trades to buffer per venue for current minute
# Prevents memory issues with high-frequency feeds
MAX_TRADE_BUFFER_SIZE: int = 5_000

# Maximum completed bars to retain per venue (~16 hours at 1m resolution)
MAX_BARS_PER_VENUE: int = 1_000

# Ring buffer size for telemetry (message rate calculation)
TELEMETRY_RING_BUFFER_SIZE: int = 100


# =============================================================================
# Telemetry
# =============================================================================

# How often to compute telemetry metrics (ms)
TELEMETRY_UPDATE_INTERVAL_MS: int = 5_000

# Sliding window for message rate calculation (ms)
MESSAGE_RATE_WINDOW_MS: int = 60_000


# =============================================================================
# SSE Configuration
# =============================================================================

# Price update cadence for SSE stream (ms)
SSE_PRICE_CADENCE_MS: int = 500

# Telemetry update cadence for SSE stream (ms)
SSE_TELEMETRY_CADENCE_MS: int = 5_000


# =============================================================================
# Venue Configurations
# =============================================================================

VENUE_CONFIGS: dict[VenueId, VenueConfig] = {
    VenueId.BINANCE: VenueConfig(
        id=VenueId.BINANCE,
        name="Binance",
        color="#F0B90B",
        quote_currency=QuoteCurrency.USDT,
        supports_spot=True,
        supports_perp=True,
        ws_endpoint_spot="wss://stream.binance.com:9443/ws",
        ws_endpoint_perp="wss://fstream.binance.com/ws",
    ),
    VenueId.COINBASE: VenueConfig(
        id=VenueId.COINBASE,
        name="Coinbase",
        color="#0052FF",
        quote_currency=QuoteCurrency.USD,
        supports_spot=True,
        supports_perp=False,
        ws_endpoint_spot="wss://ws-feed.exchange.coinbase.com",
    ),
    VenueId.KRAKEN: VenueConfig(
        id=VenueId.KRAKEN,
        name="Kraken",
        color="#5741D9",
        quote_currency=QuoteCurrency.USD,
        supports_spot=True,
        supports_perp=False,
        ws_endpoint_spot="wss://ws.kraken.com",
    ),
    VenueId.OKX: VenueConfig(
        id=VenueId.OKX,
        name="OKX",
        color="#FFFFFF",
        quote_currency=QuoteCurrency.USDT,
        supports_spot=True,
        supports_perp=True,
        ws_endpoint_spot="wss://ws.okx.com:8443/ws/v5/public",
        ws_endpoint_perp="wss://ws.okx.com:8443/ws/v5/public",
    ),
    VenueId.BYBIT: VenueConfig(
        id=VenueId.BYBIT,
        name="Bybit",
        color="#F7A600",
        quote_currency=QuoteCurrency.USDT,
        supports_spot=False,
        supports_perp=True,
        ws_endpoint_perp="wss://stream.bybit.com/v5/public/linear",
    ),
}


# =============================================================================
# Enabled Venues (Production v0)
# =============================================================================

ENABLED_SPOT_VENUES: list[VenueId] = [
    VenueId.BINANCE,
    VenueId.COINBASE,
    VenueId.OKX,
    VenueId.KRAKEN,
]

ENABLED_PERP_VENUES: list[VenueId] = [
    VenueId.BINANCE,
    VenueId.OKX,
    VenueId.BYBIT,
]

ENABLED_ASSETS: list[AssetId] = [
    AssetId.BTC,
    AssetId.ETH,
]


def get_enabled_venues(market_type: MarketType) -> list[VenueId]:
    """Get enabled venues for a market type."""
    if market_type == MarketType.SPOT:
        return ENABLED_SPOT_VENUES
    return ENABLED_PERP_VENUES


# =============================================================================
# Venue Roles: Realtime vs Backfill (Option A Architecture)
# =============================================================================
# Per COINBASE_BACKFILL_ARCHITECTURE_DECISION.md:
# - REALTIME venues contribute via WebSocket to live composite bars
# - BACKFILL venues support historical REST API queries for gap repair
# - Coinbase is REALTIME-only (no historical time-range API)
#
# Decision tree for new venues:
# 1. Does it have a historical trades API with time-range queries?
#    - YES: Add to both REALTIME_VENUES and BACKFILL_VENUES
#    - NO:  Add to REALTIME_VENUES only (like Coinbase)

# All venues that contribute to realtime composite formation
REALTIME_VENUES: set[VenueId] = {
    VenueId.BINANCE,
    VenueId.COINBASE,
    VenueId.KRAKEN,
    VenueId.OKX,
    VenueId.BYBIT,
}

# Venues with historical REST APIs suitable for backfill
# Coinbase excluded: /trades only returns recent ~1000 trades, no time-range queries
BACKFILL_VENUES: set[VenueId] = {
    VenueId.BINANCE,   # aggTrades with fromId + startTime/endTime (full historical)
    VenueId.KRAKEN,    # Trades with since param (full historical)
    VenueId.OKX,       # history-trades with after/before cursor (full historical)
    VenueId.BYBIT,     # recent-trade only (~1000 trades, no time-range) - RECENT-ONLY
}

# Venues with IMPLEMENTED REST backfill fetchers in BackfillService
# This is the gate for actual backfill operations
# Add venues here as their fetchers are implemented in backfill/service.py
BACKFILL_FETCHERS_IMPLEMENTED: set[VenueId] = {
    VenueId.BINANCE,   # _fetch_binance_trades() - full historical support
    VenueId.KRAKEN,    # _fetch_kraken_trades() - full historical support
    VenueId.OKX,       # _fetch_okx_trades() - full historical support
    VenueId.BYBIT,     # _fetch_bybit_trades() - RECENT-ONLY (public endpoint)
}

# Venues excluded from backfill (for explicit exclusion marking)
BACKFILL_EXCLUDED_VENUES: set[VenueId] = REALTIME_VENUES - BACKFILL_VENUES


def get_backfill_venues(market_type: MarketType) -> list[VenueId]:
    """
    Get venues available for backfill for a market type.

    Returns only venues that:
    1. Are enabled for this market type
    2. Support historical backfill (in BACKFILL_VENUES)
    3. Have implemented REST fetchers (in BACKFILL_FETCHERS_IMPLEMENTED)
    """
    enabled = get_enabled_venues(market_type)
    return [v for v in enabled if v in BACKFILL_VENUES and v in BACKFILL_FETCHERS_IMPLEMENTED]


def is_backfill_supported(venue: VenueId) -> bool:
    """Check if a venue supports historical backfill."""
    return venue in BACKFILL_VENUES


def is_backfill_fetcher_implemented(venue: VenueId) -> bool:
    """Check if a venue has an implemented REST backfill fetcher."""
    return venue in BACKFILL_FETCHERS_IMPLEMENTED


# =============================================================================
# Funding Rate Configuration
# =============================================================================

# Funding rate ingestion is REST-based (not WebSocket)
# Rates update every 8 hours, so polling every minute is sufficient
FUNDING_POLL_INTERVAL_MS: int = 60_000

FUNDING_ENDPOINTS: dict[VenueId, str] = {
    VenueId.BINANCE: "https://fapi.binance.com/fapi/v1/premiumIndex",
    VenueId.OKX: "https://www.okx.com/api/v5/public/funding-rate",
    VenueId.BYBIT: "https://api.bybit.com/v5/market/tickers?category=linear",
}


# =============================================================================
# Reconnection Configuration
# =============================================================================

# Initial reconnect delay (ms)
RECONNECT_INITIAL_DELAY_MS: int = 1_000

# Maximum reconnect delay (ms)
RECONNECT_MAX_DELAY_MS: int = 60_000

# Reconnect backoff multiplier
RECONNECT_BACKOFF_MULTIPLIER: float = 2.0

# Maximum reconnect attempts before alerting (per venue per window)
RECONNECT_ALERT_THRESHOLD: int = 5

# Window for counting reconnects (ms)
RECONNECT_ALERT_WINDOW_MS: int = 300_000  # 5 minutes
