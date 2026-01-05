"""
Kraken Venue Connector

WebSocket connector for Kraken spot markets.
Kraken uses a unique message format with array-based trade data.

Kraken WebSocket API:
- Endpoint: wss://ws.kraken.com
- Subscription: {"event": "subscribe", "pair": [...], "subscription": {"name": "trade"}}

Trade message format (array-based):
[
    0,                          // channelID (int)
    [                           // Array of trades
        [
            "5541.20000",       // price (string)
            "0.15850568",       // volume (string)
            "1534614057.321597",// time (unix timestamp with microseconds)
            "s",                // side: s=sell (taker sold), b=buy (taker bought)
            "l",                // orderType: l=limit, m=market
            ""                  // misc
        ],
        ...
    ],
    "trade",                    // channelName
    "XBT/USD"                   // pair
]

Note: Kraken uses XBT instead of BTC for Bitcoin.
"""

import logging
import time
from typing import Any, Callable, Optional

from ..core.types import AssetId, MarketType, Trade, VenueId
from ..core.constants import VENUE_CONFIGS
from ..core.symbol_mapping import get_symbol
from .base import BaseConnector

logger = logging.getLogger(__name__)


class KrakenConnector(BaseConnector):
    """
    Kraken WebSocket connector.

    Connects to Kraken trade stream for real-time trade data.
    Supports spot markets only (Kraken perps not in scope for v0).

    Usage:
        connector = KrakenConnector(
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
        # Kraken only supports spot in our implementation
        market_type = MarketType.SPOT

        super().__init__(
            venue=VenueId.KRAKEN,
            asset=asset,
            market_type=market_type,
            on_trade=on_trade,
            on_bar_complete=on_bar_complete,
            on_state_change=on_state_change,
        )

        # Validate symbol exists
        self._symbol = get_symbol(VenueId.KRAKEN, asset, market_type)
        if not self._symbol:
            raise ValueError(
                f"Kraken does not support {asset.value} {market_type.value}"
            )

        # Track channelID after subscription
        self._channel_id: Optional[int] = None

    def get_ws_url(self) -> str:
        """Return Kraken WebSocket URL."""
        config = VENUE_CONFIGS[VenueId.KRAKEN]
        return config.ws_endpoint_spot

    def build_subscription_message(self) -> dict[str, Any]:
        """
        Build Kraken subscription message.

        Subscribes to the "trade" channel for real-time trades.
        """
        return {
            "event": "subscribe",
            "pair": [self._symbol],
            "subscription": {
                "name": "trade",
            },
        }

    def parse_message(self, data: Any) -> list[Trade]:
        """
        Parse Kraken message into Trade objects.

        Kraken uses different message structures:
        - dict: System messages (subscription status, heartbeat, errors)
        - list: Trade data arrays

        Handles:
        - subscriptionStatus events (track channelID)
        - heartbeat events (ignored)
        - systemStatus events (ignored)
        - Trade arrays (primary data source)

        Returns:
            List of Trade objects (may be empty or multiple)
        """
        # Dict messages are system/subscription messages
        if isinstance(data, dict):
            return self._parse_system_message(data)

        # List messages are trade data
        if isinstance(data, list):
            return self._parse_trade_array(data)

        logger.warning(f"{self._log_prefix} Unexpected message type: {type(data)}")
        return []

    def _parse_system_message(self, data: dict[str, Any]) -> list[Trade]:
        """Parse system messages (subscription, heartbeat, etc.)."""
        event = data.get("event")

        if event == "subscriptionStatus":
            status = data.get("status")
            pair = data.get("pair")
            channel_id = data.get("channelID")

            if status == "subscribed":
                self._channel_id = channel_id
                logger.info(
                    f"{self._log_prefix} Subscribed to {pair} (channelID: {channel_id})"
                )
            elif status == "error":
                error_msg = data.get("errorMessage", "Unknown error")
                logger.error(f"{self._log_prefix} Subscription error: {error_msg}")
            return []

        if event == "heartbeat":
            return []

        if event == "systemStatus":
            status = data.get("status")
            logger.debug(f"{self._log_prefix} System status: {status}")
            return []

        if event == "pong":
            return []

        logger.debug(f"{self._log_prefix} Ignoring event: {event}")
        return []

    def _parse_trade_array(self, data: list) -> list[Trade]:
        """
        Parse Kraken trade array.

        Format:
        [
            channelID,          // int
            [[price, volume, time, side, orderType, misc], ...],
            "trade",            // channelName
            "XBT/USD"           // pair
        ]
        """
        # Validate array structure
        if len(data) < 4:
            logger.debug(f"{self._log_prefix} Short array message: {len(data)} elements")
            return []

        channel_name = data[-2] if len(data) >= 2 else None
        pair = data[-1] if len(data) >= 1 else None

        # Only process trade channel messages
        if channel_name != "trade":
            logger.debug(f"{self._log_prefix} Ignoring channel: {channel_name}")
            return []

        # Validate pair matches (Kraken uses uppercase)
        if pair and pair.upper() != self._symbol.upper():
            logger.warning(
                f"{self._log_prefix} Pair mismatch: got {pair}, expected {self._symbol}"
            )
            return []

        # Extract trade array (second element)
        trade_array = data[1]
        if not isinstance(trade_array, list):
            logger.warning(f"{self._log_prefix} Invalid trade array type: {type(trade_array)}")
            return []

        # Parse each trade in the array
        trades = []
        for trade_data in trade_array:
            trade = self._parse_single_trade(trade_data)
            if trade:
                trades.append(trade)

        return trades

    def _parse_single_trade(self, trade_data: list) -> Optional[Trade]:
        """
        Parse a single trade from Kraken format.

        Trade format:
        [
            "5541.20000",       // price (string)
            "0.15850568",       // volume (string)
            "1534614057.321597",// time (unix timestamp with microseconds)
            "s",                // side: s=sell, b=buy (taker's side)
            "l",                // orderType: l=limit, m=market
            ""                  // misc
        ]
        """
        if not isinstance(trade_data, list) or len(trade_data) < 4:
            logger.warning(f"{self._log_prefix} Invalid trade data format: {trade_data}")
            return None

        try:
            price = float(trade_data[0])
            volume = float(trade_data[1])
            time_str = trade_data[2]
            side = trade_data[3]
        except (IndexError, ValueError, TypeError) as e:
            logger.warning(f"{self._log_prefix} Failed to parse trade data: {e}")
            return None

        # Validate price and volume
        if price <= 0 or volume <= 0:
            logger.warning(f"{self._log_prefix} Invalid price/volume: {price}/{volume}")
            return None

        # Parse timestamp (Kraken sends unix timestamp with microseconds as string)
        try:
            timestamp_float = float(time_str)
            trade_time_ms = int(timestamp_float * 1000)
        except (ValueError, TypeError) as e:
            logger.warning(f"{self._log_prefix} Failed to parse timestamp: {e}")
            trade_time_ms = int(time.time() * 1000)

        # Kraken "side" indicates the taker's side
        # If side = "s" (sell), taker sold, so buyer was maker (is_buyer_maker = True)
        # If side = "b" (buy), taker bought, so seller was maker (is_buyer_maker = False)
        is_buyer_maker = (side == "s")

        return Trade(
            timestamp=trade_time_ms,
            local_timestamp=int(time.time() * 1000),
            price=price,
            quantity=volume,
            is_buyer_maker=is_buyer_maker,
            venue=VenueId.KRAKEN,
            asset=self.asset,
            market_type=self.market_type,
        )


class KrakenSpotConnector(KrakenConnector):
    """Convenience class for Kraken spot connector (same as KrakenConnector)."""
    pass
