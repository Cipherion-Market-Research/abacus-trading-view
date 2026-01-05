"""
Composite Aggregator

Coordinates venue connectors and computes composite bars.

Responsibilities:
- Start/stop venue connectors for configured assets
- Collect venue bars at minute boundaries
- Compute composite bars using median-based outlier filtering
- Emit completed bars for persistence and SSE broadcasting

Per ABACUS_INDEXER_V0_CONTRACT_FREEZE.md:
- Bar interval: 60 seconds
- Composite uses close price for included/excluded venue lists
- Gap bars: is_gap=True when < minQuorum venues
"""

import asyncio
import logging
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Callable, Optional

# Maximum bars to retain in memory per asset/market (2 hours at 1-minute resolution)
MAX_IN_MEMORY_BARS = 120

from ..core.types import (
    AssetId,
    Bar,
    CompositeBar,
    ExcludeReason,
    MarketType,
    VenueId,
)
from ..core.constants import (
    BAR_INTERVAL_SECONDS,
    get_quorum_config,
)
from ..core.metrics import record_composite_bar
from ..core.outlier_filter import (
    CompositeResult,
    VenuePriceInput,
    filter_outliers,
    build_composite_bar,
)
from ..connectors.base import BaseConnector
from ..connectors.binance import BinanceConnector
from ..connectors.coinbase import CoinbaseConnector
from ..connectors.kraken import KrakenConnector
from ..connectors.okx import OKXConnector
from ..connectors.bybit import BybitConnector


logger = logging.getLogger(__name__)


@dataclass
class AggregatorConfig:
    """Configuration for the composite aggregator."""

    assets: list[AssetId] = field(default_factory=lambda: [AssetId.BTC, AssetId.ETH])
    spot_venues: list[VenueId] = field(default_factory=lambda: [VenueId.BINANCE, VenueId.COINBASE])
    perp_venues: list[VenueId] = field(default_factory=lambda: [VenueId.BINANCE])


@dataclass
class VenueBarBuffer:
    """Holds the latest completed bar for a venue."""

    venue: VenueId
    asset: AssetId
    market_type: MarketType
    latest_bar: Optional[Bar] = None
    bar_time: Optional[int] = None


class CompositeAggregator:
    """
    Manages venue connectors and computes composite bars.

    For each configured asset (BTC, ETH) and market type (spot, perp):
    - Starts venue WebSocket connectors
    - Collects completed bars from each venue
    - Computes composite bars at minute boundaries
    - Emits composite bars via callbacks
    - Emits venue bars for forecasting traceability

    Usage:
        aggregator = CompositeAggregator(
            config=AggregatorConfig(),
            on_composite_bar=handle_composite,
            on_venue_bars=handle_venue_bars,  # For forecasting traceability
        )
        await aggregator.start()
        # ... runs in background ...
        await aggregator.stop()
    """

    def __init__(
        self,
        config: Optional[AggregatorConfig] = None,
        on_composite_bar: Optional[Callable[[CompositeBar], None]] = None,
        on_venue_bars: Optional[Callable[[list[tuple[Bar, bool, Optional[str]]]], None]] = None,
    ):
        self.config = config or AggregatorConfig()
        self.on_composite_bar = on_composite_bar
        self.on_venue_bars = on_venue_bars  # Callback for (Bar, included, exclude_reason) tuples

        # Connectors by key: (venue, asset, market_type)
        self._connectors: dict[tuple[VenueId, AssetId, MarketType], BaseConnector] = {}

        # Bar buffers by key: (venue, asset, market_type)
        self._bar_buffers: dict[tuple[VenueId, AssetId, MarketType], VenueBarBuffer] = {}

        # In-memory composite bar buffer by key: (asset, market_type)
        # Stores recent bars for /v0/candles without requiring DB
        self._composite_bar_buffer: dict[
            tuple[AssetId, MarketType], deque[CompositeBar]
        ] = {}

        # Background task for composite computation
        self._running = False
        self._composite_task: Optional[asyncio.Task] = None

        # Track last computed composite time to avoid duplicates
        self._last_composite_times: dict[tuple[AssetId, MarketType], int] = {}

    async def start(self) -> None:
        """Start all venue connectors and composite computation."""
        if self._running:
            logger.warning("Aggregator already running")
            return

        self._running = True
        logger.info("Starting composite aggregator...")

        # Create and start connectors for each asset/market/venue
        for asset in self.config.assets:
            # Spot connectors
            for venue in self.config.spot_venues:
                await self._create_connector(venue, asset, MarketType.SPOT)

            # Perp connectors
            for venue in self.config.perp_venues:
                await self._create_connector(venue, asset, MarketType.PERP)

        # Start composite computation loop
        self._composite_task = asyncio.create_task(self._composite_loop())

        logger.info(
            f"Aggregator started: {len(self._connectors)} connectors "
            f"({len(self.config.assets)} assets, "
            f"{len(self.config.spot_venues)} spot venues, "
            f"{len(self.config.perp_venues)} perp venues)"
        )

    async def stop(self) -> None:
        """Stop all venue connectors and composite computation."""
        self._running = False

        # Cancel composite task
        if self._composite_task:
            self._composite_task.cancel()
            try:
                await self._composite_task
            except asyncio.CancelledError:
                pass
            self._composite_task = None

        # Stop all connectors
        for connector in self._connectors.values():
            await connector.stop()

        self._connectors.clear()
        self._bar_buffers.clear()
        logger.info("Aggregator stopped")

    async def _create_connector(
        self,
        venue: VenueId,
        asset: AssetId,
        market_type: MarketType,
    ) -> None:
        """Create and start a venue connector."""
        key = (venue, asset, market_type)

        # Create connector based on venue
        connector = self._make_connector(venue, asset, market_type)
        if not connector:
            logger.warning(f"No connector implementation for {venue.value}")
            return

        self._connectors[key] = connector

        # Create bar buffer
        self._bar_buffers[key] = VenueBarBuffer(
            venue=venue,
            asset=asset,
            market_type=market_type,
        )

        # Set bar complete callback
        def on_bar_complete(bar: Bar, k=key) -> None:
            self._handle_bar_complete(k, bar)

        connector._bar_builder.on_bar_complete = on_bar_complete

        # Start connector
        await connector.start()
        logger.info(f"Started connector: {venue.value}/{asset.value}/{market_type.value}")

    def _make_connector(
        self,
        venue: VenueId,
        asset: AssetId,
        market_type: MarketType,
    ) -> Optional[BaseConnector]:
        """Factory method to create venue-specific connector."""
        if venue == VenueId.BINANCE:
            return BinanceConnector(
                asset=asset,
                market_type=market_type,
            )
        elif venue == VenueId.COINBASE:
            # Coinbase only supports spot - skip if perp requested
            if market_type == MarketType.PERP:
                logger.debug(f"Coinbase does not support perps, skipping {asset.value}")
                return None
            return CoinbaseConnector(asset=asset)
        elif venue == VenueId.KRAKEN:
            # Kraken only supports spot - skip if perp requested
            if market_type == MarketType.PERP:
                logger.debug(f"Kraken does not support perps, skipping {asset.value}")
                return None
            return KrakenConnector(asset=asset)
        elif venue == VenueId.OKX:
            # OKX supports both spot and perp
            return OKXConnector(asset=asset, market_type=market_type)
        elif venue == VenueId.BYBIT:
            # Bybit only supports perp - skip if spot requested
            if market_type == MarketType.SPOT:
                logger.debug(f"Bybit does not support spot, skipping {asset.value}")
                return None
            return BybitConnector(asset=asset, market_type=market_type)
        return None

    def _handle_bar_complete(
        self,
        key: tuple[VenueId, AssetId, MarketType],
        bar: Bar,
    ) -> None:
        """Handle a completed bar from a venue connector."""
        buffer = self._bar_buffers.get(key)
        if buffer:
            buffer.latest_bar = bar
            buffer.bar_time = bar.time
            logger.debug(
                f"Bar complete: {key[0].value}/{key[1].value}/{key[2].value} "
                f"time={bar.time} close={bar.close:.2f}"
            )

    async def _composite_loop(self) -> None:
        """Background loop that computes composite bars."""
        logger.info("Composite computation loop started")

        while self._running:
            try:
                # Wait for next second boundary
                await self._wait_for_second_boundary()

                if not self._running:
                    break

                # Check if we're at a minute boundary
                now = int(time.time())
                if now % BAR_INTERVAL_SECONDS == 0:
                    # Wait 2 seconds for venue bars to complete
                    # (bars complete when first trade of new minute arrives)
                    await asyncio.sleep(2)
                    # Compute composites for the previous minute
                    bar_time = now - BAR_INTERVAL_SECONDS
                    await self._compute_composites(bar_time)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in composite loop: {e}")
                await asyncio.sleep(1)

        logger.info("Composite computation loop stopped")

    async def _wait_for_second_boundary(self) -> None:
        """Wait until the next second boundary."""
        now = time.time()
        next_second = int(now) + 1
        delay = next_second - now
        await asyncio.sleep(delay)

    async def _compute_composites(self, bar_time: int) -> None:
        """Compute composite bars for all assets/markets at given time."""
        for asset in self.config.assets:
            for market_type in [MarketType.SPOT, MarketType.PERP]:
                await self._compute_single_composite(asset, market_type, bar_time)

    async def _compute_single_composite(
        self,
        asset: AssetId,
        market_type: MarketType,
        bar_time: int,
    ) -> None:
        """Compute a single composite bar for asset/market at time."""
        composite_key = (asset, market_type)

        # Check for duplicate
        if self._last_composite_times.get(composite_key) == bar_time:
            return
        self._last_composite_times[composite_key] = bar_time

        # Get venues for this market type
        venues = (
            self.config.spot_venues
            if market_type == MarketType.SPOT
            else self.config.perp_venues
        )

        # Collect venue bars and connector state for this time
        venue_bars: dict[VenueId, Optional[Bar]] = {}
        venue_state: dict[VenueId, tuple[bool, Optional[int]]] = {}  # (is_connected, last_update_ms)

        for venue in venues:
            key = (venue, asset, market_type)
            buffer = self._bar_buffers.get(key)
            connector = self._connectors.get(key)

            # Get connector state for stale detection
            if connector:
                venue_state[venue] = (
                    connector.is_connected(),
                    connector.get_last_update_time(),
                )
            else:
                venue_state[venue] = (False, None)

            # Get bar if available for this time
            if buffer and buffer.bar_time == bar_time:
                venue_bars[venue] = buffer.latest_bar
            else:
                venue_bars[venue] = None

        # Build composite with real connector state
        composite, close_result = self._build_composite(
            asset, market_type, bar_time, venue_bars, venue_state
        )

        # Store in in-memory buffer
        self._store_composite_bar(composite)

        # Record Prometheus metrics
        record_composite_bar(
            asset=asset.value,
            market_type=market_type.value,
            is_gap=composite.is_gap,
            is_degraded=composite.degraded,
            venue_count=len(composite.included_venues),
        )

        # Log composite
        if composite.is_gap:
            logger.warning(
                f"GAP: {asset.value}/{market_type.value} time={bar_time} "
                f"included={len(composite.included_venues)}"
            )
        else:
            logger.info(
                f"Composite: {asset.value}/{market_type.value} time={bar_time} "
                f"close={composite.close:.2f} vol={composite.volume:.4f} "
                f"buy={composite.buy_volume:.4f} sell={composite.sell_volume:.4f} "
                f"included={len(composite.included_venues)} "
                f"degraded={composite.degraded}"
            )

        # Emit composite bar callback
        if self.on_composite_bar:
            self.on_composite_bar(composite)

        # Emit venue bars callback for forecasting traceability
        if self.on_venue_bars:
            venue_bar_tuples = self._prepare_venue_bars_for_persistence(
                venue_bars, close_result, asset, market_type
            )
            if venue_bar_tuples:
                self.on_venue_bars(venue_bar_tuples)

    def _build_composite(
        self,
        asset: AssetId,
        market_type: MarketType,
        bar_time: int,
        venue_bars: dict[VenueId, Optional[Bar]],
        venue_state: Optional[dict[VenueId, tuple[bool, Optional[int]]]] = None,
    ) -> tuple[CompositeBar, CompositeResult]:
        """
        Build a composite bar from venue bars.

        Uses median-based outlier filtering per frozen contract.
        Stale detection uses actual connector last_update_time.

        Args:
            asset: Asset being computed
            market_type: Market type
            bar_time: Bar start time (unix seconds)
            venue_bars: Map of venue -> Bar (or None if missing)
            venue_state: Map of venue -> (is_connected, last_update_ms) from connectors

        Returns:
            Tuple of (CompositeBar, close_result) where close_result is used
            for venue bar inclusion status.
        """
        current_time_ms = bar_time * 1000 + BAR_INTERVAL_SECONDS * 1000

        # Default venue_state if not provided (for testing)
        if venue_state is None:
            venue_state = {}

        # Build inputs for each OHLC component
        def build_inputs(price_getter: Callable[[Bar], float]) -> list[VenuePriceInput]:
            inputs = []
            for venue, bar in venue_bars.items():
                # Get real connector state for stale detection
                is_connected, last_update_ms = venue_state.get(venue, (False, None))

                if bar is None:
                    inputs.append(VenuePriceInput(
                        venue=venue,
                        price=None,
                        last_update_ms=last_update_ms,
                        is_connected=is_connected,
                    ))
                else:
                    inputs.append(VenuePriceInput(
                        venue=venue,
                        price=price_getter(bar),
                        last_update_ms=last_update_ms,
                        is_connected=is_connected,
                    ))
            return inputs

        # Calculate composite for each OHLC component
        open_result = filter_outliers(
            build_inputs(lambda b: b.open),
            current_time_ms,
            market_type,
        )
        high_result = filter_outliers(
            build_inputs(lambda b: b.high),
            current_time_ms,
            market_type,
        )
        low_result = filter_outliers(
            build_inputs(lambda b: b.low),
            current_time_ms,
            market_type,
        )
        close_result = filter_outliers(
            build_inputs(lambda b: b.close),
            current_time_ms,
            market_type,
        )

        # Build set of included venues from close_result (per frozen contract)
        included_venue_set = {
            c.venue for c in close_result.venues if c.included
        }

        # Sum volumes and buy/sell from included venues only (per POC team recommendation)
        total_volume = 0.0
        total_buy_volume = 0.0
        total_sell_volume = 0.0
        total_buy_count = 0
        total_sell_count = 0

        for venue, bar in venue_bars.items():
            if bar is not None and venue in included_venue_set:
                total_volume += bar.volume
                total_buy_volume += bar.buy_volume
                total_sell_volume += bar.sell_volume
                total_buy_count += bar.buy_count
                total_sell_count += bar.sell_count

        composite = build_composite_bar(
            time=bar_time,
            open_result=open_result,
            high_result=high_result,
            low_result=low_result,
            close_result=close_result,
            total_volume=total_volume,
            asset=asset,
            market_type=market_type,
            buy_volume=total_buy_volume,
            sell_volume=total_sell_volume,
            buy_count=total_buy_count,
            sell_count=total_sell_count,
        )

        return composite, close_result

    def get_current_prices(self) -> dict[str, float]:
        """Get current prices from all connected venues."""
        prices = {}
        for key, connector in self._connectors.items():
            venue, asset, market_type = key
            price = connector.get_current_price()
            if price is not None:
                price_key = f"{asset.value}_{market_type.value}_{venue.value}"
                prices[price_key] = price
        return prices

    def get_connection_status(self) -> dict[str, bool]:
        """Get connection status for all venues."""
        status = {}
        for key, connector in self._connectors.items():
            venue, asset, market_type = key
            status_key = f"{asset.value}_{market_type.value}_{venue.value}"
            status[status_key] = connector.is_connected()
        return status

    # =========================================================================
    # In-Memory Bar Buffer Methods
    # =========================================================================

    def _store_composite_bar(self, bar: CompositeBar) -> None:
        """Store a composite bar in the in-memory buffer."""
        key = (bar.asset, bar.market_type)

        # Initialize deque if needed
        if key not in self._composite_bar_buffer:
            self._composite_bar_buffer[key] = deque(maxlen=MAX_IN_MEMORY_BARS)

        self._composite_bar_buffer[key].append(bar)

    def get_latest_bar(
        self,
        asset: AssetId,
        market_type: MarketType,
    ) -> Optional[CompositeBar]:
        """
        Get the most recent composite bar from memory.

        Args:
            asset: Asset (BTC, ETH)
            market_type: Market type (spot, perp)

        Returns:
            Most recent CompositeBar or None if buffer is empty
        """
        key = (asset, market_type)
        buffer = self._composite_bar_buffer.get(key)

        if buffer and len(buffer) > 0:
            return buffer[-1]  # Most recent bar
        return None

    def get_bars(
        self,
        asset: AssetId,
        market_type: MarketType,
        start_time: Optional[int] = None,
        end_time: Optional[int] = None,
        limit: int = 60,
    ) -> list[CompositeBar]:
        """
        Get composite bars from the in-memory buffer.

        Args:
            asset: Asset (BTC, ETH)
            market_type: Market type (spot, perp)
            start_time: Start time filter (unix seconds, inclusive)
            end_time: End time filter (unix seconds, inclusive)
            limit: Maximum number of bars to return

        Returns:
            List of CompositeBar objects, sorted by time ascending
        """
        key = (asset, market_type)
        buffer = self._composite_bar_buffer.get(key)

        if not buffer:
            return []

        # Filter by time range
        bars = []
        for bar in buffer:
            if start_time is not None and bar.time < start_time:
                continue
            if end_time is not None and bar.time > end_time:
                continue
            bars.append(bar)

        # Sort by time ascending and apply limit
        bars.sort(key=lambda b: b.time)
        return bars[:limit]

    def get_bar_count(self, asset: AssetId, market_type: MarketType) -> int:
        """Get the number of bars in the buffer for an asset/market."""
        key = (asset, market_type)
        buffer = self._composite_bar_buffer.get(key)
        return len(buffer) if buffer else 0

    # =========================================================================
    # Venue Bar Persistence Support
    # =========================================================================

    def _prepare_venue_bars_for_persistence(
        self,
        venue_bars: dict[VenueId, Optional[Bar]],
        close_result: CompositeResult,
        asset: AssetId,
        market_type: MarketType,
    ) -> list[tuple[Bar, bool, Optional[str]]]:
        """
        Prepare venue bars for persistence with inclusion status.

        Maps each venue bar to its inclusion status based on the composite result.

        Args:
            venue_bars: Map of venue -> Bar (or None if missing)
            close_result: CompositeResult from close price filtering
            asset: Asset being computed
            market_type: Market type

        Returns:
            List of (Bar, included_in_composite, exclude_reason) tuples
        """
        # Build lookup for venue inclusion status from close_result
        venue_status: dict[VenueId, tuple[bool, Optional[str]]] = {}
        for contribution in close_result.venues:
            exclude_reason = None
            if contribution.exclude_reason:
                exclude_reason = contribution.exclude_reason.value
            venue_status[contribution.venue] = (contribution.included, exclude_reason)

        # Prepare tuples for persistence
        result = []
        for venue, bar in venue_bars.items():
            if bar is None:
                continue  # No bar to persist

            # Get inclusion status
            included, exclude_reason = venue_status.get(venue, (False, "no_data"))

            result.append((bar, included, exclude_reason))

        return result
