"""
OKX Venue Connector

WebSocket connector for OKX spot and perpetual markets.
OKX uses a JSON-based trade message format.

OKX WebSocket API v5:
- Endpoint: wss://ws.okx.com:8443/ws/v5/public
- Subscription: {"op": "subscribe", "args": [{"channel": "trades", "instId": "BTC-USDT"}]}

Trade message format:
{
    "arg": {
        "channel": "trades",
        "instId": "BTC-USDT"
    },
    "data": [
        {
            "instId": "BTC-USDT",
            "tradeId": "123456789",
            "px": "97500.0",
            "sz": "0.1",
            "side": "buy",        // taker's side: "buy" or "sell"
            "ts": "1635000000000" // millisecond timestamp
        }
    ]
}

OKX-specific notes:
- "side" indicates the taker's side directly
- Timestamps are milliseconds as strings
- Same WS endpoint for spot and perp (differentiated by instId)
- Perp symbols end with "-SWAP" (e.g., BTC-USDT-SWAP)
"""

import logging
import time
from typing import Any, Callable, Optional

from ..core.types import AssetId, MarketType, Trade, VenueId
from ..core.constants import VENUE_CONFIGS
from ..core.symbol_mapping import get_symbol
from .base import BaseConnector

logger = logging.getLogger(__name__)


class OKXConnector(BaseConnector):
    """
    OKX WebSocket connector.

    Connects to OKX trade stream for real-time trade data.
    Supports both spot and perpetual markets.

    Usage:
        connector = OKXSpotConnector(
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
        super().__init__(
            venue=VenueId.OKX,
            asset=asset,
            market_type=market_type,
            on_trade=on_trade,
            on_bar_complete=on_bar_complete,
            on_state_change=on_state_change,
        )

        # Validate symbol exists
        self._symbol = get_symbol(VenueId.OKX, asset, market_type)
        if not self._symbol:
            raise ValueError(
                f"OKX does not support {asset.value} {market_type.value}"
            )

    def get_ws_url(self) -> str:
        """Return OKX WebSocket URL (same for spot and perp)."""
        config = VENUE_CONFIGS[VenueId.OKX]
        # OKX uses same endpoint for both, but config may have separate fields
        if self.market_type == MarketType.SPOT:
            return config.ws_endpoint_spot
        return config.ws_endpoint_perp or config.ws_endpoint_spot

    def build_subscription_message(self) -> dict[str, Any]:
        """
        Build OKX subscription message.

        Subscribes to the "trades" channel for real-time trades.
        """
        return {
            "op": "subscribe",
            "args": [
                {
                    "channel": "trades",
                    "instId": self._symbol,
                }
            ],
        }

    def parse_message(self, data: Any) -> list[Trade]:
        """
        Parse OKX message into Trade objects.

        OKX message types:
        - Subscription response: {"event": "subscribe", "arg": {...}}
        - Error: {"event": "error", "code": "...", "msg": "..."}
        - Trade data: {"arg": {"channel": "trades", ...}, "data": [...]}

        Returns:
            List of Trade objects (may be empty or multiple)
        """
        if not isinstance(data, dict):
            logger.warning(f"{self._log_prefix} Unexpected message type: {type(data)}")
            return []

        # Check for event messages (subscribe confirmation, errors)
        event = data.get("event")
        if event:
            return self._parse_event_message(data)

        # Check for trade data
        if "data" in data and "arg" in data:
            return self._parse_trade_message(data)

        logger.debug(f"{self._log_prefix} Ignoring unknown message format")
        return []

    def _parse_event_message(self, data: dict[str, Any]) -> list[Trade]:
        """Parse OKX event messages (subscribe, error, etc.)."""
        event = data.get("event")

        if event == "subscribe":
            arg = data.get("arg", {})
            channel = arg.get("channel")
            inst_id = arg.get("instId")
            logger.info(
                f"{self._log_prefix} Subscribed to {channel} for {inst_id}"
            )
            return []

        if event == "error":
            code = data.get("code", "unknown")
            msg = data.get("msg", "Unknown error")
            logger.error(f"{self._log_prefix} Error {code}: {msg}")
            return []

        if event == "unsubscribe":
            logger.info(f"{self._log_prefix} Unsubscribed")
            return []

        logger.debug(f"{self._log_prefix} Ignoring event: {event}")
        return []

    def _parse_trade_message(self, data: dict[str, Any]) -> list[Trade]:
        """
        Parse OKX trade data message.

        Format:
        {
            "arg": {"channel": "trades", "instId": "BTC-USDT"},
            "data": [
                {
                    "instId": "BTC-USDT",
                    "tradeId": "123456789",
                    "px": "97500.0",
                    "sz": "0.1",
                    "side": "buy",
                    "ts": "1635000000000"
                }
            ]
        }
        """
        arg = data.get("arg", {})
        channel = arg.get("channel")

        # Only process trades channel
        if channel != "trades":
            logger.debug(f"{self._log_prefix} Ignoring channel: {channel}")
            return []

        # Validate instId matches
        inst_id = arg.get("instId")
        if inst_id and inst_id.upper() != self._symbol.upper():
            logger.warning(
                f"{self._log_prefix} instId mismatch: got {inst_id}, expected {self._symbol}"
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
        Parse a single trade from OKX format.

        Trade format:
        {
            "instId": "BTC-USDT",
            "tradeId": "123456789",
            "px": "97500.0",       // price
            "sz": "0.1",           // size/quantity
            "side": "buy",         // taker's side
            "ts": "1635000000000"  // timestamp ms
        }
        """
        try:
            price = float(item.get("px", 0))
            quantity = float(item.get("sz", 0))
            side = item.get("side", "")
            ts_str = item.get("ts", "")
        except (ValueError, TypeError) as e:
            logger.warning(f"{self._log_prefix} Failed to parse trade fields: {e}")
            return None

        # Validate price and quantity
        if price <= 0 or quantity <= 0:
            logger.warning(f"{self._log_prefix} Invalid price/quantity: {price}/{quantity}")
            return None

        # Parse timestamp (OKX sends ms as string)
        try:
            trade_time_ms = int(ts_str)
        except (ValueError, TypeError):
            logger.warning(f"{self._log_prefix} Failed to parse timestamp: {ts_str}")
            trade_time_ms = int(time.time() * 1000)

        # OKX "side" is the taker's side directly
        # If side = "sell", taker sold, buyer was maker (is_buyer_maker = True)
        # If side = "buy", taker bought, seller was maker (is_buyer_maker = False)
        is_buyer_maker = (side.lower() == "sell")

        return Trade(
            timestamp=trade_time_ms,
            local_timestamp=int(time.time() * 1000),
            price=price,
            quantity=quantity,
            is_buyer_maker=is_buyer_maker,
            venue=VenueId.OKX,
            asset=self.asset,
            market_type=self.market_type,
        )


class OKXSpotConnector(OKXConnector):
    """OKX spot market connector."""

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


class OKXPerpConnector(OKXConnector):
    """OKX perpetual market connector."""

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
