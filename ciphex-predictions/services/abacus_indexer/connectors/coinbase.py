"""
Coinbase Venue Connector

WebSocket connector for Coinbase spot markets.
Coinbase uses the "matches" channel for trade data.

Coinbase WebSocket API:
- Endpoint: wss://ws-feed.exchange.coinbase.com
- Subscription format: {"type": "subscribe", "product_ids": [...], "channels": ["matches"]}

Match message format:
{
    "type": "match",
    "trade_id": 10,
    "sequence": 50,
    "maker_order_id": "ac928c66-...",
    "taker_order_id": "132fb6ae-...",
    "time": "2014-11-07T08:19:27.028459Z",
    "product_id": "BTC-USD",
    "size": "5.23512",
    "price": "400.23",
    "side": "sell"
}

Note: Coinbase does not support perpetuals.
"""

import logging
import time
from typing import Any, Callable, Optional

from ..core.types import AssetId, MarketType, Trade, VenueId
from ..core.constants import VENUE_CONFIGS
from ..core.symbol_mapping import get_symbol
from .base import BaseConnector

logger = logging.getLogger(__name__)


class CoinbaseConnector(BaseConnector):
    """
    Coinbase WebSocket connector.

    Connects to Coinbase matches channel for real-time trade data.
    Supports spot markets only (Coinbase does not have perpetuals).

    Usage:
        connector = CoinbaseConnector(
            asset=AssetId.BTC,
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
        on_trade: Optional[Callable[[Trade], None]] = None,
        on_bar_complete: Optional[Callable[[Any], None]] = None,
        on_state_change: Optional[Callable[[Any], None]] = None,
    ):
        # Coinbase only supports spot
        market_type = MarketType.SPOT

        super().__init__(
            venue=VenueId.COINBASE,
            asset=asset,
            market_type=market_type,
            on_trade=on_trade,
            on_bar_complete=on_bar_complete,
            on_state_change=on_state_change,
        )

        # Validate symbol exists
        self._symbol = get_symbol(VenueId.COINBASE, asset, market_type)
        if not self._symbol:
            raise ValueError(
                f"Coinbase does not support {asset.value} {market_type.value}"
            )

    def get_ws_url(self) -> str:
        """Return Coinbase WebSocket URL."""
        config = VENUE_CONFIGS[VenueId.COINBASE]
        return config.ws_endpoint_spot

    def build_subscription_message(self) -> dict[str, Any]:
        """
        Build Coinbase subscription message.

        Subscribes to the "matches" channel for trade data.
        """
        return {
            "type": "subscribe",
            "product_ids": [self._symbol],
            "channels": ["matches"],
        }

    def parse_message(self, data: dict[str, Any]) -> list[Trade]:
        """
        Parse Coinbase message into Trade objects.

        Handles:
        - match events (trade executions)
        - subscriptions/heartbeat/error (ignored)

        Returns:
            List of Trade objects (usually 0 or 1)
        """
        msg_type = data.get("type")

        # Check for subscription confirmation
        if msg_type == "subscriptions":
            logger.debug(f"{self._log_prefix} Subscription confirmed: {data}")
            return []

        # Check for error
        if msg_type == "error":
            logger.error(f"{self._log_prefix} Error from Coinbase: {data.get('message')}")
            return []

        # Check for heartbeat
        if msg_type == "heartbeat":
            return []

        # Check for match (trade) event
        if msg_type != "match":
            logger.debug(f"{self._log_prefix} Ignoring message type: {msg_type}")
            return []

        # Parse match
        try:
            trade = self._parse_match(data)
            return [trade] if trade else []
        except Exception as e:
            logger.warning(f"{self._log_prefix} Failed to parse match: {e}, data: {data}")
            return []

    def _parse_match(self, data: dict[str, Any]) -> Optional[Trade]:
        """
        Parse a single match message.

        Match format:
        {
            "type": "match",
            "trade_id": 10,
            "sequence": 50,
            "maker_order_id": "ac928c66-...",
            "taker_order_id": "132fb6ae-...",
            "time": "2014-11-07T08:19:27.028459Z",
            "product_id": "BTC-USD",
            "size": "5.23512",
            "price": "400.23",
            "side": "sell"  // sell = taker sold (buyer was maker)
        }
        """
        # Validate product_id matches
        product_id = data.get("product_id", "")
        if product_id != self._symbol:
            logger.warning(
                f"{self._log_prefix} Product mismatch: got {product_id}, expected {self._symbol}"
            )
            return None

        # Parse fields
        try:
            price = float(data["price"])
            quantity = float(data["size"])
            time_str = data["time"]
            side = data.get("side", "")
        except (KeyError, ValueError, TypeError) as e:
            logger.warning(f"{self._log_prefix} Invalid match data: {e}")
            return None

        # Validate price and quantity
        if price <= 0 or quantity <= 0:
            logger.warning(f"{self._log_prefix} Invalid price/quantity: {price}/{quantity}")
            return None

        # Parse timestamp (ISO 8601 format)
        try:
            from datetime import datetime
            # Handle both with and without microseconds
            time_str = time_str.replace("Z", "+00:00")
            dt = datetime.fromisoformat(time_str)
            trade_time_ms = int(dt.timestamp() * 1000)
        except Exception as e:
            logger.warning(f"{self._log_prefix} Failed to parse time: {e}")
            trade_time_ms = int(time.time() * 1000)

        # Coinbase "side" indicates the taker's side
        # If side = "sell", taker sold, so buyer was maker (is_buyer_maker = True)
        # If side = "buy", taker bought, so seller was maker (is_buyer_maker = False)
        is_buyer_maker = (side == "sell")

        return Trade(
            timestamp=trade_time_ms,
            local_timestamp=int(time.time() * 1000),
            price=price,
            quantity=quantity,
            is_buyer_maker=is_buyer_maker,
            venue=VenueId.COINBASE,
            asset=self.asset,
            market_type=self.market_type,
        )


class CoinbaseSpotConnector(CoinbaseConnector):
    """Convenience class for Coinbase spot connector (same as CoinbaseConnector)."""
    pass
