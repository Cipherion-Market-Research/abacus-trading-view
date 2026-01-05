# Abacus Indexer Core Modules
# Ported from POC TypeScript implementation
"""
Core business logic for composite price calculation.

Modules:
- types: Canonical type definitions (Pydantic models)
- constants: Configuration constants and thresholds
- symbol_mapping: Venue-specific symbol mapping
- bar_builder: OHLCV bar construction from trades
- outlier_filter: Median-based outlier detection
"""

from .types import (
    AssetId,
    Bar,
    BasisFeatures,
    CompositeBar,
    CompositePrice,
    ConnectionState,
    DegradedReason,
    ExcludedVenue,
    ExcludeReason,
    MarketType,
    Trade,
    VenueConfig,
    VenueContribution,
    VenueId,
    VenueTelemetry,
)

from .constants import (
    BAR_INTERVAL_SECONDS,
    BACKFILL_EXCLUDED_VENUES,
    BACKFILL_FETCHERS_IMPLEMENTED,
    BACKFILL_VENUES,
    OUTLIER_THRESHOLD_BPS,
    REALTIME_VENUES,
    VENUE_CONFIGS,
    get_backfill_venues,
    get_enabled_venues,
    get_quorum_config,
    get_stale_threshold,
    is_backfill_fetcher_implemented,
    is_backfill_supported,
)

from .symbol_mapping import (
    get_symbol,
    get_stream_name,
    venue_supports_market,
    build_subscription_message,
)

from .bar_builder import (
    BarBuilder,
    floor_to_minute,
)

from .outlier_filter import (
    VenuePriceInput,
    filter_outliers,
    calculate_median,
    build_composite_bar,
    build_composite_price,
)

__all__ = [
    # Types
    "AssetId",
    "Bar",
    "BasisFeatures",
    "CompositeBar",
    "CompositePrice",
    "ConnectionState",
    "DegradedReason",
    "ExcludedVenue",
    "ExcludeReason",
    "MarketType",
    "Trade",
    "VenueConfig",
    "VenueContribution",
    "VenueId",
    "VenueTelemetry",
    # Constants
    "BAR_INTERVAL_SECONDS",
    "BACKFILL_EXCLUDED_VENUES",
    "BACKFILL_FETCHERS_IMPLEMENTED",
    "BACKFILL_VENUES",
    "OUTLIER_THRESHOLD_BPS",
    "REALTIME_VENUES",
    "VENUE_CONFIGS",
    "get_backfill_venues",
    "get_enabled_venues",
    "get_quorum_config",
    "get_stale_threshold",
    "is_backfill_fetcher_implemented",
    "is_backfill_supported",
    # Symbol Mapping
    "get_symbol",
    "get_stream_name",
    "venue_supports_market",
    "build_subscription_message",
    # Bar Builder
    "BarBuilder",
    "floor_to_minute",
    # Outlier Filter
    "VenuePriceInput",
    "filter_outliers",
    "calculate_median",
    "build_composite_bar",
    "build_composite_price",
]
