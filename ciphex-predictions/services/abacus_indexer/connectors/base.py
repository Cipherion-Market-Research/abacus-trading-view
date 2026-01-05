"""
Base Venue Connector

Abstract base class for all venue WebSocket connectors.
Defines the interface and common functionality for:
- WebSocket connection management
- Reconnection with exponential backoff
- Telemetry tracking
- Trade message handling
"""

import asyncio
import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

import websockets
from websockets import ClientConnection

from ..core.types import (
    AssetId,
    ConnectionState,
    MarketType,
    Trade,
    VenueId,
    VenueTelemetry,
)
from ..core.constants import (
    RECONNECT_INITIAL_DELAY_MS,
    RECONNECT_MAX_DELAY_MS,
    RECONNECT_BACKOFF_MULTIPLIER,
)
from ..core.bar_builder import BarBuilder

logger = logging.getLogger(__name__)


@dataclass
class ConnectorState:
    """Internal state for a connector."""

    connection_state: ConnectionState = ConnectionState.DISCONNECTED
    last_message_time_ms: Optional[int] = None
    message_count: int = 0
    trade_count: int = 0
    reconnect_count: int = 0
    session_start_time_ms: Optional[int] = None
    last_error: Optional[str] = None
    current_reconnect_delay_ms: int = RECONNECT_INITIAL_DELAY_MS


class BaseConnector(ABC):
    """
    Abstract base class for venue WebSocket connectors.

    Subclasses must implement:
    - get_ws_url(): Return WebSocket URL for this venue/market
    - build_subscription_message(): Build venue-specific subscription message
    - parse_message(): Parse venue-specific message into Trade objects

    Features:
    - Automatic reconnection with exponential backoff
    - Telemetry tracking (message count, trade count, uptime)
    - Integration with BarBuilder for OHLCV construction
    - Configurable callbacks for trade and bar events
    """

    def __init__(
        self,
        venue: VenueId,
        asset: AssetId,
        market_type: MarketType,
        on_trade: Optional[Callable[[Trade], None]] = None,
        on_bar_complete: Optional[Callable[[Any], None]] = None,
        on_state_change: Optional[Callable[[ConnectionState], None]] = None,
    ):
        self.venue = venue
        self.asset = asset
        self.market_type = market_type
        self.on_trade = on_trade
        self.on_bar_complete = on_bar_complete
        self.on_state_change = on_state_change

        # Internal state
        self._state = ConnectorState()
        self._ws: Optional[ClientConnection] = None
        self._running = False
        self._task: Optional[asyncio.Task] = None

        # Bar builder for this venue/asset/market
        self._bar_builder = BarBuilder(
            venue=venue,
            asset=asset,
            market_type=market_type,
            on_bar_complete=on_bar_complete,
        )

    # =========================================================================
    # Abstract Methods (subclasses must implement)
    # =========================================================================

    @abstractmethod
    def get_ws_url(self) -> str:
        """Return the WebSocket URL for this venue and market type."""
        pass

    @abstractmethod
    def build_subscription_message(self) -> dict[str, Any]:
        """Build the subscription message for this venue."""
        pass

    @abstractmethod
    def parse_message(self, data: dict[str, Any]) -> list[Trade]:
        """
        Parse a venue-specific message into Trade objects.

        Args:
            data: Parsed JSON message from WebSocket

        Returns:
            List of Trade objects (may be empty if message is not a trade)
        """
        pass

    # =========================================================================
    # Public API
    # =========================================================================

    async def start(self) -> None:
        """Start the connector (connect and begin receiving)."""
        if self._running:
            logger.warning(f"{self._log_prefix} Already running")
            return

        self._running = True
        self._state.session_start_time_ms = int(time.time() * 1000)
        self._task = asyncio.create_task(self._run_loop())
        logger.info(f"{self._log_prefix} Started")

    async def stop(self) -> None:
        """Stop the connector and close connection."""
        self._running = False
        if self._ws:
            await self._ws.close()
            self._ws = None
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        self._set_state(ConnectionState.DISCONNECTED)
        logger.info(f"{self._log_prefix} Stopped")

    def get_telemetry(self) -> VenueTelemetry:
        """Get current telemetry snapshot."""
        now_ms = int(time.time() * 1000)
        session_duration_ms = (
            now_ms - self._state.session_start_time_ms
            if self._state.session_start_time_ms
            else 0
        )

        # Calculate uptime percentage
        uptime_percent = 0.0
        if session_duration_ms > 0 and self._state.connection_state == ConnectionState.CONNECTED:
            # Approximate: assume connected if we have recent messages
            if self._state.last_message_time_ms:
                silence_ms = now_ms - self._state.last_message_time_ms
                if silence_ms < 30_000:  # Within 30s is "connected"
                    uptime_percent = 100.0

        # Calculate message rate
        avg_message_rate = 0.0
        if session_duration_ms > 0:
            avg_message_rate = self._state.message_count / (session_duration_ms / 1000)

        return VenueTelemetry(
            venue=self.venue,
            market_type=self.market_type,
            asset=self.asset,
            connection_state=self._state.connection_state,
            last_message_time=self._state.last_message_time_ms,
            message_count=self._state.message_count,
            trade_count=self._state.trade_count,
            reconnect_count=self._state.reconnect_count,
            gap_count=0,  # Tracked at aggregator level
            outlier_exclusion_count=0,  # Tracked at aggregator level
            session_start_time=self._state.session_start_time_ms,
            uptime_percent=uptime_percent,
            avg_message_rate=avg_message_rate,
        )

    def get_current_price(self) -> Optional[float]:
        """Get the current price (close of partial bar)."""
        return self._bar_builder.get_current_price()

    def get_last_update_time(self) -> Optional[int]:
        """Get timestamp of last trade received (ms)."""
        return self._state.last_message_time_ms

    def is_connected(self) -> bool:
        """Check if connector is currently connected."""
        return self._state.connection_state == ConnectionState.CONNECTED

    @property
    def bar_builder(self) -> BarBuilder:
        """Access the bar builder for this connector."""
        return self._bar_builder

    # =========================================================================
    # Internal Methods
    # =========================================================================

    @property
    def _log_prefix(self) -> str:
        """Log prefix for this connector."""
        return f"[{self.venue.value}/{self.market_type.value}/{self.asset.value}]"

    def _set_state(self, state: ConnectionState) -> None:
        """Update connection state and notify callback."""
        if self._state.connection_state != state:
            self._state.connection_state = state
            if self.on_state_change:
                self.on_state_change(state)

    async def _run_loop(self) -> None:
        """Main connection loop with reconnection logic."""
        while self._running:
            try:
                await self._connect_and_receive()
            except asyncio.CancelledError:
                break
            except Exception as e:
                self._state.last_error = str(e)
                logger.error(f"{self._log_prefix} Connection error: {e}")

            if not self._running:
                break

            # Reconnect with backoff
            self._state.reconnect_count += 1
            delay_ms = self._state.current_reconnect_delay_ms
            logger.info(f"{self._log_prefix} Reconnecting in {delay_ms}ms (attempt {self._state.reconnect_count})")

            await asyncio.sleep(delay_ms / 1000)

            # Exponential backoff
            self._state.current_reconnect_delay_ms = min(
                int(delay_ms * RECONNECT_BACKOFF_MULTIPLIER),
                RECONNECT_MAX_DELAY_MS,
            )

    async def _connect_and_receive(self) -> None:
        """Connect to WebSocket and process messages."""
        url = self.get_ws_url()
        self._set_state(ConnectionState.CONNECTING)
        logger.info(f"{self._log_prefix} Connecting to {url}")

        async with websockets.connect(
            url,
            ping_interval=20,
            ping_timeout=10,
            close_timeout=5,
        ) as ws:
            self._ws = ws
            self._set_state(ConnectionState.CONNECTED)
            self._state.current_reconnect_delay_ms = RECONNECT_INITIAL_DELAY_MS
            logger.info(f"{self._log_prefix} Connected")

            # Send subscription
            sub_msg = self.build_subscription_message()
            await ws.send(self._encode_message(sub_msg))
            logger.debug(f"{self._log_prefix} Sent subscription: {sub_msg}")

            # Receive loop
            async for message in ws:
                if not self._running:
                    break
                await self._handle_message(message)

    def _encode_message(self, msg: dict[str, Any]) -> str:
        """Encode message to JSON string."""
        import json
        return json.dumps(msg)

    async def _handle_message(self, message: str | bytes) -> None:
        """Handle incoming WebSocket message."""
        import json

        now_ms = int(time.time() * 1000)
        self._state.message_count += 1
        self._state.last_message_time_ms = now_ms

        try:
            if isinstance(message, bytes):
                message = message.decode("utf-8")
            data = json.loads(message)
        except json.JSONDecodeError as e:
            logger.warning(f"{self._log_prefix} Invalid JSON: {e}")
            return

        # Parse trades from message
        trades = self.parse_message(data)

        for trade in trades:
            self._state.trade_count += 1

            # Feed to bar builder
            completed_bar = self._bar_builder.add_trade(trade)

            # Notify trade callback
            if self.on_trade:
                self.on_trade(trade)

            # Bar completion is handled by bar builder callback
