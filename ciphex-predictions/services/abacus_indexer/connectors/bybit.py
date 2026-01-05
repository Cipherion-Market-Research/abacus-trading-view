"""
Bybit Venue Connector

WebSocket connector for Bybit perpetual markets (linear USDT).
Bybit uses a JSON-based trade message format via v5 API.

Bybit WebSocket API v5:
- Endpoint: wss://stream.bybit.com/v5/public/linear
- Subscription: {"op": "subscribe", "args": ["publicTrade.BTCUSDT"]}

Trade message format:
{
    "topic": "publicTrade.BTCUSDT",
    "type": "snapshot",
    "ts": 1672304486868,
    "data": [
        {
            "i": "trade-id",
            "T": 1672304486865,  // timestamp ms
            "p": "16578.5",      // price
            "v": "0.001",        // quantity (size)
            "S": "Buy",          // taker's side: "Buy" or "Sell"
            "s": "BTCUSDT",      // symbol
            "BT": false          // block trade flag
        }
    ]
}

Bybit-specific notes:
- "S" indicates the taker's side directly ("Buy" or "Sell")
- Timestamps are milliseconds as integers
- Linear perpetuals only (category=linear)
- No spot support in our scope
"""

import logging
import time
from typing import Any, Callable, Optional

from ..core.types import AssetId, MarketType, Trade, VenueId
from ..core.constants import VENUE_CONFIGS
from ..core.symbol_mapping import get_symbol
from .base import BaseConnector

logger = logging.getLogger(__name__)


class BybitConnector(BaseConnector):
    """
    Bybit WebSocket connector.

    Connects to Bybit trade stream for real-time trade data.
    Supports perpetual markets only (linear USDT).

    Usage:
        connector = BybitPerpConnector(
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
        market_type: MarketType,
        on_trade: Optional[Callable[[Trade], None]] = None,
        on_bar_complete: Optional[Callable[[Any], None]] = None,
        on_state_change: Optional[Callable[[Any], None]] = None,
    ):
        # Bybit only supports perp in our scope
        if market_type != MarketType.PERP:
            raise ValueError(f"Bybit connector only supports PERP, got {market_type}")

        super().__init__(
            venue=VenueId.BYBIT,
            asset=asset,
            market_type=market_type,
            on_trade=on_trade,
            on_bar_complete=on_bar_complete,
            on_state_change=on_state_change,
        )

        # Validate symbol exists
        self._symbol = get_symbol(VenueId.BYBIT, asset, market_type)
        if not self._symbol:
            raise ValueError(
                f"Bybit does not support {asset.value} {market_type.value}"
            )

    def get_ws_url(self) -> str:
        """Return Bybit WebSocket URL for linear perpetuals."""
        config = VENUE_CONFIGS[VenueId.BYBIT]
        return config.ws_endpoint_perp

    def build_subscription_message(self) -> dict[str, Any]:
        """
        Build Bybit subscription message.

        Subscribes to publicTrade topic for real-time trades.
        Format: {"op": "subscribe", "args": ["publicTrade.BTCUSDT"]}
        """
        topic = f"publicTrade.{self._symbol}"
        return {
            "op": "subscribe",
            "args": [topic],
        }

    def parse_message(self, data: Any) -> list[Trade]:
        """
        Parse Bybit message into Trade objects.

        Bybit message types:
        - Subscription response: {"success": true, "ret_msg": "", "op": "subscribe", ...}
        - Pong: {"success": true, "ret_msg": "pong", "op": "ping", ...}
        - Trade data: {"topic": "publicTrade.BTCUSDT", "type": "snapshot", "data": [...]}

        Returns:
            List of Trade objects (may be empty or multiple)
        """
        if not isinstance(data, dict):
            logger.warning(f"{self._log_prefix} Unexpected message type: {type(data)}")
            return []

        # Check for operation responses (subscribe, ping/pong)
        if "op" in data:
            return self._parse_op_message(data)

        # Check for trade data (has "topic" and "data")
        if "topic" in data and "data" in data:
            return self._parse_trade_message(data)

        logger.debug(f"{self._log_prefix} Ignoring unknown message format")
        return []

    def _parse_op_message(self, data: dict[str, Any]) -> list[Trade]:
        """Parse Bybit operation response messages."""
        op = data.get("op", "")
        success = data.get("success", False)
        ret_msg = data.get("ret_msg", "")

        if op == "subscribe":
            if success:
                conn_id = data.get("conn_id", "unknown")
                logger.info(
                    f"{self._log_prefix} Subscribed to trades for {self._symbol}"
                )
            else:
                logger.error(
                    f"{self._log_prefix} Subscribe failed: {ret_msg}"
                )
            return []

        if op == "ping":
            # Pong response, ignore
            return []

        logger.debug(f"{self._log_prefix} Ignoring op message: {op}")
        return []

    def _parse_trade_message(self, data: dict[str, Any]) -> list[Trade]:
        """
        Parse Bybit trade data message.

        Format:
        {
            "topic": "publicTrade.BTCUSDT",
            "type": "snapshot",
            "ts": 1672304486868,
            "data": [
                {
                    "i": "trade-id",
                    "T": 1672304486865,
                    "p": "16578.5",
                    "v": "0.001",
                    "S": "Buy",
                    "s": "BTCUSDT",
                    "BT": false
                }
            ]
        }
        """
        topic = data.get("topic", "")

        # Validate topic matches our subscription
        expected_topic = f"publicTrade.{self._symbol}"
        if topic != expected_topic:
            logger.warning(
                f"{self._log_prefix} Topic mismatch: got {topic}, expected {expected_topic}"
            )
            return []

        # Parse trade data array
        trade_data = data.get("data", [])
        if not isinstance(trade_data, list):
            logger.warning(f"{self._log_prefix} Invalid data format: {type(trade_data)}")
            return []

        trades = []
        for item in trade_data:
            trade = self._parse_single_trade(item)
            if trade:
                trades.append(trade)

        return trades

    def _parse_single_trade(self, item: dict[str, Any]) -> Optional[Trade]:
        """
        Parse a single trade from Bybit format.

        Trade format:
        {
            "i": "trade-id",
            "T": 1672304486865,  // timestamp ms
            "p": "16578.5",      // price
            "v": "0.001",        // quantity
            "S": "Buy",          // taker's side
            "s": "BTCUSDT",      // symbol
            "BT": false          // block trade
        }
        """
        try:
            price = float(item.get("p", 0))
            quantity = float(item.get("v", 0))
            side = item.get("S", "")
            timestamp_ms = item.get("T", 0)
        except (ValueError, TypeError) as e:
            logger.warning(f"{self._log_prefix} Failed to parse trade fields: {e}")
            return None

        # Validate price and quantity
        if price <= 0 or quantity <= 0:
            logger.warning(f"{self._log_prefix} Invalid price/quantity: {price}/{quantity}")
            return None

        # Parse timestamp
        if not isinstance(timestamp_ms, int):
            try:
                timestamp_ms = int(timestamp_ms)
            except (ValueError, TypeError):
                logger.warning(f"{self._log_prefix} Invalid timestamp: {timestamp_ms}")
                timestamp_ms = int(time.time() * 1000)

        # Bybit "S" is the taker's side directly
        # If S = "Sell", taker sold, buyer was maker (is_buyer_maker = True)
        # If S = "Buy", taker bought, seller was maker (is_buyer_maker = False)
        is_buyer_maker = (side.lower() == "sell")

        return Trade(
            timestamp=timestamp_ms,
            local_timestamp=int(time.time() * 1000),
            price=price,
            quantity=quantity,
            is_buyer_maker=is_buyer_maker,
            venue=VenueId.BYBIT,
            asset=self.asset,
            market_type=self.market_type,
        )


class BybitPerpConnector(BybitConnector):
    """Bybit perpetual market connector."""

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
