"""
Abacus Indexer Core Types

Canonical type definitions matching POC types.ts.
These types define the API contract for the production service.

SERIALIZATION CONTRACT:
    Internal Python code uses snake_case (Pythonic convention).
    API responses use camelCase to match the TypeScript/UI contract.
    This is achieved via Pydantic's `alias_generator` and `populate_by_name`.

    Example:
        Internal: trade.is_buyer_maker
        API JSON: {"isBuyerMaker": true}
"""

from datetime import datetime
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


def to_camel(string: str) -> str:
    """Convert snake_case to camelCase for API serialization."""
    components = string.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


# =============================================================================
# Core Enums
# =============================================================================

class VenueId(str, Enum):
    """Supported venues for Abacus:INDEX."""
    BINANCE = "binance"
    COINBASE = "coinbase"
    KRAKEN = "kraken"
    OKX = "okx"
    BYBIT = "bybit"


class MarketType(str, Enum):
    """Market type: spot or perpetual."""
    SPOT = "spot"
    PERP = "perp"


class AssetId(str, Enum):
    """Supported assets."""
    BTC = "BTC"
    ETH = "ETH"


class QuoteCurrency(str, Enum):
    """Quote currency."""
    USD = "USD"
    USDT = "USDT"
    USDC = "USDC"


class ConnectionState(str, Enum):
    """Connection state for a venue."""
    CONNECTING = "connecting"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"


class ExcludeReason(str, Enum):
    """Reason for excluding a venue from composite."""
    DISCONNECTED = "disconnected"
    STALE = "stale"
    OUTLIER = "outlier"
    NO_DATA = "no_data"
    BACKFILL_UNAVAILABLE = "backfill_unavailable"  # Venue lacks historical API


class TakerSide(str, Enum):
    """
    Normalized taker side for trade classification.

    CRITICAL SEMANTIC DEFINITION (per POC team recommendation):
    - BUY: Taker-initiated buy (aggressive buy, lifting the ask)
    - SELL: Taker-initiated sell (aggressive sell, hitting the bid)

    This normalization ensures consistent meaning across all venues:
    - Binance: m=true → buyer was maker → taker sold → SELL
              m=false → buyer was taker → aggressive buy → BUY
    - Coinbase: side="buy" → taker bought → BUY
               side="sell" → taker sold → SELL
    - OKX/Kraken/Bybit: side field indicates taker's action
    """
    BUY = "buy"
    SELL = "sell"


class DegradedReason(str, Enum):
    """Reason for degraded mode."""
    NONE = "none"
    SINGLE_SOURCE = "single_source"
    BELOW_PREFERRED_QUORUM = "below_preferred_quorum"
    VENUE_DISCONNECTED = "venue_disconnected"
    VENUE_STALE = "venue_stale"
    VENUE_OUTLIER = "venue_outlier"


# =============================================================================
# Trade & Bar Types
# =============================================================================

class Trade(BaseModel):
    """Canonical trade representation (normalized from venue-specific formats)."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    timestamp: int = Field(..., description="Exchange-reported timestamp (ms since epoch)")
    local_timestamp: int = Field(..., description="Local receipt timestamp (ms since epoch)")
    price: float = Field(..., description="Trade price")
    quantity: float = Field(..., description="Trade quantity (base asset)")
    is_buyer_maker: bool = Field(..., description="True if buyer was maker (passive)")
    venue: VenueId = Field(..., description="Source venue")
    asset: AssetId = Field(..., description="Asset")
    market_type: MarketType = Field(..., description="Market type")

    @property
    def taker_side(self) -> TakerSide:
        """
        Get normalized taker side for this trade.

        Semantic definition (consistent across all venues):
        - is_buyer_maker=True: Buyer was maker → taker was selling → SELL
        - is_buyer_maker=False: Buyer was taker → aggressive buy → BUY

        This ensures buy_volume/sell_volume means the same thing
        regardless of which venue the trade came from.
        """
        return TakerSide.SELL if self.is_buyer_maker else TakerSide.BUY


class Bar(BaseModel):
    """1-minute OHLCV bar for a single venue."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    time: int = Field(..., description="Bar start time (unix seconds, floored to minute)")
    open: float = Field(..., description="Open price")
    high: float = Field(..., description="High price")
    low: float = Field(..., description="Low price")
    close: float = Field(..., description="Close price")
    volume: float = Field(..., description="Total volume (base asset)")
    trade_count: int = Field(default=0, description="Total number of trades in this bar")

    # Buy/Sell volume separation (taker-initiated, per POC team recommendation)
    # buy = taker-initiated buys (aggressive buys, lifting the ask)
    # sell = taker-initiated sells (aggressive sells, hitting the bid)
    buy_volume: float = Field(default=0.0, description="Taker buy volume (base asset)")
    sell_volume: float = Field(default=0.0, description="Taker sell volume (base asset)")
    buy_count: int = Field(default=0, description="Number of taker buy trades")
    sell_count: int = Field(default=0, description="Number of taker sell trades")

    venue: VenueId = Field(..., description="Source venue")
    asset: AssetId = Field(..., description="Asset")
    market_type: MarketType = Field(..., description="Market type")
    is_partial: bool = Field(default=False, description="True if bar is still forming")

    # Persistence metadata (populated when reading from DB)
    included_in_composite: bool = Field(default=True, description="Whether included in composite calculation")
    exclude_reason: Optional[str] = Field(default=None, description="Reason for exclusion if not included")


# =============================================================================
# Composite Types
# =============================================================================

class ExcludedVenue(BaseModel):
    """Venue excluded from composite with reason."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    venue: str
    reason: ExcludeReason


class VenueContribution(BaseModel):
    """Per-venue contribution to a composite."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    venue: VenueId
    price: Optional[float] = None
    included: bool = False
    exclude_reason: Optional[ExcludeReason] = None
    deviation_bps: Optional[float] = None


class CompositePrice(BaseModel):
    """Composite price output (spot or perp)."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    price: Optional[float] = Field(None, description="Composite price (median of included venues)")
    time: int = Field(..., description="Bar start time (unix seconds)")
    venues: list[VenueContribution] = Field(default_factory=list)
    included_count: int = Field(default=0, description="Number of venues included")
    total_venues: int = Field(default=0, description="Total configured venues")
    degraded: bool = Field(default=False, description="True if below preferred quorum")
    degraded_reason: DegradedReason = Field(default=DegradedReason.NONE)
    asset: AssetId
    market_type: MarketType


class CompositeBar(BaseModel):
    """
    Composite bar (1m OHLCV computed from venue medians).

    This is the canonical production type per ABACUS_INDEXER_V0_CONTRACT_FREEZE.md.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    time: int = Field(..., description="Unix seconds, bar start")
    open: Optional[float] = Field(None, description="None if is_gap")
    high: Optional[float] = Field(None, description="None if is_gap")
    low: Optional[float] = Field(None, description="None if is_gap")
    close: Optional[float] = Field(None, description="None if is_gap")
    volume: float = Field(default=0.0, description="Total volume from included venues (0 if is_gap)")

    # Buy/Sell volume separation (sum from included venues only)
    # Aggregation rule: sum buy/sell across same venue set used for composite close
    # If a venue is excluded, its order-flow is NOT included (per POC team recommendation)
    buy_volume: float = Field(default=0.0, description="Sum of taker buy volume from included venues")
    sell_volume: float = Field(default=0.0, description="Sum of taker sell volume from included venues")
    buy_count: int = Field(default=0, description="Sum of taker buy count from included venues")
    sell_count: int = Field(default=0, description="Sum of taker sell count from included venues")

    degraded: bool = Field(default=False, description="True if below preferred quorum or is_gap")
    is_gap: bool = Field(default=False, description="True if quorum < minQuorum")
    is_backfilled: bool = Field(default=False, description="True if repaired via backfill")
    included_venues: list[str] = Field(default_factory=list, description="Venues in composite")
    excluded_venues: list[ExcludedVenue] = Field(default_factory=list, description="Excluded venues with reasons")
    asset: Optional[AssetId] = None
    market_type: Optional[MarketType] = None

    def is_valid(self) -> bool:
        """Check if bar has valid OHLCV data."""
        return not self.is_gap and self.open is not None


# =============================================================================
# Derived Features
# =============================================================================

class BasisFeatures(BaseModel):
    """Basis features (perp - spot relationship)."""

    basis: Optional[float] = Field(None, description="Raw basis: perp_price - spot_price")
    basis_bps: Optional[float] = Field(None, description="Basis in bps: 10000 * basis / spot_price")
    time: int = Field(..., description="Timestamp")
    degraded: bool = Field(default=False, description="True if either spot or perp is degraded")


class FundingRate(BaseModel):
    """Funding rate data point."""

    time: int = Field(..., description="Funding timestamp (usually 8h intervals)")
    rate: float = Field(..., description="Funding rate (e.g., 0.0001 = 0.01%)")
    venue: VenueId
    asset: AssetId


# =============================================================================
# Telemetry Types
# =============================================================================

class VenueTelemetry(BaseModel):
    """Per-venue telemetry snapshot."""

    venue: VenueId
    market_type: MarketType
    asset: AssetId
    connection_state: ConnectionState = ConnectionState.DISCONNECTED
    last_message_time: Optional[int] = None
    message_count: int = 0
    trade_count: int = 0
    reconnect_count: int = 0
    gap_count: int = 0
    outlier_exclusion_count: int = 0
    stale_exclusion_count: int = 0
    session_start_time: Optional[int] = None
    uptime_percent: float = 0.0
    avg_message_rate: float = 0.0


class AggregateTelemetry(BaseModel):
    """Aggregated telemetry across all venues."""

    venues: list[VenueTelemetry] = Field(default_factory=list)
    system_health: Literal["healthy", "degraded", "unhealthy"] = "unhealthy"
    connected_spot_venues: int = 0
    connected_perp_venues: int = 0
    total_gaps: int = 0
    total_outlier_exclusions: int = 0


# =============================================================================
# Venue Configuration
# =============================================================================

class VenueConfig(BaseModel):
    """Static configuration for a venue."""

    id: VenueId
    name: str
    color: str
    quote_currency: QuoteCurrency
    supports_spot: bool
    supports_perp: bool
    ws_endpoint_spot: Optional[str] = None
    ws_endpoint_perp: Optional[str] = None
