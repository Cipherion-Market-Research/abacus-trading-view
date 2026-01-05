"""
Binance Venue Connector

WebSocket connector for Binance spot and perpetual markets.
Implements the reference connector pattern for other venues.

Binance WebSocket API:
- Spot: wss://stream.binance.com:9443/ws
- Perp: wss://fstream.binance.com/ws

Message format (aggTrade):
{
    "e": "aggTrade",
    "E": 1672515782136,    // Event time (ms)
    "s": "BTCUSDT",        // Symbol
    "a": 164227032,        // Aggregate trade ID
    "p": "16825.43",       // Price
    "q": "0.002",          // Quantity
    "f": 322222344,        // First trade ID
    "l": 322222344,        // Last trade ID
    "T": 1672515782136,    // Trade time (ms)
    "m": true,             // Is buyer maker
    "M": true              // Ignore
}
"""

import logging
import time
from typing import Any, Callable, Optional

from ..core.types import AssetId, MarketType, Trade, VenueId
from ..core.constants import VENUE_CONFIGS
from ..core.symbol_mapping import get_symbol, get_stream_name
from .base import BaseConnector

logger = logging.getLogger(__name__)


class BinanceConnector(BaseConnector):
    """
    Binance WebSocket connector.

    Connects to Binance aggTrade stream for real-time trade data.
    Supports both spot and perpetual markets.

    Usage:
        connector = BinanceConnector(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
            on_trade=handle_trade,
            on_bar_complete=handle_bar,
        )
        await connector.start()
        # ... connector runs in background ...
        await connector.stop()
    """

    def __init__(
        self,
        asset: AssetId,
        market_type: MarketType,
        on_trade: Optional[Callable[[Trade], None]] = None,
        on_bar_complete: Optional[Callable[[Any], None]] = None,
        on_state_change: Optional[Callable[[Any], None]] = None,
    ):
        super().__init__(
            venue=VenueId.BINANCE,
            asset=asset,
            market_type=market_type,
            on_trade=on_trade,
            on_bar_complete=on_bar_complete,
            on_state_change=on_state_change,
        )

        # Validate symbol exists
        self._symbol = get_symbol(VenueId.BINANCE, asset, market_type)
        if not self._symbol:
            raise ValueError(
                f"Binance does not support {asset.value} {market_type.value}"
            )

        self._stream_name = get_stream_name(VenueId.BINANCE, asset, market_type)

    def get_ws_url(self) -> str:
        """Return Binance WebSocket URL based on market type."""
        config = VENUE_CONFIGS[VenueId.BINANCE]

        if self.market_type == MarketType.SPOT:
            base_url = config.ws_endpoint_spot
        else:
            base_url = config.ws_endpoint_perp

        if not base_url:
            raise ValueError(f"No WebSocket endpoint for Binance {self.market_type.value}")

        # Binance uses stream name in URL for single stream connection
        return f"{base_url}/{self._stream_name}@aggTrade"

    def build_subscription_message(self) -> dict[str, Any]:
        """
        Build Binance subscription message.

        Note: When connecting to a single stream URL (like ws/.../btcusdt@aggTrade),
        no subscription message is needed - the stream is implicit in the URL.
        However, for combined streams or dynamic subscriptions, we use this format.
        """
        return {
            "method": "SUBSCRIBE",
            "params": [f"{self._stream_name}@aggTrade"],
            "id": 1,
        }

    def parse_message(self, data: dict[str, Any]) -> list[Trade]:
        """
        Parse Binance message into Trade objects.

        Handles:
        - aggTrade events (primary trade source)
        - Subscription confirmations (ignored)
        - Error messages (logged)

        Returns:
            List of Trade objects (usually 0 or 1)
        """
        # Check for subscription response
        if "result" in data and data.get("id"):
            logger.debug(f"{self._log_prefix} Subscription confirmed: {data}")
            return []

        # Check for error
        if "error" in data:
            logger.error(f"{self._log_prefix} Error from Binance: {data['error']}")
            return []

        # Check for aggTrade event
        event_type = data.get("e")
        if event_type != "aggTrade":
            # Could be ping/pong or other event type
            logger.debug(f"{self._log_prefix} Ignoring event type: {event_type}")
            return []

        # Parse aggTrade
        try:
            trade = self._parse_agg_trade(data)
            return [trade] if trade else []
        except Exception as e:
            logger.warning(f"{self._log_prefix} Failed to parse trade: {e}, data: {data}")
            return []

    def _parse_agg_trade(self, data: dict[str, Any]) -> Optional[Trade]:
        """
        Parse a single aggTrade message.

        aggTrade format:
        {
            "e": "aggTrade",
            "E": 1672515782136,    // Event time
            "s": "BTCUSDT",        // Symbol
            "a": 164227032,        // Aggregate trade ID
            "p": "16825.43",       // Price (string)
            "q": "0.002",          // Quantity (string)
            "f": 322222344,        // First trade ID
            "l": 322222344,        // Last trade ID
            "T": 1672515782136,    // Trade time
            "m": true,             // Is buyer maker
            "M": true              // Ignore
        }
        """
        # Validate symbol matches
        symbol = data.get("s", "")
        if symbol.upper() != self._symbol.upper():
            logger.warning(
                f"{self._log_prefix} Symbol mismatch: got {symbol}, expected {self._symbol}"
            )
            return None

        # Parse fields
        try:
            price = float(data["p"])
            quantity = float(data["q"])
            trade_time_ms = int(data["T"])
            is_buyer_maker = bool(data.get("m", False))
        except (KeyError, ValueError, TypeError) as e:
            logger.warning(f"{self._log_prefix} Invalid trade data: {e}")
            return None

        # Validate price and quantity
        if price <= 0 or quantity <= 0:
            logger.warning(f"{self._log_prefix} Invalid price/quantity: {price}/{quantity}")
            return None

        return Trade(
            timestamp=trade_time_ms,
            local_timestamp=int(time.time() * 1000),
            price=price,
            quantity=quantity,
            is_buyer_maker=is_buyer_maker,
            venue=VenueId.BINANCE,
            asset=self.asset,
            market_type=self.market_type,
        )


class BinanceSpotConnector(BinanceConnector):
    """Convenience class for Binance spot connector."""

    def __init__(
        self,
        asset: AssetId,
        on_trade: Optional[Callable[[Trade], None]] = None,
        on_bar_complete: Optional[Callable[[Any], None]] = None,
        on_state_change: Optional[Callable[[Any], None]] = None,
    ):
        super().__init__(
            asset=asset,
            market_type=MarketType.SPOT,
            on_trade=on_trade,
            on_bar_complete=on_bar_complete,
            on_state_change=on_state_change,
        )


class BinancePerpConnector(BinanceConnector):
    """Convenience class for Binance perpetual connector."""

    def __init__(
        self,
        asset: AssetId,
        on_trade: Optional[Callable[[Trade], None]] = None,
        on_bar_complete: Optional[Callable[[Any], None]] = None,
        on_state_change: Optional[Callable[[Any], None]] = None,
    ):
        super().__init__(
            asset=asset,
            market_type=MarketType.PERP,
            on_trade=on_trade,
            on_bar_complete=on_bar_complete,
            on_state_change=on_state_change,
        )
