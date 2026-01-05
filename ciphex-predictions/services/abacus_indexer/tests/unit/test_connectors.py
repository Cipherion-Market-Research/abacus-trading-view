"""
Unit tests for Abacus Indexer Connectors.

Tests WebSocket connector implementations including:
- Binance connector message parsing
- URL generation for spot/perp markets
- Trade object creation from venue-specific formats
- Telemetry tracking
"""

import pytest
from unittest.mock import MagicMock, AsyncMock

from services.abacus_indexer.core.types import (
    AssetId,
    MarketType,
    Trade,
    VenueId,
    ConnectionState,
)
from services.abacus_indexer.connectors.base import BaseConnector, ConnectorState
from services.abacus_indexer.connectors.binance import (
    BinanceConnector,
    BinanceSpotConnector,
    BinancePerpConnector,
)
from services.abacus_indexer.connectors.coinbase import (
    CoinbaseConnector,
    CoinbaseSpotConnector,
)
from services.abacus_indexer.connectors.kraken import (
    KrakenConnector,
    KrakenSpotConnector,
)
from services.abacus_indexer.connectors.okx import (
    OKXConnector,
    OKXSpotConnector,
    OKXPerpConnector,
)
from services.abacus_indexer.connectors.bybit import (
    BybitConnector,
    BybitPerpConnector,
)


class TestBinanceConnector:
    """Tests for Binance WebSocket connector."""

    def test_spot_ws_url(self):
        """Spot connector should use stream.binance.com."""
        connector = BinanceConnector(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )
        url = connector.get_ws_url()
        assert "stream.binance.com" in url
        assert "btcusdt@aggTrade" in url

    def test_perp_ws_url(self):
        """Perp connector should use fstream.binance.com."""
        connector = BinanceConnector(
            asset=AssetId.BTC,
            market_type=MarketType.PERP,
        )
        url = connector.get_ws_url()
        assert "fstream.binance.com" in url
        assert "btcusdt@aggTrade" in url

    def test_eth_spot_url(self):
        """ETH spot should use correct symbol."""
        connector = BinanceConnector(
            asset=AssetId.ETH,
            market_type=MarketType.SPOT,
        )
        url = connector.get_ws_url()
        assert "ethusdt@aggTrade" in url

    def test_subscription_message_format(self):
        """Subscription message should follow Binance format."""
        connector = BinanceConnector(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )
        msg = connector.build_subscription_message()

        assert msg["method"] == "SUBSCRIBE"
        assert "btcusdt@aggTrade" in msg["params"]
        assert msg["id"] == 1

    def test_parse_agg_trade_valid(self):
        """Valid aggTrade message should produce Trade object."""
        connector = BinanceConnector(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        # Binance aggTrade format
        data = {
            "e": "aggTrade",
            "E": 1672515782136,
            "s": "BTCUSDT",
            "a": 164227032,
            "p": "16825.43",
            "q": "0.002",
            "f": 322222344,
            "l": 322222344,
            "T": 1672515782100,
            "m": True,
            "M": True,
        }

        trades = connector.parse_message(data)

        assert len(trades) == 1
        trade = trades[0]
        assert trade.price == 16825.43
        assert trade.quantity == 0.002
        assert trade.timestamp == 1672515782100
        assert trade.is_buyer_maker is True
        assert trade.venue == VenueId.BINANCE
        assert trade.asset == AssetId.BTC
        assert trade.market_type == MarketType.SPOT

    def test_parse_agg_trade_seller_maker(self):
        """Seller-maker trade should have is_buyer_maker=False."""
        connector = BinanceConnector(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        data = {
            "e": "aggTrade",
            "E": 1672515782136,
            "s": "BTCUSDT",
            "a": 164227032,
            "p": "16825.43",
            "q": "0.002",
            "f": 322222344,
            "l": 322222344,
            "T": 1672515782100,
            "m": False,  # seller is maker
            "M": True,
        }

        trades = connector.parse_message(data)

        assert len(trades) == 1
        assert trades[0].is_buyer_maker is False

    def test_parse_subscription_response_ignored(self):
        """Subscription confirmation should return empty list."""
        connector = BinanceConnector(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        data = {"result": None, "id": 1}
        trades = connector.parse_message(data)

        assert trades == []

    def test_parse_error_response(self):
        """Error response should return empty list and log."""
        connector = BinanceConnector(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        data = {"error": {"code": -1, "msg": "Unknown error"}}
        trades = connector.parse_message(data)

        assert trades == []

    def test_parse_wrong_event_type(self):
        """Non-aggTrade events should return empty list."""
        connector = BinanceConnector(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        data = {"e": "depthUpdate", "data": {}}
        trades = connector.parse_message(data)

        assert trades == []

    def test_parse_symbol_mismatch(self):
        """Wrong symbol should return empty list."""
        connector = BinanceConnector(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        data = {
            "e": "aggTrade",
            "E": 1672515782136,
            "s": "ETHUSDT",  # Wrong symbol!
            "a": 164227032,
            "p": "1825.43",
            "q": "0.5",
            "T": 1672515782100,
            "m": True,
        }

        trades = connector.parse_message(data)

        assert trades == []

    def test_parse_invalid_price_zero(self):
        """Zero price should return empty list."""
        connector = BinanceConnector(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        data = {
            "e": "aggTrade",
            "E": 1672515782136,
            "s": "BTCUSDT",
            "a": 164227032,
            "p": "0",  # Invalid
            "q": "0.002",
            "T": 1672515782100,
            "m": True,
        }

        trades = connector.parse_message(data)

        assert trades == []

    def test_parse_invalid_quantity_negative(self):
        """Negative quantity should return empty list."""
        connector = BinanceConnector(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        data = {
            "e": "aggTrade",
            "E": 1672515782136,
            "s": "BTCUSDT",
            "a": 164227032,
            "p": "16825.43",
            "q": "-0.002",  # Invalid
            "T": 1672515782100,
            "m": True,
        }

        trades = connector.parse_message(data)

        assert trades == []

    def test_parse_missing_required_field(self):
        """Missing required field should return empty list."""
        connector = BinanceConnector(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        data = {
            "e": "aggTrade",
            "E": 1672515782136,
            "s": "BTCUSDT",
            # Missing "p" (price)
            "q": "0.002",
            "T": 1672515782100,
            "m": True,
        }

        trades = connector.parse_message(data)

        assert trades == []


class TestBinanceConvenienceClasses:
    """Tests for BinanceSpotConnector and BinancePerpConnector."""

    def test_spot_connector_market_type(self):
        """BinanceSpotConnector should have SPOT market type."""
        connector = BinanceSpotConnector(asset=AssetId.BTC)
        assert connector.market_type == MarketType.SPOT

    def test_perp_connector_market_type(self):
        """BinancePerpConnector should have PERP market type."""
        connector = BinancePerpConnector(asset=AssetId.BTC)
        assert connector.market_type == MarketType.PERP

    def test_spot_connector_venue(self):
        """Both convenience classes should have BINANCE venue."""
        spot = BinanceSpotConnector(asset=AssetId.BTC)
        perp = BinancePerpConnector(asset=AssetId.ETH)

        assert spot.venue == VenueId.BINANCE
        assert perp.venue == VenueId.BINANCE


class TestConnectorState:
    """Tests for ConnectorState dataclass."""

    def test_initial_state(self):
        """Initial state should be disconnected with zero counts."""
        state = ConnectorState()

        assert state.connection_state == ConnectionState.DISCONNECTED
        assert state.last_message_time_ms is None
        assert state.message_count == 0
        assert state.trade_count == 0
        assert state.reconnect_count == 0
        assert state.session_start_time_ms is None
        assert state.last_error is None

    def test_state_mutation(self):
        """State should be mutable."""
        state = ConnectorState()

        state.connection_state = ConnectionState.CONNECTED
        state.message_count = 100
        state.trade_count = 50

        assert state.connection_state == ConnectionState.CONNECTED
        assert state.message_count == 100
        assert state.trade_count == 50


class TestBaseConnectorTelemetry:
    """Tests for BaseConnector telemetry methods."""

    def test_get_telemetry_initial(self):
        """Telemetry should report initial state correctly."""
        connector = BinanceConnector(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        telemetry = connector.get_telemetry()

        assert telemetry.venue == VenueId.BINANCE
        assert telemetry.market_type == MarketType.SPOT
        assert telemetry.asset == AssetId.BTC
        assert telemetry.connection_state == ConnectionState.DISCONNECTED
        assert telemetry.message_count == 0
        assert telemetry.trade_count == 0

    def test_is_connected_initial(self):
        """is_connected should return False initially."""
        connector = BinanceConnector(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        assert connector.is_connected() is False

    def test_get_current_price_initial(self):
        """Current price should be None initially."""
        connector = BinanceConnector(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        assert connector.get_current_price() is None

    def test_get_last_update_time_initial(self):
        """Last update time should be None initially."""
        connector = BinanceConnector(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        assert connector.get_last_update_time() is None


class TestConnectorCallbacks:
    """Tests for connector callback functionality."""

    def test_on_trade_callback(self):
        """on_trade callback should be stored."""
        mock_callback = MagicMock()
        connector = BinanceConnector(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
            on_trade=mock_callback,
        )

        assert connector.on_trade is mock_callback

    def test_on_bar_complete_callback(self):
        """on_bar_complete callback should be stored."""
        mock_callback = MagicMock()
        connector = BinanceConnector(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
            on_bar_complete=mock_callback,
        )

        assert connector.on_bar_complete is mock_callback

    def test_on_state_change_callback(self):
        """on_state_change callback should be stored."""
        mock_callback = MagicMock()
        connector = BinanceConnector(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
            on_state_change=mock_callback,
        )

        assert connector.on_state_change is mock_callback


class TestBarBuilderIntegration:
    """Tests for connector-BarBuilder integration."""

    def test_bar_builder_exists(self):
        """Connector should have a BarBuilder."""
        connector = BinanceConnector(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        assert connector.bar_builder is not None
        assert connector.bar_builder.venue == VenueId.BINANCE
        assert connector.bar_builder.asset == AssetId.BTC
        assert connector.bar_builder.market_type == MarketType.SPOT


class TestCamelCaseSerialization:
    """Tests for camelCase API serialization."""

    def test_trade_camel_case(self):
        """Trade should serialize with camelCase keys."""
        trade = Trade(
            timestamp=1672515782100,
            local_timestamp=1672515782200,
            price=16825.43,
            quantity=0.002,
            is_buyer_maker=True,
            venue=VenueId.BINANCE,
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        data = trade.model_dump(by_alias=True)

        # Check camelCase keys
        assert "localTimestamp" in data
        assert "isBuyerMaker" in data
        assert "marketType" in data

        # Check snake_case keys are NOT present when using alias
        assert "local_timestamp" not in data
        assert "is_buyer_maker" not in data
        assert "market_type" not in data

    def test_trade_snake_case_internal(self):
        """Trade should use snake_case for internal access."""
        trade = Trade(
            timestamp=1672515782100,
            local_timestamp=1672515782200,
            price=16825.43,
            quantity=0.002,
            is_buyer_maker=True,
            venue=VenueId.BINANCE,
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        # Internal access uses snake_case
        assert trade.local_timestamp == 1672515782200
        assert trade.is_buyer_maker is True
        assert trade.market_type == MarketType.SPOT

    def test_trade_json_serialization(self):
        """Trade JSON should use camelCase."""
        trade = Trade(
            timestamp=1672515782100,
            local_timestamp=1672515782200,
            price=16825.43,
            quantity=0.002,
            is_buyer_maker=True,
            venue=VenueId.BINANCE,
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        json_str = trade.model_dump_json(by_alias=True)

        assert '"isBuyerMaker"' in json_str
        assert '"localTimestamp"' in json_str
        assert '"marketType"' in json_str


class TestCoinbaseConnector:
    """Tests for Coinbase WebSocket connector."""

    def test_ws_url(self):
        """Coinbase connector should use ws-feed.exchange.coinbase.com."""
        connector = CoinbaseConnector(asset=AssetId.BTC)
        url = connector.get_ws_url()
        assert "ws-feed.exchange.coinbase.com" in url

    def test_market_type_is_spot(self):
        """Coinbase connector should always be SPOT."""
        connector = CoinbaseConnector(asset=AssetId.BTC)
        assert connector.market_type == MarketType.SPOT

    def test_eth_connector(self):
        """ETH should use correct symbol."""
        connector = CoinbaseConnector(asset=AssetId.ETH)
        msg = connector.build_subscription_message()
        assert "ETH-USD" in msg["product_ids"]

    def test_subscription_message_format(self):
        """Subscription message should follow Coinbase format."""
        connector = CoinbaseConnector(asset=AssetId.BTC)
        msg = connector.build_subscription_message()

        assert msg["type"] == "subscribe"
        assert "BTC-USD" in msg["product_ids"]
        assert "matches" in msg["channels"]

    def test_parse_match_valid(self):
        """Valid match message should produce Trade object."""
        connector = CoinbaseConnector(asset=AssetId.BTC)

        # Coinbase match format
        data = {
            "type": "match",
            "trade_id": 10,
            "sequence": 50,
            "maker_order_id": "ac928c66-1234",
            "taker_order_id": "132fb6ae-5678",
            "time": "2024-01-15T10:30:00.000000Z",
            "product_id": "BTC-USD",
            "size": "0.05",
            "price": "45000.50",
            "side": "sell",
        }

        trades = connector.parse_message(data)

        assert len(trades) == 1
        trade = trades[0]
        assert trade.price == 45000.50
        assert trade.quantity == 0.05
        assert trade.is_buyer_maker is True  # side=sell means taker sold, buyer was maker
        assert trade.venue == VenueId.COINBASE
        assert trade.asset == AssetId.BTC
        assert trade.market_type == MarketType.SPOT

    def test_parse_match_buy_side(self):
        """Buy side trade should have is_buyer_maker=False."""
        connector = CoinbaseConnector(asset=AssetId.BTC)

        data = {
            "type": "match",
            "trade_id": 11,
            "sequence": 51,
            "maker_order_id": "ac928c66-1234",
            "taker_order_id": "132fb6ae-5678",
            "time": "2024-01-15T10:30:00.000000Z",
            "product_id": "BTC-USD",
            "size": "0.1",
            "price": "45100.00",
            "side": "buy",  # taker bought, seller was maker
        }

        trades = connector.parse_message(data)

        assert len(trades) == 1
        assert trades[0].is_buyer_maker is False

    def test_parse_subscription_response_ignored(self):
        """Subscription confirmation should return empty list."""
        connector = CoinbaseConnector(asset=AssetId.BTC)

        data = {
            "type": "subscriptions",
            "channels": [{"name": "matches", "product_ids": ["BTC-USD"]}],
        }
        trades = connector.parse_message(data)

        assert trades == []

    def test_parse_heartbeat_ignored(self):
        """Heartbeat should return empty list."""
        connector = CoinbaseConnector(asset=AssetId.BTC)

        data = {"type": "heartbeat", "time": "2024-01-15T10:30:00Z"}
        trades = connector.parse_message(data)

        assert trades == []

    def test_parse_error_response(self):
        """Error response should return empty list."""
        connector = CoinbaseConnector(asset=AssetId.BTC)

        data = {"type": "error", "message": "Failed to subscribe"}
        trades = connector.parse_message(data)

        assert trades == []

    def test_parse_product_mismatch(self):
        """Wrong product_id should return empty list."""
        connector = CoinbaseConnector(asset=AssetId.BTC)

        data = {
            "type": "match",
            "trade_id": 10,
            "time": "2024-01-15T10:30:00.000000Z",
            "product_id": "ETH-USD",  # Wrong product!
            "size": "1.0",
            "price": "2500.00",
            "side": "sell",
        }

        trades = connector.parse_message(data)

        assert trades == []

    def test_parse_invalid_price_zero(self):
        """Zero price should return empty list."""
        connector = CoinbaseConnector(asset=AssetId.BTC)

        data = {
            "type": "match",
            "trade_id": 10,
            "time": "2024-01-15T10:30:00.000000Z",
            "product_id": "BTC-USD",
            "size": "0.05",
            "price": "0",  # Invalid
            "side": "sell",
        }

        trades = connector.parse_message(data)

        assert trades == []

    def test_parse_timestamp(self):
        """Timestamp should be parsed correctly from ISO 8601."""
        connector = CoinbaseConnector(asset=AssetId.BTC)

        data = {
            "type": "match",
            "trade_id": 10,
            "time": "2024-01-15T10:30:00.123456Z",
            "product_id": "BTC-USD",
            "size": "0.05",
            "price": "45000.00",
            "side": "sell",
        }

        trades = connector.parse_message(data)

        assert len(trades) == 1
        # 2024-01-15T10:30:00.123456Z in ms = 1705314600123
        expected_ts_ms = 1705314600123
        assert abs(trades[0].timestamp - expected_ts_ms) < 1000  # Within 1 second


class TestCoinbaseConvenienceClass:
    """Tests for CoinbaseSpotConnector."""

    def test_spot_connector_is_alias(self):
        """CoinbaseSpotConnector should be same as CoinbaseConnector."""
        connector = CoinbaseSpotConnector(asset=AssetId.BTC)
        assert connector.market_type == MarketType.SPOT
        assert connector.venue == VenueId.COINBASE


class TestKrakenConnector:
    """Tests for Kraken WebSocket connector."""

    def test_ws_url(self):
        """Kraken connector should use ws.kraken.com."""
        connector = KrakenConnector(asset=AssetId.BTC)
        url = connector.get_ws_url()
        assert "ws.kraken.com" in url

    def test_market_type_is_spot(self):
        """Kraken connector should always be SPOT."""
        connector = KrakenConnector(asset=AssetId.BTC)
        assert connector.market_type == MarketType.SPOT

    def test_btc_uses_xbt_symbol(self):
        """BTC should use XBT/USD symbol (Kraken's notation)."""
        connector = KrakenConnector(asset=AssetId.BTC)
        msg = connector.build_subscription_message()
        assert "XBT/USD" in msg["pair"]

    def test_eth_connector(self):
        """ETH should use correct symbol."""
        connector = KrakenConnector(asset=AssetId.ETH)
        msg = connector.build_subscription_message()
        assert "ETH/USD" in msg["pair"]

    def test_subscription_message_format(self):
        """Subscription message should follow Kraken format."""
        connector = KrakenConnector(asset=AssetId.BTC)
        msg = connector.build_subscription_message()

        assert msg["event"] == "subscribe"
        assert "XBT/USD" in msg["pair"]
        assert msg["subscription"]["name"] == "trade"

    def test_parse_trade_array_valid(self):
        """Valid trade array should produce Trade objects."""
        connector = KrakenConnector(asset=AssetId.BTC)

        # Kraken trade array format
        data = [
            0,  # channelID
            [
                ["45000.50", "0.05", "1705314600.123456", "s", "l", ""],
            ],
            "trade",
            "XBT/USD",
        ]

        trades = connector.parse_message(data)

        assert len(trades) == 1
        trade = trades[0]
        assert trade.price == 45000.50
        assert trade.quantity == 0.05
        assert trade.is_buyer_maker is True  # side=s means taker sold, buyer was maker
        assert trade.venue == VenueId.KRAKEN
        assert trade.asset == AssetId.BTC
        assert trade.market_type == MarketType.SPOT

    def test_parse_trade_array_multiple_trades(self):
        """Multiple trades in array should all be parsed."""
        connector = KrakenConnector(asset=AssetId.BTC)

        data = [
            0,
            [
                ["45000.50", "0.05", "1705314600.123456", "s", "l", ""],
                ["45001.00", "0.10", "1705314600.234567", "b", "m", ""],
            ],
            "trade",
            "XBT/USD",
        ]

        trades = connector.parse_message(data)

        assert len(trades) == 2
        assert trades[0].price == 45000.50
        assert trades[0].is_buyer_maker is True  # side=s
        assert trades[1].price == 45001.00
        assert trades[1].is_buyer_maker is False  # side=b

    def test_parse_buy_side_trade(self):
        """Buy side trade should have is_buyer_maker=False."""
        connector = KrakenConnector(asset=AssetId.BTC)

        data = [
            0,
            [
                ["45100.00", "0.1", "1705314600.123456", "b", "l", ""],
            ],
            "trade",
            "XBT/USD",
        ]

        trades = connector.parse_message(data)

        assert len(trades) == 1
        assert trades[0].is_buyer_maker is False

    def test_parse_subscription_status_subscribed(self):
        """Subscription confirmation should return empty list."""
        connector = KrakenConnector(asset=AssetId.BTC)

        data = {
            "channelID": 123,
            "channelName": "trade",
            "event": "subscriptionStatus",
            "pair": "XBT/USD",
            "status": "subscribed",
            "subscription": {"name": "trade"},
        }

        trades = connector.parse_message(data)
        assert trades == []

    def test_parse_subscription_status_error(self):
        """Subscription error should return empty list."""
        connector = KrakenConnector(asset=AssetId.BTC)

        data = {
            "event": "subscriptionStatus",
            "status": "error",
            "errorMessage": "Invalid pair",
        }

        trades = connector.parse_message(data)
        assert trades == []

    def test_parse_heartbeat_ignored(self):
        """Heartbeat should return empty list."""
        connector = KrakenConnector(asset=AssetId.BTC)

        data = {"event": "heartbeat"}
        trades = connector.parse_message(data)

        assert trades == []

    def test_parse_system_status_ignored(self):
        """System status should return empty list."""
        connector = KrakenConnector(asset=AssetId.BTC)

        data = {"event": "systemStatus", "status": "online", "version": "1.0.0"}
        trades = connector.parse_message(data)

        assert trades == []

    def test_parse_pair_mismatch(self):
        """Wrong pair should return empty list."""
        connector = KrakenConnector(asset=AssetId.BTC)

        data = [
            0,
            [
                ["2500.00", "1.0", "1705314600.123456", "s", "l", ""],
            ],
            "trade",
            "ETH/USD",  # Wrong pair for BTC connector
        ]

        trades = connector.parse_message(data)
        assert trades == []

    def test_parse_invalid_price_zero(self):
        """Zero price should return empty list."""
        connector = KrakenConnector(asset=AssetId.BTC)

        data = [
            0,
            [
                ["0", "0.05", "1705314600.123456", "s", "l", ""],
            ],
            "trade",
            "XBT/USD",
        ]

        trades = connector.parse_message(data)
        assert trades == []

    def test_parse_invalid_volume_negative(self):
        """Negative volume should return empty list."""
        connector = KrakenConnector(asset=AssetId.BTC)

        data = [
            0,
            [
                ["45000.00", "-0.05", "1705314600.123456", "s", "l", ""],
            ],
            "trade",
            "XBT/USD",
        ]

        trades = connector.parse_message(data)
        assert trades == []

    def test_parse_non_trade_channel_ignored(self):
        """Non-trade channel messages should be ignored."""
        connector = KrakenConnector(asset=AssetId.BTC)

        data = [
            0,
            {"a": ["45000.00", 100, "45001.00"]},  # Some other data format
            "ticker",  # Not trade channel
            "XBT/USD",
        ]

        trades = connector.parse_message(data)
        assert trades == []

    def test_parse_timestamp(self):
        """Timestamp should be parsed correctly from unix float."""
        connector = KrakenConnector(asset=AssetId.BTC)

        data = [
            0,
            [
                ["45000.00", "0.05", "1705314600.123456", "s", "l", ""],
            ],
            "trade",
            "XBT/USD",
        ]

        trades = connector.parse_message(data)

        assert len(trades) == 1
        # 1705314600.123456 * 1000 = 1705314600123 (rounded)
        expected_ts_ms = 1705314600123
        assert abs(trades[0].timestamp - expected_ts_ms) < 10  # Within 10ms


class TestKrakenConvenienceClass:
    """Tests for KrakenSpotConnector."""

    def test_spot_connector_is_alias(self):
        """KrakenSpotConnector should be same as KrakenConnector."""
        connector = KrakenSpotConnector(asset=AssetId.BTC)
        assert connector.market_type == MarketType.SPOT
        assert connector.venue == VenueId.KRAKEN


class TestOKXConnector:
    """Tests for OKX WebSocket connector."""

    def test_spot_ws_url(self):
        """OKX connector should use ws.okx.com endpoint."""
        connector = OKXSpotConnector(asset=AssetId.BTC)
        url = connector.get_ws_url()
        assert "ws.okx.com" in url

    def test_perp_ws_url(self):
        """OKX perp connector should use same ws.okx.com endpoint."""
        connector = OKXPerpConnector(asset=AssetId.BTC)
        url = connector.get_ws_url()
        assert "ws.okx.com" in url

    def test_spot_market_type(self):
        """Spot connector should have SPOT market type."""
        connector = OKXSpotConnector(asset=AssetId.BTC)
        assert connector.market_type == MarketType.SPOT

    def test_perp_market_type(self):
        """Perp connector should have PERP market type."""
        connector = OKXPerpConnector(asset=AssetId.BTC)
        assert connector.market_type == MarketType.PERP

    def test_btc_spot_symbol(self):
        """BTC spot should use BTC-USDT symbol."""
        connector = OKXSpotConnector(asset=AssetId.BTC)
        msg = connector.build_subscription_message()
        assert msg["args"][0]["instId"] == "BTC-USDT"

    def test_btc_perp_symbol(self):
        """BTC perp should use BTC-USDT-SWAP symbol."""
        connector = OKXPerpConnector(asset=AssetId.BTC)
        msg = connector.build_subscription_message()
        assert msg["args"][0]["instId"] == "BTC-USDT-SWAP"

    def test_eth_spot_symbol(self):
        """ETH spot should use ETH-USDT symbol."""
        connector = OKXSpotConnector(asset=AssetId.ETH)
        msg = connector.build_subscription_message()
        assert msg["args"][0]["instId"] == "ETH-USDT"

    def test_eth_perp_symbol(self):
        """ETH perp should use ETH-USDT-SWAP symbol."""
        connector = OKXPerpConnector(asset=AssetId.ETH)
        msg = connector.build_subscription_message()
        assert msg["args"][0]["instId"] == "ETH-USDT-SWAP"

    def test_subscription_message_format(self):
        """Subscription message should follow OKX format."""
        connector = OKXSpotConnector(asset=AssetId.BTC)
        msg = connector.build_subscription_message()

        assert msg["op"] == "subscribe"
        assert len(msg["args"]) == 1
        assert msg["args"][0]["channel"] == "trades"
        assert msg["args"][0]["instId"] == "BTC-USDT"

    def test_parse_trade_message_valid(self):
        """Valid trade message should produce Trade objects."""
        connector = OKXSpotConnector(asset=AssetId.BTC)

        # OKX trade message format
        data = {
            "arg": {
                "channel": "trades",
                "instId": "BTC-USDT",
            },
            "data": [
                {
                    "instId": "BTC-USDT",
                    "tradeId": "123456789",
                    "px": "97500.50",
                    "sz": "0.05",
                    "side": "sell",
                    "ts": "1705314600123",
                }
            ],
        }

        trades = connector.parse_message(data)

        assert len(trades) == 1
        trade = trades[0]
        assert trade.price == 97500.50
        assert trade.quantity == 0.05
        assert trade.is_buyer_maker is True  # side=sell means taker sold, buyer was maker
        assert trade.venue == VenueId.OKX
        assert trade.asset == AssetId.BTC
        assert trade.market_type == MarketType.SPOT
        assert trade.timestamp == 1705314600123

    def test_parse_trade_buy_side(self):
        """Buy side trade should have is_buyer_maker=False."""
        connector = OKXSpotConnector(asset=AssetId.BTC)

        data = {
            "arg": {"channel": "trades", "instId": "BTC-USDT"},
            "data": [
                {
                    "instId": "BTC-USDT",
                    "tradeId": "123456790",
                    "px": "97600.00",
                    "sz": "0.10",
                    "side": "buy",
                    "ts": "1705314601234",
                }
            ],
        }

        trades = connector.parse_message(data)

        assert len(trades) == 1
        assert trades[0].is_buyer_maker is False  # side=buy means taker bought

    def test_parse_multiple_trades(self):
        """Multiple trades in one message should all be parsed."""
        connector = OKXSpotConnector(asset=AssetId.BTC)

        data = {
            "arg": {"channel": "trades", "instId": "BTC-USDT"},
            "data": [
                {"instId": "BTC-USDT", "tradeId": "1", "px": "97500.00", "sz": "0.1", "side": "buy", "ts": "1705314600000"},
                {"instId": "BTC-USDT", "tradeId": "2", "px": "97510.00", "sz": "0.2", "side": "sell", "ts": "1705314600100"},
                {"instId": "BTC-USDT", "tradeId": "3", "px": "97520.00", "sz": "0.3", "side": "buy", "ts": "1705314600200"},
            ],
        }

        trades = connector.parse_message(data)

        assert len(trades) == 3
        assert trades[0].price == 97500.00
        assert trades[1].price == 97510.00
        assert trades[2].price == 97520.00

    def test_parse_perp_trade(self):
        """Perp connector should parse trades correctly."""
        connector = OKXPerpConnector(asset=AssetId.BTC)

        data = {
            "arg": {"channel": "trades", "instId": "BTC-USDT-SWAP"},
            "data": [
                {
                    "instId": "BTC-USDT-SWAP",
                    "tradeId": "999",
                    "px": "97800.00",
                    "sz": "1.0",
                    "side": "sell",
                    "ts": "1705314700000",
                }
            ],
        }

        trades = connector.parse_message(data)

        assert len(trades) == 1
        assert trades[0].market_type == MarketType.PERP
        assert trades[0].price == 97800.00

    def test_parse_subscribe_event(self):
        """Subscribe event should return empty list."""
        connector = OKXSpotConnector(asset=AssetId.BTC)

        data = {
            "event": "subscribe",
            "arg": {"channel": "trades", "instId": "BTC-USDT"},
        }

        trades = connector.parse_message(data)
        assert trades == []

    def test_parse_error_event(self):
        """Error event should return empty list."""
        connector = OKXSpotConnector(asset=AssetId.BTC)

        data = {
            "event": "error",
            "code": "60001",
            "msg": "Invalid request",
        }

        trades = connector.parse_message(data)
        assert trades == []

    def test_parse_wrong_channel_ignored(self):
        """Non-trade channel messages should be ignored."""
        connector = OKXSpotConnector(asset=AssetId.BTC)

        data = {
            "arg": {"channel": "tickers", "instId": "BTC-USDT"},
            "data": [{"instId": "BTC-USDT", "last": "97500.00"}],
        }

        trades = connector.parse_message(data)
        assert trades == []

    def test_parse_instid_mismatch(self):
        """Wrong instId should return empty list."""
        connector = OKXSpotConnector(asset=AssetId.BTC)

        data = {
            "arg": {"channel": "trades", "instId": "ETH-USDT"},  # Wrong instId
            "data": [
                {"instId": "ETH-USDT", "tradeId": "1", "px": "3500.00", "sz": "1.0", "side": "buy", "ts": "1705314600000"}
            ],
        }

        trades = connector.parse_message(data)
        assert trades == []

    def test_parse_invalid_price_zero(self):
        """Zero price should be skipped."""
        connector = OKXSpotConnector(asset=AssetId.BTC)

        data = {
            "arg": {"channel": "trades", "instId": "BTC-USDT"},
            "data": [
                {"instId": "BTC-USDT", "tradeId": "1", "px": "0", "sz": "0.1", "side": "buy", "ts": "1705314600000"}
            ],
        }

        trades = connector.parse_message(data)
        assert trades == []

    def test_parse_invalid_quantity_negative(self):
        """Negative quantity should be skipped."""
        connector = OKXSpotConnector(asset=AssetId.BTC)

        data = {
            "arg": {"channel": "trades", "instId": "BTC-USDT"},
            "data": [
                {"instId": "BTC-USDT", "tradeId": "1", "px": "97500.00", "sz": "-0.1", "side": "buy", "ts": "1705314600000"}
            ],
        }

        trades = connector.parse_message(data)
        assert trades == []


class TestOKXConvenienceClasses:
    """Tests for OKX convenience connector classes."""

    def test_spot_connector_class(self):
        """OKXSpotConnector should set correct market type."""
        connector = OKXSpotConnector(asset=AssetId.BTC)
        assert connector.market_type == MarketType.SPOT
        assert connector.venue == VenueId.OKX

    def test_perp_connector_class(self):
        """OKXPerpConnector should set correct market type."""
        connector = OKXPerpConnector(asset=AssetId.BTC)
        assert connector.market_type == MarketType.PERP
        assert connector.venue == VenueId.OKX


# =============================================================================
# Bybit Connector Tests
# =============================================================================


class TestBybitConnector:
    """Tests for Bybit WebSocket connector (perp only)."""

    def test_perp_ws_url(self):
        """Perp connector should use stream.bybit.com/v5/public/linear."""
        connector = BybitConnector(
            asset=AssetId.BTC,
            market_type=MarketType.PERP,
        )
        assert "stream.bybit.com" in connector.get_ws_url()
        assert "linear" in connector.get_ws_url()

    def test_perp_market_type(self):
        """Bybit connector should be PERP market type."""
        connector = BybitPerpConnector(asset=AssetId.BTC)
        assert connector.market_type == MarketType.PERP
        assert connector.venue == VenueId.BYBIT

    def test_spot_raises_error(self):
        """Bybit connector should reject SPOT market type."""
        with pytest.raises(ValueError) as exc_info:
            BybitConnector(asset=AssetId.BTC, market_type=MarketType.SPOT)
        assert "only supports PERP" in str(exc_info.value)

    def test_btc_perp_symbol(self):
        """BTC perp should use BTCUSDT symbol."""
        connector = BybitPerpConnector(asset=AssetId.BTC)
        assert connector._symbol == "BTCUSDT"

    def test_eth_perp_symbol(self):
        """ETH perp should use ETHUSDT symbol."""
        connector = BybitPerpConnector(asset=AssetId.ETH)
        assert connector._symbol == "ETHUSDT"

    def test_subscription_message_format(self):
        """Subscription should use publicTrade topic format."""
        connector = BybitPerpConnector(asset=AssetId.BTC)
        msg = connector.build_subscription_message()

        assert msg["op"] == "subscribe"
        assert "publicTrade.BTCUSDT" in msg["args"]

    def test_parse_trade_message_valid(self):
        """Valid trade message should parse correctly."""
        connector = BybitPerpConnector(asset=AssetId.BTC)

        data = {
            "topic": "publicTrade.BTCUSDT",
            "type": "snapshot",
            "ts": 1705314600000,
            "data": [
                {
                    "i": "trade-123",
                    "T": 1705314600123,
                    "p": "97500.00",
                    "v": "0.10",
                    "S": "Sell",  # taker sold -> is_buyer_maker=True
                    "s": "BTCUSDT",
                    "BT": False,
                }
            ],
        }

        trades = connector.parse_message(data)

        assert len(trades) == 1
        trade = trades[0]
        assert trade.price == 97500.0
        assert trade.quantity == 0.10
        assert trade.is_buyer_maker is True  # Sell = taker sold
        assert trade.venue == VenueId.BYBIT
        assert trade.asset == AssetId.BTC
        assert trade.market_type == MarketType.PERP

    def test_parse_trade_buy_side(self):
        """Buy side should set is_buyer_maker=False."""
        connector = BybitPerpConnector(asset=AssetId.BTC)

        data = {
            "topic": "publicTrade.BTCUSDT",
            "type": "snapshot",
            "ts": 1705314600000,
            "data": [
                {
                    "i": "trade-123",
                    "T": 1705314600123,
                    "p": "97500.00",
                    "v": "0.10",
                    "S": "Buy",  # taker bought -> is_buyer_maker=False
                    "s": "BTCUSDT",
                    "BT": False,
                }
            ],
        }

        trades = connector.parse_message(data)

        assert len(trades) == 1
        assert trades[0].is_buyer_maker is False

    def test_parse_multiple_trades(self):
        """Multiple trades in one message should all parse."""
        connector = BybitPerpConnector(asset=AssetId.BTC)

        data = {
            "topic": "publicTrade.BTCUSDT",
            "type": "snapshot",
            "ts": 1705314600000,
            "data": [
                {"i": "1", "T": 1705314600001, "p": "97500.00", "v": "0.10", "S": "Buy", "s": "BTCUSDT", "BT": False},
                {"i": "2", "T": 1705314600002, "p": "97510.00", "v": "0.20", "S": "Sell", "s": "BTCUSDT", "BT": False},
                {"i": "3", "T": 1705314600003, "p": "97520.00", "v": "0.05", "S": "Buy", "s": "BTCUSDT", "BT": False},
            ],
        }

        trades = connector.parse_message(data)

        assert len(trades) == 3
        assert trades[0].price == 97500.0
        assert trades[1].price == 97510.0
        assert trades[2].price == 97520.0

    def test_parse_subscribe_response(self):
        """Subscribe response should return empty list."""
        connector = BybitPerpConnector(asset=AssetId.BTC)

        data = {
            "success": True,
            "ret_msg": "",
            "op": "subscribe",
            "conn_id": "abc123",
        }

        trades = connector.parse_message(data)
        assert trades == []

    def test_parse_subscribe_failure(self):
        """Subscribe failure should log error and return empty."""
        connector = BybitPerpConnector(asset=AssetId.BTC)

        data = {
            "success": False,
            "ret_msg": "Invalid topic",
            "op": "subscribe",
        }

        trades = connector.parse_message(data)
        assert trades == []

    def test_parse_ping_pong(self):
        """Ping/pong should be ignored."""
        connector = BybitPerpConnector(asset=AssetId.BTC)

        data = {
            "success": True,
            "ret_msg": "pong",
            "op": "ping",
        }

        trades = connector.parse_message(data)
        assert trades == []

    def test_parse_topic_mismatch(self):
        """Wrong topic should return empty list."""
        connector = BybitPerpConnector(asset=AssetId.BTC)

        data = {
            "topic": "publicTrade.ETHUSDT",  # Wrong symbol
            "type": "snapshot",
            "ts": 1705314600000,
            "data": [
                {"i": "1", "T": 1705314600123, "p": "3500.00", "v": "1.0", "S": "Buy", "s": "ETHUSDT", "BT": False}
            ],
        }

        trades = connector.parse_message(data)
        assert trades == []

    def test_parse_invalid_price_zero(self):
        """Zero price should be skipped."""
        connector = BybitPerpConnector(asset=AssetId.BTC)

        data = {
            "topic": "publicTrade.BTCUSDT",
            "type": "snapshot",
            "ts": 1705314600000,
            "data": [
                {"i": "1", "T": 1705314600123, "p": "0", "v": "0.1", "S": "Buy", "s": "BTCUSDT", "BT": False}
            ],
        }

        trades = connector.parse_message(data)
        assert trades == []

    def test_parse_invalid_quantity_negative(self):
        """Negative quantity should be skipped."""
        connector = BybitPerpConnector(asset=AssetId.BTC)

        data = {
            "topic": "publicTrade.BTCUSDT",
            "type": "snapshot",
            "ts": 1705314600000,
            "data": [
                {"i": "1", "T": 1705314600123, "p": "97500.00", "v": "-0.1", "S": "Buy", "s": "BTCUSDT", "BT": False}
            ],
        }

        trades = connector.parse_message(data)
        assert trades == []

    def test_parse_eth_perp_trade(self):
        """ETH perp trades should parse correctly."""
        connector = BybitPerpConnector(asset=AssetId.ETH)

        data = {
            "topic": "publicTrade.ETHUSDT",
            "type": "snapshot",
            "ts": 1705314600000,
            "data": [
                {"i": "1", "T": 1705314600123, "p": "3500.00", "v": "1.0", "S": "Sell", "s": "ETHUSDT", "BT": False}
            ],
        }

        trades = connector.parse_message(data)

        assert len(trades) == 1
        assert trades[0].price == 3500.0
        assert trades[0].asset == AssetId.ETH
        assert trades[0].market_type == MarketType.PERP


class TestBybitConvenienceClasses:
    """Tests for Bybit convenience connector classes."""

    def test_perp_connector_class(self):
        """BybitPerpConnector should set correct market type."""
        connector = BybitPerpConnector(asset=AssetId.BTC)
        assert connector.market_type == MarketType.PERP
        assert connector.venue == VenueId.BYBIT
