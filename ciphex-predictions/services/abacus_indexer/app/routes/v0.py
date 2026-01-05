"""
Abacus Indexer V0 API Endpoints

Production API for composite candles per ABACUS_INDEXER_V0_CONTRACT_FREEZE.md.

Endpoints:
- GET /v0/latest - Current composite price and forming bar
- GET /v0/candles - Historical composite candles
- GET /v0/telemetry - Per-venue connection state and metrics
- GET /v0/stream - SSE real-time updates
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Annotated, AsyncGenerator, Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ...core.types import AssetId, CompositeBar, MarketType
from ..config import settings


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v0", tags=["v0"])


# =============================================================================
# Response Models
# =============================================================================

class LatestPriceResponse(BaseModel):
    """Response for /v0/latest endpoint."""

    asset: str = Field(..., description="Asset (BTC, ETH)")
    market_type: str = Field(..., description="Market type (spot, perp)")
    price: Optional[float] = Field(None, description="Current venue price (from primary venue, sub-second)")
    time: int = Field(..., description="Unix timestamp (seconds)")
    degraded: bool = Field(default=False, description="True if below preferred quorum")
    included_venues: list[str] = Field(default_factory=list)
    last_bar: Optional[dict] = Field(None, description="Last completed bar")


class CandleResponse(BaseModel):
    """Single candle in response."""

    time: int = Field(..., description="Bar start time (unix seconds)")
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: Optional[float] = None
    volume: float = Field(default=0.0)

    # Buy/Sell volume separation (taker-initiated, for forecasting)
    buy_volume: float = Field(default=0.0, description="Taker buy volume (base asset)")
    sell_volume: float = Field(default=0.0, description="Taker sell volume (base asset)")
    buy_count: int = Field(default=0, description="Number of taker buy trades")
    sell_count: int = Field(default=0, description="Number of taker sell trades")

    degraded: bool = Field(default=False)
    is_gap: bool = Field(default=False)
    is_backfilled: bool = Field(default=False)
    included_venues: list[str] = Field(default_factory=list)


class CandlesResponse(BaseModel):
    """Response for /v0/candles endpoint."""

    asset: str
    market_type: str
    candles: list[CandleResponse]
    count: int
    start_time: int
    end_time: int


class VenueTelemetryResponse(BaseModel):
    """Per-venue telemetry."""

    venue: str
    asset: str
    market_type: str
    connection_state: str
    last_message_time: Optional[int] = None
    message_count: int = 0
    trade_count: int = 0
    reconnect_count: int = 0
    uptime_percent: float = 0.0


class TelemetryResponse(BaseModel):
    """Response for /v0/telemetry endpoint."""

    venues: list[VenueTelemetryResponse]
    system_health: str  # healthy, degraded, unhealthy
    connected_spot_venues: int = 0
    connected_perp_venues: int = 0
    timestamp: str


class VenueCandleResponse(BaseModel):
    """Single venue candle in response."""

    time: int = Field(..., description="Bar start time (unix seconds)")
    venue: str = Field(..., description="Venue (binance, coinbase, etc.)")
    open: float
    high: float
    low: float
    close: float
    volume: float = Field(default=0.0)
    trade_count: int = Field(default=0)

    # Buy/Sell volume separation (taker-initiated, for forecasting)
    buy_volume: float = Field(default=0.0, description="Taker buy volume (base asset)")
    sell_volume: float = Field(default=0.0, description="Taker sell volume (base asset)")
    buy_count: int = Field(default=0, description="Number of taker buy trades")
    sell_count: int = Field(default=0, description="Number of taker sell trades")

    included_in_composite: bool = Field(default=True, description="Whether this bar was included in composite")
    exclude_reason: Optional[str] = Field(None, description="Reason for exclusion if not included")


class VenueCandlesResponse(BaseModel):
    """Response for /v0/venue-candles endpoint."""

    asset: str
    market_type: str
    venue: Optional[str] = Field(None, description="Venue filter applied (null if all venues)")
    candles: list[VenueCandleResponse]
    count: int
    start_time: int
    end_time: int


class GapsResponse(BaseModel):
    """Response for /v0/gaps endpoint."""

    asset: str
    market_type: str
    start_time: int
    end_time: int
    gap_count: int
    gaps: list[int] = Field(description="List of gap timestamps (unix seconds)")


class IntegrityResponse(BaseModel):
    """Response for /v0/integrity endpoint (Type B criteria)."""

    asset: str
    market_type: str
    window_start: int
    window_end: int
    expected_bars: int
    actual_bars: int
    missing_bars: int
    gaps: int
    total_gaps: int
    gap_rate: float
    degraded: int = Field(description="Bars below preferred quorum (for UI)")
    degraded_rate: float
    quality_degraded: int = Field(default=0, description="Bars with excluded venues (for Type B gating)")
    quality_degraded_rate: float = Field(default=0.0)
    backfilled: int
    tier: int = Field(description="1=Production, 2=Degraded, 3=Unusable")
    tier1_eligible: bool
    tier2_eligible: bool
    recommendation: str = Field(description="PROCEED, PROCEED_WITH_CAUTION, or BACKFILL_REQUIRED")


class BackfillRequest(BaseModel):
    """Request body for /v0/backfill endpoint."""

    asset: str = Field(..., description="Asset (BTC, ETH)")
    market_type: str = Field(..., description="Market type (spot, perp)")
    start_time: int = Field(..., description="Start time (unix seconds)")
    end_time: int = Field(..., description="End time (unix seconds)")
    venues: Optional[list[str]] = Field(None, description="Venues to use (default: binance, coinbase for spot)")


class BackfillResponse(BaseModel):
    """Response for /v0/backfill endpoint."""

    asset: str
    market_type: str
    start_time: int
    end_time: int
    gaps_found: int
    bars_repaired: int
    bars_failed: int
    venue_bars_inserted: int
    duration_seconds: float
    errors: list[str] = Field(default_factory=list)


class DatasetCandleResponse(BaseModel):
    """Single candle in dataset response."""

    time: int
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: Optional[float] = None
    volume: float = Field(default=0.0)
    buy_volume: float = Field(default=0.0)
    sell_volume: float = Field(default=0.0)
    degraded: bool = Field(default=False)
    is_gap: bool = Field(default=False)
    is_backfilled: bool = Field(default=False)


class DatasetResponse(BaseModel):
    """Response for /v0/dataset/candles endpoint (forecasting-optimized)."""

    asset: str
    market_type: str
    window_start: int
    window_end: int
    expected_bars: int
    actual_bars: int
    integrity: IntegrityResponse
    candles: list[DatasetCandleResponse]
    gating: dict = Field(description="Gating recommendation for forecasting")


# =============================================================================
# Dependencies
# =============================================================================

def get_aggregator(request: Request):
    """Get aggregator from app state."""
    aggregator = getattr(request.app.state, "aggregator", None)
    if not aggregator:
        raise HTTPException(status_code=503, detail="Aggregator not initialized")
    return aggregator


def get_repository(request: Request):
    """Get repository from app state."""
    repository = getattr(request.app.state, "repository", None)
    return repository  # Can be None if no database configured


def get_venue_repository(request: Request):
    """Get venue bar repository from app state."""
    venue_repository = getattr(request.app.state, "venue_repository", None)
    return venue_repository  # Can be None if no database configured


def verify_admin_key(
    x_admin_key: Annotated[Optional[str], Header(alias="X-Admin-Key")] = None,
) -> bool:
    """
    Verify admin API key for mutation endpoints.

    Requires X-Admin-Key header matching ADMIN_API_KEY environment variable.
    In non-production environments with no key configured, allows access.

    Raises:
        HTTPException 401 if key is required but missing
        HTTPException 403 if key is invalid
    """
    # Check if admin key is configured
    configured_key = settings.admin_api_key

    # In production, admin key is REQUIRED
    if settings.environment == "production":
        if not configured_key:
            logger.error("ADMIN_API_KEY not configured in production - rejecting request")
            raise HTTPException(
                status_code=503,
                detail="Admin API key not configured. Contact administrator."
            )
        if not x_admin_key:
            raise HTTPException(
                status_code=401,
                detail="X-Admin-Key header required for mutation endpoints"
            )
        if x_admin_key != configured_key:
            logger.warning("Invalid admin key attempt")
            raise HTTPException(status_code=403, detail="Invalid admin key")
        return True

    # In non-production, if key is configured, require it
    if configured_key:
        if not x_admin_key:
            raise HTTPException(
                status_code=401,
                detail="X-Admin-Key header required for mutation endpoints"
            )
        if x_admin_key != configured_key:
            logger.warning("Invalid admin key attempt")
            raise HTTPException(status_code=403, detail="Invalid admin key")
        return True

    # Non-production with no key configured: allow (for local dev)
    logger.debug("Admin key check bypassed (non-production, no key configured)")
    return True


# =============================================================================
# GET /v0/latest
# =============================================================================

@router.get("/latest", response_model=list[LatestPriceResponse])
async def get_latest(
    request: Request,
    asset: Annotated[
        Optional[str],
        Query(description="Filter by asset (BTC, ETH)")
    ] = None,
    market_type: Annotated[
        Optional[str],
        Query(description="Filter by market type (spot, perp)")
    ] = None,
):
    """
    Get current prices and last completed composite bars.

    Response fields:
    - price: Current venue price (sub-second, from primary venue)
    - last_bar: Last completed composite bar (median across included venues)

    Note: The `price` field is a real-time venue price for responsiveness.
    The `last_bar` contains the true composite (median) from the last
    completed minute. For composite historical data, use /v0/candles.
    """
    aggregator = get_aggregator(request)
    repository = get_repository(request)

    # Get current prices from aggregator
    current_prices = aggregator.get_current_prices()
    connection_status = aggregator.get_connection_status()

    results = []

    # Build response for each asset/market
    for asset_id in [AssetId.BTC, AssetId.ETH]:
        for mt in [MarketType.SPOT, MarketType.PERP]:
            # Apply filters
            if asset and asset.upper() != asset_id.value:
                continue
            if market_type and market_type.lower() != mt.value:
                continue

            # Find matching price keys
            price_key = f"{asset_id.value}_{mt.value}_binance"  # Primary venue
            price = current_prices.get(price_key)

            # Get connected venues for this asset/market
            connected = [
                k.split("_")[2]  # Extract venue name
                for k, v in connection_status.items()
                if k.startswith(f"{asset_id.value}_{mt.value}_") and v
            ]

            # Get last bar - try repository first, fall back to in-memory buffer
            last_bar = None
            bar = None

            # Try database first
            if repository:
                try:
                    bar = await repository.get_latest(asset_id.value, mt.value)
                except Exception as e:
                    logger.debug(f"DB unavailable for latest bar: {e}")

            # Fall back to in-memory buffer
            if bar is None:
                bar = aggregator.get_latest_bar(asset_id, mt)

            if bar:
                last_bar = {
                    "time": bar.time,
                    "open": bar.open,
                    "high": bar.high,
                    "low": bar.low,
                    "close": bar.close,
                    "volume": bar.volume,
                    "buy_volume": getattr(bar, 'buy_volume', 0.0),
                    "sell_volume": getattr(bar, 'sell_volume', 0.0),
                    "buy_count": getattr(bar, 'buy_count', 0),
                    "sell_count": getattr(bar, 'sell_count', 0),
                    "degraded": bar.degraded,
                    "is_gap": bar.is_gap,
                }

            results.append(LatestPriceResponse(
                asset=asset_id.value,
                market_type=mt.value,
                price=price,
                time=int(datetime.now(timezone.utc).timestamp()),
                degraded=len(connected) < 3,  # Below preferred quorum
                included_venues=connected,
                last_bar=last_bar,
            ))

    return results


# =============================================================================
# GET /v0/candles
# =============================================================================

@router.get("/candles", response_model=CandlesResponse)
async def get_candles(
    request: Request,
    asset: Annotated[str, Query(description="Asset (BTC, ETH)")],
    market_type: Annotated[str, Query(description="Market type (spot, perp)")],
    start: Annotated[
        Optional[int],
        Query(description="Start time (unix seconds). Default: 1 hour ago")
    ] = None,
    end: Annotated[
        Optional[int],
        Query(description="End time (unix seconds). Default: now")
    ] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=1440, description="Max candles to return (1-1440)")
    ] = 60,
):
    """
    Get historical composite candles.

    Returns 1-minute composite OHLCV bars for the specified asset/market.
    Gap candles (is_gap=true) have null OHLCV values.

    Note: When database is unavailable, returns bars from in-memory buffer
    (last 2 hours). For older historical data, database is required.
    """
    aggregator = get_aggregator(request)
    repository = get_repository(request)

    # Validate asset
    try:
        asset_id = AssetId(asset.upper())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid asset: {asset}")

    # Validate market type
    try:
        mt = MarketType(market_type.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid market_type: {market_type}")

    # Default time range: based on limit (matches industry standard behavior)
    # When limit=N, return last N candles, not last hour capped at N
    now = int(datetime.now(timezone.utc).timestamp())
    if end is None:
        end = now
    if start is None:
        start = end - (limit * 60)  # limit candles worth of 1-minute bars

    # Validate time range
    if start >= end:
        raise HTTPException(status_code=400, detail="start must be before end")

    bars = []
    source = "memory"  # Track data source for logging

    # Try database first
    if repository:
        try:
            bars = await repository.get_range(
                asset=asset_id.value,
                market_type=mt.value,
                start_time=start,
                end_time=end,
                limit=limit,
            )
            source = "database"
        except Exception as e:
            logger.debug(f"DB unavailable for candles, using memory: {e}")

    # Fall back to in-memory buffer
    if not bars:
        bars = aggregator.get_bars(
            asset=asset_id,
            market_type=mt,
            start_time=start,
            end_time=end,
            limit=limit,
        )
        source = "memory"

        # Warn if requesting data older than buffer can provide
        buffer_count = aggregator.get_bar_count(asset_id, mt)
        if buffer_count == 0:
            logger.debug(f"No bars in memory for {asset_id.value}/{mt.value}")

    logger.debug(f"Candles returned from {source}: {len(bars)} bars")

    # Convert to response format
    candles = [
        CandleResponse(
            time=bar.time,
            open=bar.open,
            high=bar.high,
            low=bar.low,
            close=bar.close,
            volume=bar.volume,
            buy_volume=getattr(bar, 'buy_volume', 0.0),
            sell_volume=getattr(bar, 'sell_volume', 0.0),
            buy_count=getattr(bar, 'buy_count', 0),
            sell_count=getattr(bar, 'sell_count', 0),
            degraded=bar.degraded,
            is_gap=bar.is_gap,
            is_backfilled=getattr(bar, 'is_backfilled', False),
            included_venues=bar.included_venues,
        )
        for bar in bars
    ]

    return CandlesResponse(
        asset=asset_id.value,
        market_type=mt.value,
        candles=candles,
        count=len(candles),
        start_time=start,
        end_time=end,
    )


# =============================================================================
# GET /v0/telemetry
# =============================================================================

@router.get("/telemetry", response_model=TelemetryResponse)
async def get_telemetry(request: Request):
    """
    Get per-venue connection telemetry.

    Returns connection state, message counts, and uptime for each venue.
    """
    aggregator = get_aggregator(request)

    venues = []
    connected_spot = 0
    connected_perp = 0

    # Collect telemetry from all connectors
    for key, connector in aggregator._connectors.items():
        venue_id, asset_id, market_type = key
        telemetry = connector.get_telemetry()

        venues.append(VenueTelemetryResponse(
            venue=venue_id.value,
            asset=asset_id.value,
            market_type=market_type.value,
            connection_state=telemetry.connection_state.value,
            last_message_time=telemetry.last_message_time,
            message_count=telemetry.message_count,
            trade_count=telemetry.trade_count,
            reconnect_count=telemetry.reconnect_count,
            uptime_percent=telemetry.uptime_percent,
        ))

        if telemetry.connection_state.value == "connected":
            if market_type == MarketType.SPOT:
                connected_spot += 1
            else:
                connected_perp += 1

    # Determine system health
    total_connectors = len(venues)
    connected_count = connected_spot + connected_perp

    if total_connectors == 0:
        system_health = "unhealthy"
    elif connected_count == total_connectors:
        system_health = "healthy"
    elif connected_count >= total_connectors // 2:
        system_health = "degraded"
    else:
        system_health = "unhealthy"

    return TelemetryResponse(
        venues=venues,
        system_health=system_health,
        connected_spot_venues=connected_spot,
        connected_perp_venues=connected_perp,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


# =============================================================================
# GET /v0/venue-candles (Forecasting Traceability)
# =============================================================================

@router.get("/venue-candles", response_model=VenueCandlesResponse)
async def get_venue_candles(
    request: Request,
    asset: Annotated[str, Query(description="Asset (BTC, ETH)")],
    market_type: Annotated[str, Query(description="Market type (spot, perp)")],
    venue: Annotated[
        str,
        Query(description="Venue (binance, coinbase, kraken, okx, bybit)")
    ],
    start: Annotated[
        Optional[int],
        Query(description="Start time (unix seconds). Default: 1 hour ago")
    ] = None,
    end: Annotated[
        Optional[int],
        Query(description="End time (unix seconds). Default: now")
    ] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=1440, description="Max candles per venue to return (1-1440)")
    ] = 60,
):
    """
    Get per-venue OHLCV candles for forecasting traceability.

    Returns individual venue 1-minute OHLCV bars, showing what each exchange
    reported before composite aggregation. Useful for:
    - Validating composite calculations
    - Debugging price discrepancies
    - Forecasting model training with per-venue data

    Note: Requires database. Returns 503 if persistence not configured.
    """
    venue_repository = get_venue_repository(request)

    if not venue_repository:
        raise HTTPException(
            status_code=503,
            detail="Venue candles require database persistence (not configured)"
        )

    # Validate asset
    try:
        asset_id = AssetId(asset.upper())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid asset: {asset}")

    # Validate market type
    try:
        mt = MarketType(market_type.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid market_type: {market_type}")

    # Default time range: based on limit (matches industry standard behavior)
    # When limit=N, return last N candles, not last hour capped at N
    now = int(datetime.now(timezone.utc).timestamp())
    if end is None:
        end = now
    if start is None:
        start = end - (limit * 60)  # limit candles worth of 1-minute bars

    # Validate time range
    if start >= end:
        raise HTTPException(status_code=400, detail="start must be before end")

    candles = []

    try:
        bars = await venue_repository.get_range(
            asset=asset_id.value,
            market_type=mt.value,
            venue=venue.lower(),
            start_time=start,
            end_time=end,
            limit=limit,
        )
        for bar in bars:
            candles.append(VenueCandleResponse(
                time=bar.time,
                venue=bar.venue.value,
                open=bar.open,
                high=bar.high,
                low=bar.low,
                close=bar.close,
                volume=bar.volume,
                trade_count=bar.trade_count,
                buy_volume=getattr(bar, 'buy_volume', 0.0),
                sell_volume=getattr(bar, 'sell_volume', 0.0),
                buy_count=getattr(bar, 'buy_count', 0),
                sell_count=getattr(bar, 'sell_count', 0),
                included_in_composite=getattr(bar, 'included_in_composite', True),
                exclude_reason=getattr(bar, 'exclude_reason', None),
            ))
    except Exception as e:
        logger.error(f"Failed to get venue candles: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

    return VenueCandlesResponse(
        asset=asset_id.value,
        market_type=mt.value,
        venue=venue.lower() if venue else None,
        candles=candles,
        count=len(candles),
        start_time=start,
        end_time=end,
    )


# =============================================================================
# GET /v0/stream (SSE)
# =============================================================================

@router.get("/stream")
async def stream_updates(
    request: Request,
    asset: Annotated[
        Optional[str],
        Query(description="Filter by asset (BTC, ETH)")
    ] = None,
    market_type: Annotated[
        Optional[str],
        Query(description="Filter by market type (spot, perp)")
    ] = None,
):
    """
    Server-Sent Events stream for real-time updates.

    Events:
    - price: Per-venue price updates (every 500ms)
    - telemetry: Connection status update (every 5s)

    Note: Bar completion events are not yet implemented.
    Poll /v0/latest for completed composite bars.

    Reconnection: On reconnect, client should call /v0/latest first
    to get current state before resuming stream.
    """
    aggregator = get_aggregator(request)

    async def event_generator() -> AsyncGenerator[str, None]:
        """Generate SSE events."""
        sequence = 0
        last_price_time = 0
        last_telemetry_time = 0
        price_interval = 0.5  # 500ms
        telemetry_interval = 5.0  # 5s

        try:
            while True:
                now = asyncio.get_event_loop().time()

                # Price updates
                if now - last_price_time >= price_interval:
                    last_price_time = now
                    prices = aggregator.get_current_prices()
                    status = aggregator.get_connection_status()

                    # Filter and format prices
                    price_data = {}
                    for key, price in prices.items():
                        parts = key.split("_")
                        if len(parts) >= 3:
                            a, mt, venue = parts[0], parts[1], parts[2]
                            # Apply filters
                            if asset and a != asset.upper():
                                continue
                            if market_type and mt != market_type.lower():
                                continue
                            if a not in price_data:
                                price_data[a] = {}
                            if mt not in price_data[a]:
                                price_data[a][mt] = {}
                            price_data[a][mt][venue] = price

                    if price_data:
                        sequence += 1
                        event = {
                            "type": "price",
                            "sequence": sequence,
                            "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
                            "data": price_data,
                        }
                        yield f"event: price\ndata: {json.dumps(event)}\n\n"

                # Telemetry updates
                if now - last_telemetry_time >= telemetry_interval:
                    last_telemetry_time = now
                    sequence += 1

                    telemetry_data = []
                    for key, connector in aggregator._connectors.items():
                        venue_id, asset_id, mt = key
                        # Apply filters
                        if asset and asset_id.value != asset.upper():
                            continue
                        if market_type and mt.value != market_type.lower():
                            continue

                        t = connector.get_telemetry()
                        telemetry_data.append({
                            "venue": venue_id.value,
                            "asset": asset_id.value,
                            "market_type": mt.value,
                            "connected": t.connection_state.value == "connected",
                            "message_count": t.message_count,
                        })

                    event = {
                        "type": "telemetry",
                        "sequence": sequence,
                        "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
                        "data": telemetry_data,
                    }
                    yield f"event: telemetry\ndata: {json.dumps(event)}\n\n"

                # Small sleep to prevent tight loop
                await asyncio.sleep(0.1)

        except asyncio.CancelledError:
            logger.info("SSE stream cancelled")
            raise

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


# =============================================================================
# GET /v0/gaps (Gap Detection)
# =============================================================================

@router.get("/gaps", response_model=GapsResponse)
async def get_gaps(
    request: Request,
    asset: Annotated[str, Query(description="Asset (BTC, ETH)")],
    market_type: Annotated[str, Query(description="Market type (spot, perp)")],
    start: Annotated[
        Optional[int],
        Query(description="Start time (unix seconds). Default: 24h ago")
    ] = None,
    end: Annotated[
        Optional[int],
        Query(description="End time (unix seconds). Default: now")
    ] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=1440, description="Max gaps to return")
    ] = 100,
):
    """
    Get gap timestamps in a time range.

    Returns timestamps (unix seconds) of gap bars that need backfill.
    Used for gap detection before triggering backfill operations.
    """
    repository = get_repository(request)

    if not repository:
        raise HTTPException(
            status_code=503,
            detail="Gap detection requires database persistence (not configured)"
        )

    # Validate asset
    try:
        asset_id = AssetId(asset.upper())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid asset: {asset}")

    # Validate market type
    try:
        mt = MarketType(market_type.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid market_type: {market_type}")

    # Default time range: last 24 hours
    now = int(datetime.now(timezone.utc).timestamp())
    if end is None:
        end = now
    if start is None:
        start = end - 86400  # 24 hours ago

    try:
        gaps = await repository.get_gaps(
            asset=asset_id.value,
            market_type=mt.value,
            start_time=start,
            end_time=end,
            limit=limit,
        )

        return GapsResponse(
            asset=asset_id.value,
            market_type=mt.value,
            start_time=start,
            end_time=end,
            gap_count=len(gaps),
            gaps=gaps,
        )

    except Exception as e:
        logger.error(f"Failed to get gaps: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# GET /v0/integrity (Type B Criteria)
# =============================================================================

@router.get("/integrity", response_model=IntegrityResponse)
async def get_integrity(
    request: Request,
    asset: Annotated[str, Query(description="Asset (BTC, ETH)")],
    market_type: Annotated[str, Query(description="Market type (spot, perp)")],
    lookback: Annotated[
        int,
        Query(ge=60, le=20160, description="Lookback window in minutes (60-20160)")
    ] = 1440,  # 24 hours default
):
    """
    Get integrity statistics for forecasting evaluation (Type B criteria).

    Returns:
    - Gap and degraded counts/rates
    - Tier classification (1=Production, 2=Degraded, 3=Unusable)
    - Recommendation for forecasting (PROCEED, PROCEED_WITH_CAUTION, BACKFILL_REQUIRED)

    Tier thresholds (per 24h window):
    - Tier 1: ≤5 gaps, ≤60 degraded
    - Tier 2: ≤30 gaps, ≤180 degraded
    - Tier 3: >30 gaps or >180 degraded
    """
    repository = get_repository(request)

    if not repository:
        raise HTTPException(
            status_code=503,
            detail="Integrity check requires database persistence (not configured)"
        )

    # Validate asset
    try:
        asset_id = AssetId(asset.upper())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid asset: {asset}")

    # Validate market type
    try:
        mt = MarketType(market_type.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid market_type: {market_type}")

    # Calculate time window (minute-aligned to match /dataset/candles)
    now = int(datetime.now(timezone.utc).timestamp())
    end_time = (now // 60) * 60  # Floor to minute boundary
    start_time = end_time - (lookback * 60)

    try:
        stats = await repository.get_integrity_stats(
            asset=asset_id.value,
            market_type=mt.value,
            start_time=start_time,
            end_time=end_time,
        )

        # Determine recommendation
        if stats["tier"] == 1:
            recommendation = "PROCEED"
        elif stats["tier"] == 2:
            recommendation = "PROCEED_WITH_CAUTION"
        else:
            recommendation = "BACKFILL_REQUIRED"

        return IntegrityResponse(
            asset=asset_id.value,
            market_type=mt.value,
            window_start=start_time,
            window_end=end_time,
            expected_bars=stats["expected_bars"],
            actual_bars=stats["actual_bars"],
            missing_bars=stats["missing_bars"],
            gaps=stats["gaps"],
            total_gaps=stats["total_gaps"],
            gap_rate=stats["gap_rate"],
            degraded=stats["degraded"],
            degraded_rate=stats["degraded_rate"],
            quality_degraded=stats.get("quality_degraded", 0),
            quality_degraded_rate=stats.get("quality_degraded_rate", 0.0),
            backfilled=stats["backfilled"],
            tier=stats["tier"],
            tier1_eligible=stats["tier1_eligible"],
            tier2_eligible=stats["tier2_eligible"],
            recommendation=recommendation,
        )

    except Exception as e:
        logger.error(f"Failed to get integrity stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# POST /v0/backfill (Trigger Backfill)
# =============================================================================

@router.post("/backfill", response_model=BackfillResponse)
async def trigger_backfill(
    request: Request,
    body: BackfillRequest,
    _admin_verified: Annotated[bool, Depends(verify_admin_key)] = True,
):
    """
    Trigger backfill for gaps in a time range.

    Fetches historical trades from exchange REST APIs and repairs gap bars.
    Uses Binance and Coinbase for spot, Binance only for perp.

    Note: This is a synchronous operation that may take several seconds
    depending on the number of gaps. For large backfills, consider
    using a background job.

    Authentication: Requires X-Admin-Key header in production.
    """
    repository = get_repository(request)
    venue_repository = get_venue_repository(request)

    if not repository or not venue_repository:
        raise HTTPException(
            status_code=503,
            detail="Backfill requires database persistence (not configured)"
        )

    # Validate asset
    try:
        asset_id = AssetId(body.asset.upper())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid asset: {body.asset}")

    # Validate market type
    try:
        mt = MarketType(body.market_type.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid market_type: {body.market_type}")

    # Validate time range
    if body.start_time >= body.end_time:
        raise HTTPException(status_code=400, detail="start_time must be before end_time")

    # Limit backfill window to 24 hours
    max_window = 86400  # 24 hours
    if body.end_time - body.start_time > max_window:
        raise HTTPException(
            status_code=400,
            detail=f"Backfill window cannot exceed 24 hours ({max_window} seconds)"
        )

    try:
        # Import backfill service
        from ...backfill import BackfillService

        service = BackfillService(repository, venue_repository)

        result = await service.backfill_gaps(
            asset=asset_id.value,
            market_type=mt.value,
            start_time=body.start_time,
            end_time=body.end_time,
            venues=body.venues,
        )

        await service.close()

        return BackfillResponse(
            asset=result.asset,
            market_type=result.market_type,
            start_time=result.start_time,
            end_time=result.end_time,
            gaps_found=result.gaps_found,
            bars_repaired=result.bars_repaired,
            bars_failed=result.bars_failed,
            venue_bars_inserted=result.venue_bars_inserted,
            duration_seconds=result.duration_seconds,
            errors=result.errors,
        )

    except Exception as e:
        logger.error(f"Backfill failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# GET /v0/dataset/candles (Forecasting Interface)
# =============================================================================

@router.get("/dataset/candles", response_model=DatasetResponse)
async def get_dataset_candles(
    request: Request,
    asset: Annotated[str, Query(description="Asset (BTC, ETH)")],
    market_type: Annotated[str, Query(description="Market type (spot, perp)")],
    lookback: Annotated[
        int,
        Query(ge=60, le=20160, description="Lookback window in minutes (60-20160)")
    ] = 1440,  # 24 hours default
):
    """
    Get candles with integrity metadata for forecasting.

    This is the primary interface for forecasting models. Returns:
    - Fixed-length window of candles (explicit gaps included)
    - Integrity statistics per Type B criteria
    - Gating recommendation for model consumption

    For 24h lookback (1440 bars):
    - Tier 1: PROCEED (≤5 gaps, ≤60 degraded)
    - Tier 2: PROCEED_WITH_CAUTION (≤30 gaps, ≤180 degraded)
    - Tier 3: BACKFILL_REQUIRED (>30 gaps or >180 degraded)
    """
    repository = get_repository(request)

    if not repository:
        raise HTTPException(
            status_code=503,
            detail="Dataset endpoint requires database persistence (not configured)"
        )

    # Validate asset
    try:
        asset_id = AssetId(asset.upper())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid asset: {asset}")

    # Validate market type
    try:
        mt = MarketType(market_type.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid market_type: {market_type}")

    # Calculate time window
    now = int(datetime.now(timezone.utc).timestamp())
    # Align to minute boundary
    end_time = (now // 60) * 60
    start_time = end_time - (lookback * 60)

    try:
        # Get integrity stats
        stats = await repository.get_integrity_stats(
            asset=asset_id.value,
            market_type=mt.value,
            start_time=start_time,
            end_time=end_time,
        )

        # Get candles from DB
        bars = await repository.get_range(
            asset=asset_id.value,
            market_type=mt.value,
            start_time=start_time,
            end_time=end_time,
            limit=lookback,
        )

        # Build lookup dict by timestamp
        bar_lookup = {bar.time: bar for bar in bars}

        # Generate fixed-length output by iterating all expected timestamps
        # This ensures we always return exactly `lookback` candles
        candles = []
        for i in range(lookback):
            ts = start_time + (i * 60)
            if ts in bar_lookup:
                bar = bar_lookup[ts]
                candles.append(DatasetCandleResponse(
                    time=bar.time,
                    open=bar.open,
                    high=bar.high,
                    low=bar.low,
                    close=bar.close,
                    volume=bar.volume,
                    buy_volume=getattr(bar, 'buy_volume', 0.0),
                    sell_volume=getattr(bar, 'sell_volume', 0.0),
                    degraded=bar.degraded,
                    is_gap=bar.is_gap,
                    is_backfilled=getattr(bar, 'is_backfilled', False),
                ))
            else:
                # Synthesize explicit gap candle for missing minute
                candles.append(DatasetCandleResponse(
                    time=ts,
                    open=None,
                    high=None,
                    low=None,
                    close=None,
                    volume=0.0,
                    buy_volume=0.0,
                    sell_volume=0.0,
                    degraded=True,
                    is_gap=True,
                    is_backfilled=False,
                ))

        # Determine recommendation
        if stats["tier"] == 1:
            recommendation = "PROCEED"
        elif stats["tier"] == 2:
            recommendation = "PROCEED_WITH_CAUTION"
        else:
            recommendation = "BACKFILL_REQUIRED"

        integrity = IntegrityResponse(
            asset=asset_id.value,
            market_type=mt.value,
            window_start=start_time,
            window_end=end_time,
            expected_bars=stats["expected_bars"],
            actual_bars=stats["actual_bars"],
            missing_bars=stats["missing_bars"],
            gaps=stats["gaps"],
            total_gaps=stats["total_gaps"],
            gap_rate=stats["gap_rate"],
            degraded=stats["degraded"],
            degraded_rate=stats["degraded_rate"],
            quality_degraded=stats.get("quality_degraded", 0),
            quality_degraded_rate=stats.get("quality_degraded_rate", 0.0),
            backfilled=stats["backfilled"],
            tier=stats["tier"],
            tier1_eligible=stats["tier1_eligible"],
            tier2_eligible=stats["tier2_eligible"],
            recommendation=recommendation,
        )

        gating = {
            "tier": stats["tier"],
            "tier1_eligible": stats["tier1_eligible"],
            "tier2_eligible": stats["tier2_eligible"],
            "recommendation": recommendation,
            "gaps_to_repair": stats["total_gaps"],
            "can_proceed": stats["tier"] <= 2,
        }

        return DatasetResponse(
            asset=asset_id.value,
            market_type=mt.value,
            window_start=start_time,
            window_end=end_time,
            expected_bars=stats["expected_bars"],
            actual_bars=stats["actual_bars"],
            integrity=integrity,
            candles=candles,
            gating=gating,
        )

    except Exception as e:
        logger.error(f"Failed to get dataset candles: {e}")
        raise HTTPException(status_code=500, detail=str(e))
