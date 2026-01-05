"""
Unit tests for BackfillService.

Tests backfill fetchers for each venue:
- Binance REST API fetcher
- Kraken REST API fetcher
- Error handling patterns (venue-specific vs code errors)
- Pagination logic
- Time range filtering
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import httpx

from services.abacus_indexer.backfill.service import (
    BackfillService,
    BackfillResult,
    BINANCE_SPOT_TRADES,
    BINANCE_PERP_TRADES,
    KRAKEN_TRADES,
    KRAKEN_PAIR_MAP,
    OKX_TRADES,
    OKX_INST_MAP,
    BYBIT_TRADES,
    BYBIT_SYMBOL_MAP,
)
from services.abacus_indexer.core.types import (
    AssetId,
    MarketType,
    TakerSide,
    Trade,
    VenueId,
)


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def mock_composite_repo():
    """Mock composite bar repository."""
    repo = MagicMock()
    repo.get_gaps = AsyncMock(return_value=[])
    repo.insert = AsyncMock()
    return repo


@pytest.fixture
def mock_venue_repo():
    """Mock venue bar repository."""
    repo = MagicMock()
    repo.insert_batch = AsyncMock()
    return repo


@pytest.fixture
def backfill_service(mock_composite_repo, mock_venue_repo):
    """Create backfill service with mock repos."""
    return BackfillService(mock_composite_repo, mock_venue_repo)


# =============================================================================
# Kraken Backfill Fetcher Tests
# =============================================================================


class TestKrakenBackfillFetcher:
    """Tests for _fetch_kraken_trades()."""

    @pytest.fixture
    def sample_kraken_response(self):
        """Sample Kraken REST API response."""
        return {
            "error": [],
            "result": {
                "XXBTZUSD": [
                    # [price, volume, time, buy/sell, market/limit, misc, trade_id]
                    # "b" = buyer was taker (is_buyer_maker=False)
                    # "s" = seller was taker (is_buyer_maker=True)
                    ["97500.00000", "0.10000000", 1735689660.123456, "b", "m", "", 12345],
                    ["97510.00000", "0.05000000", 1735689661.234567, "s", "l", "", 12346],
                    ["97505.00000", "0.20000000", 1735689662.345678, "b", "m", "", 12347],
                ],
                "last": "1735689662345678000",  # Nanosecond timestamp for pagination
            },
        }

    @pytest.fixture
    def mock_http_client(self, sample_kraken_response):
        """Mock httpx client with Kraken response."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.json.return_value = sample_kraken_response
        mock_response.raise_for_status = MagicMock()
        client.get = AsyncMock(return_value=mock_response)
        return client

    @pytest.mark.asyncio
    async def test_fetch_kraken_trades_success(self, backfill_service, mock_http_client):
        """Test successful Kraken trade fetch."""
        start_ms = 1735689660000  # Start of minute
        end_ms = 1735689719999    # End of minute

        with patch.object(backfill_service, "_get_client", return_value=mock_http_client):
            with patch("asyncio.sleep", new_callable=AsyncMock):
                trades = await backfill_service._fetch_kraken_trades(
                    mock_http_client, "BTC", "spot", start_ms, end_ms
                )

        assert len(trades) == 3
        assert all(isinstance(t, Trade) for t in trades)
        assert all(t.venue == VenueId.KRAKEN for t in trades)
        assert all(t.asset == AssetId.BTC for t in trades)
        assert all(t.market_type == MarketType.SPOT for t in trades)

    @pytest.mark.asyncio
    async def test_fetch_kraken_trades_buy_sell_sides(self, backfill_service, mock_http_client):
        """Test correct taker side parsing from Kraken."""
        start_ms = 1735689660000
        end_ms = 1735689719999

        with patch.object(backfill_service, "_get_client", return_value=mock_http_client):
            with patch("asyncio.sleep", new_callable=AsyncMock):
                trades = await backfill_service._fetch_kraken_trades(
                    mock_http_client, "BTC", "spot", start_ms, end_ms
                )

        # First trade: "b" = buyer was taker (is_buyer_maker=False) = BUY
        assert trades[0].is_buyer_maker is False
        assert trades[0].taker_side == TakerSide.BUY
        assert trades[0].price == 97500.0

        # Second trade: "s" = seller was taker (is_buyer_maker=True) = SELL
        assert trades[1].is_buyer_maker is True
        assert trades[1].taker_side == TakerSide.SELL
        assert trades[1].price == 97510.0

        # Third trade: "b" = buyer was taker = BUY
        assert trades[2].is_buyer_maker is False
        assert trades[2].taker_side == TakerSide.BUY
        assert trades[2].price == 97505.0

    @pytest.mark.asyncio
    async def test_fetch_kraken_uses_xbt_for_btc(self, backfill_service, mock_http_client):
        """Test BTC is mapped to Kraken's XBT symbol."""
        start_ms = 1735689660000
        end_ms = 1735689719999

        with patch.object(backfill_service, "_get_client", return_value=mock_http_client):
            with patch("asyncio.sleep", new_callable=AsyncMock):
                await backfill_service._fetch_kraken_trades(
                    mock_http_client, "BTC", "spot", start_ms, end_ms
                )

        # Verify the call used XXBTZUSD
        call_args = mock_http_client.get.call_args
        assert call_args[1]["params"]["pair"] == "XXBTZUSD"

    @pytest.mark.asyncio
    async def test_fetch_kraken_eth_mapping(self, backfill_service):
        """Test ETH is mapped to Kraken's XETHZUSD."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "error": [],
            "result": {
                "XETHZUSD": [
                    ["3500.00", "1.0", 1735689660.0, "b", "m", ""],
                ],
                "last": "1735689660000000000",
            },
        }
        mock_response.raise_for_status = MagicMock()
        client.get = AsyncMock(return_value=mock_response)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_kraken_trades(
                client, "ETH", "spot", 1735689660000, 1735689719999
            )

        assert len(trades) == 1
        assert trades[0].asset == AssetId.ETH

        call_args = client.get.call_args
        assert call_args[1]["params"]["pair"] == "XETHZUSD"

    @pytest.mark.asyncio
    async def test_fetch_kraken_unknown_asset_returns_empty(self, backfill_service):
        """Test unknown asset returns empty list (not error)."""
        client = AsyncMock(spec=httpx.AsyncClient)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_kraken_trades(
                client, "UNKNOWN", "spot", 1735689660000, 1735689719999
            )

        assert trades == []
        client.get.assert_not_called()  # Should not make API call for unknown asset

    @pytest.mark.asyncio
    async def test_fetch_kraken_perps_returns_empty(self, backfill_service):
        """Test perp market type returns empty (Kraken perps not supported)."""
        client = AsyncMock(spec=httpx.AsyncClient)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_kraken_trades(
                client, "BTC", "perp", 1735689660000, 1735689719999
            )

        assert trades == []
        client.get.assert_not_called()

    @pytest.mark.asyncio
    async def test_fetch_kraken_filters_by_time_range(self, backfill_service):
        """Test trades outside time range are filtered out."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "error": [],
            "result": {
                "XXBTZUSD": [
                    # Before range
                    ["97400.0", "0.1", 1735689659.0, "b", "m", ""],
                    # In range
                    ["97500.0", "0.1", 1735689660.0, "b", "m", ""],
                    ["97510.0", "0.1", 1735689665.0, "b", "m", ""],
                    # After range
                    ["97600.0", "0.1", 1735689720.0, "b", "m", ""],
                ],
                "last": "1735689720000000000",
            },
        }
        mock_response.raise_for_status = MagicMock()
        client.get = AsyncMock(return_value=mock_response)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_kraken_trades(
                client, "BTC", "spot", 1735689660000, 1735689719999
            )

        # Only trades at 1735689660 and 1735689665 should be included
        assert len(trades) == 2
        assert trades[0].price == 97500.0
        assert trades[1].price == 97510.0

    @pytest.mark.asyncio
    async def test_fetch_kraken_api_error_raises_exception(self, backfill_service):
        """Test Kraken API error is handled and logged."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "error": ["EGeneral:Invalid arguments"],
            "result": {},
        }
        mock_response.raise_for_status = MagicMock()
        client.get = AsyncMock(return_value=mock_response)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            with pytest.raises(RuntimeError) as exc_info:
                await backfill_service._fetch_kraken_trades(
                    client, "BTC", "spot", 1735689660000, 1735689719999
                )

        assert "Kraken API error" in str(exc_info.value)
        assert "EGeneral:Invalid arguments" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_fetch_kraken_http_error_raises_exception(self, backfill_service):
        """Test HTTP error is handled with venue-prefixed logging."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.text = "Rate limit exceeded"
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Rate limit exceeded",
            request=MagicMock(),
            response=mock_response,
        )
        client.get = AsyncMock(return_value=mock_response)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            with pytest.raises(httpx.HTTPStatusError):
                await backfill_service._fetch_kraken_trades(
                    client, "BTC", "spot", 1735689660000, 1735689719999
                )

    @pytest.mark.asyncio
    async def test_fetch_kraken_invalid_trade_format_skipped(self, backfill_service):
        """Test malformed trades are skipped with warning."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "error": [],
            "result": {
                "XXBTZUSD": [
                    # Valid trade
                    ["97500.0", "0.1", 1735689660.0, "b", "m", ""],
                    # Invalid: missing fields
                    ["97510.0"],
                    # Invalid: non-numeric price
                    ["invalid", "0.1", 1735689661.0, "b", "m", ""],
                    # Valid trade
                    ["97520.0", "0.2", 1735689662.0, "s", "m", ""],
                ],
                "last": "1735689662000000000",
            },
        }
        mock_response.raise_for_status = MagicMock()
        client.get = AsyncMock(return_value=mock_response)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_kraken_trades(
                client, "BTC", "spot", 1735689660000, 1735689719999
            )

        # Only valid trades should be included
        assert len(trades) == 2
        assert trades[0].price == 97500.0
        assert trades[1].price == 97520.0

    @pytest.mark.asyncio
    async def test_fetch_kraken_pagination_uses_nanoseconds(self, backfill_service):
        """Test pagination uses nanosecond 'since' parameter."""
        client = AsyncMock(spec=httpx.AsyncClient)

        # First response - 1000 trades (triggers pagination)
        first_response = {
            "error": [],
            "result": {
                "XXBTZUSD": [
                    ["97500.0", "0.1", 1735689660.0 + i/1000, "b", "m", ""]
                    for i in range(1000)
                ],
                "last": "1735689660999000000",  # Pagination cursor
            },
        }

        # Second response - fewer trades (end of data)
        second_response = {
            "error": [],
            "result": {
                "XXBTZUSD": [
                    ["97600.0", "0.1", 1735689661.0, "b", "m", ""],
                ],
                "last": "1735689661000000000",
            },
        }

        mock_responses = [MagicMock(), MagicMock()]
        mock_responses[0].json.return_value = first_response
        mock_responses[0].raise_for_status = MagicMock()
        mock_responses[1].json.return_value = second_response
        mock_responses[1].raise_for_status = MagicMock()

        client.get = AsyncMock(side_effect=mock_responses)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_kraken_trades(
                client, "BTC", "spot", 1735689660000, 1735689719999
            )

        # Should have made 2 API calls
        assert client.get.call_count == 2

        # Second call should use the 'last' timestamp from first response
        second_call = client.get.call_args_list[1]
        assert second_call[1]["params"]["since"] == 1735689660999000000

    @pytest.mark.asyncio
    async def test_fetch_kraken_empty_result_returns_empty(self, backfill_service):
        """Test empty API result returns empty list."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "error": [],
            "result": {},
        }
        mock_response.raise_for_status = MagicMock()
        client.get = AsyncMock(return_value=mock_response)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_kraken_trades(
                client, "BTC", "spot", 1735689660000, 1735689719999
            )

        assert trades == []


# =============================================================================
# Binance Backfill Fetcher Tests
# =============================================================================


class TestBinanceBackfillFetcher:
    """Tests for _fetch_binance_trades()."""

    @pytest.fixture
    def sample_binance_response(self):
        """Sample Binance aggTrades response."""
        return [
            {
                "a": 12345,  # aggTradeId
                "p": "97500.00",  # price
                "q": "0.100",  # quantity
                "f": 100001,  # firstTradeId
                "l": 100001,  # lastTradeId
                "T": 1735689660123,  # timestamp
                "m": False,  # isBuyerMaker (False = buyer was taker = BUY)
            },
            {
                "a": 12346,
                "p": "97510.00",
                "q": "0.050",
                "f": 100002,
                "l": 100002,
                "T": 1735689661234,
                "m": True,  # seller was taker = SELL
            },
        ]

    @pytest.fixture
    def mock_binance_client(self, sample_binance_response):
        """Mock httpx client with Binance response."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.json.return_value = sample_binance_response
        mock_response.raise_for_status = MagicMock()
        client.get = AsyncMock(return_value=mock_response)
        return client

    @pytest.mark.asyncio
    async def test_fetch_binance_trades_success(self, backfill_service, mock_binance_client):
        """Test successful Binance trade fetch."""
        start_ms = 1735689660000
        end_ms = 1735689719999

        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_binance_trades(
                mock_binance_client, "BTC", "spot", start_ms, end_ms
            )

        assert len(trades) == 2
        assert all(t.venue == VenueId.BINANCE for t in trades)
        assert all(t.asset == AssetId.BTC for t in trades)

    @pytest.mark.asyncio
    async def test_fetch_binance_buy_sell_sides(self, backfill_service, mock_binance_client):
        """Test correct taker side from isBuyerMaker field."""
        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_binance_trades(
                mock_binance_client, "BTC", "spot", 1735689660000, 1735689719999
            )

        # First: m=False -> buyer was taker (is_buyer_maker=False) -> BUY
        assert trades[0].is_buyer_maker is False
        assert trades[0].taker_side == TakerSide.BUY
        # Second: m=True -> seller was taker (is_buyer_maker=True) -> SELL
        assert trades[1].is_buyer_maker is True
        assert trades[1].taker_side == TakerSide.SELL

    @pytest.mark.asyncio
    async def test_fetch_binance_spot_uses_correct_endpoint(self, backfill_service, mock_binance_client):
        """Test spot market uses spot endpoint."""
        with patch("asyncio.sleep", new_callable=AsyncMock):
            await backfill_service._fetch_binance_trades(
                mock_binance_client, "BTC", "spot", 1735689660000, 1735689719999
            )

        call_args = mock_binance_client.get.call_args
        assert call_args[0][0] == BINANCE_SPOT_TRADES

    @pytest.mark.asyncio
    async def test_fetch_binance_perp_uses_correct_endpoint(self, backfill_service, mock_binance_client):
        """Test perp market uses futures endpoint."""
        with patch("asyncio.sleep", new_callable=AsyncMock):
            await backfill_service._fetch_binance_trades(
                mock_binance_client, "BTC", "perp", 1735689660000, 1735689719999
            )

        call_args = mock_binance_client.get.call_args
        assert call_args[0][0] == BINANCE_PERP_TRADES

    @pytest.mark.asyncio
    async def test_fetch_binance_pagination_with_fromid(self, backfill_service):
        """Test pagination uses fromId parameter."""
        client = AsyncMock(spec=httpx.AsyncClient)

        # First response - 1000 trades triggers pagination
        first_batch = [
            {"a": i, "p": "97500.00", "q": "0.1", "f": i, "l": i, "T": 1735689660000 + i, "m": False}
            for i in range(1000)
        ]

        # Second response - fewer trades
        second_batch = [
            {"a": 1000, "p": "97600.00", "q": "0.1", "f": 1000, "l": 1000, "T": 1735689661000, "m": False}
        ]

        mock_responses = [MagicMock(), MagicMock()]
        mock_responses[0].json.return_value = first_batch
        mock_responses[0].raise_for_status = MagicMock()
        mock_responses[1].json.return_value = second_batch
        mock_responses[1].raise_for_status = MagicMock()

        client.get = AsyncMock(side_effect=mock_responses)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_binance_trades(
                client, "BTC", "spot", 1735689660000, 1735689719999
            )

        # Should have made 2 API calls
        assert client.get.call_count == 2

        # Second call should use fromId = last aggTradeId + 1
        second_call = client.get.call_args_list[1]
        assert second_call[1]["params"]["fromId"] == 1000  # 999 + 1

        # Total trades should be 1001
        assert len(trades) == 1001

    @pytest.mark.asyncio
    async def test_fetch_binance_http_error_logged_with_venue_prefix(self, backfill_service):
        """Test HTTP errors are logged with [binance/backfill] prefix."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.status_code = 418
        mock_response.text = "I'm a teapot"
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "I'm a teapot",
            request=MagicMock(),
            response=mock_response,
        )
        client.get = AsyncMock(return_value=mock_response)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            with pytest.raises(httpx.HTTPStatusError):
                await backfill_service._fetch_binance_trades(
                    client, "BTC", "spot", 1735689660000, 1735689719999
                )


# =============================================================================
# OKX Backfill Fetcher Tests
# =============================================================================


class TestOKXBackfillFetcher:
    """Tests for _fetch_okx_trades()."""

    @pytest.fixture
    def sample_okx_response(self):
        """Sample OKX REST API response."""
        return {
            "code": "0",
            "msg": "",
            "data": [
                {
                    "instId": "BTC-USDT",
                    "tradeId": "123456789",
                    "px": "97500.00",
                    "sz": "0.10000000",
                    "side": "buy",  # taker bought -> is_buyer_maker=False
                    "ts": "1735689660123",
                },
                {
                    "instId": "BTC-USDT",
                    "tradeId": "123456790",
                    "px": "97510.00",
                    "sz": "0.05000000",
                    "side": "sell",  # taker sold -> is_buyer_maker=True
                    "ts": "1735689661234",
                },
                {
                    "instId": "BTC-USDT",
                    "tradeId": "123456791",
                    "px": "97505.00",
                    "sz": "0.20000000",
                    "side": "buy",
                    "ts": "1735689662345",
                },
            ],
        }

    @pytest.fixture
    def mock_okx_client(self, sample_okx_response):
        """Mock httpx client with OKX response."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.json.return_value = sample_okx_response
        mock_response.raise_for_status = MagicMock()
        client.get = AsyncMock(return_value=mock_response)
        return client

    @pytest.mark.asyncio
    async def test_fetch_okx_trades_success(self, backfill_service, mock_okx_client):
        """Test successful OKX trade fetch."""
        start_ms = 1735689660000
        end_ms = 1735689719999

        with patch.object(backfill_service, "_get_client", return_value=mock_okx_client):
            with patch("asyncio.sleep", new_callable=AsyncMock):
                trades = await backfill_service._fetch_okx_trades(
                    mock_okx_client, "BTC", "spot", start_ms, end_ms
                )

        assert len(trades) == 3
        assert all(isinstance(t, Trade) for t in trades)
        assert all(t.venue == VenueId.OKX for t in trades)
        assert all(t.asset == AssetId.BTC for t in trades)
        assert all(t.market_type == MarketType.SPOT for t in trades)

    @pytest.mark.asyncio
    async def test_fetch_okx_trades_buy_sell_sides(self, backfill_service, mock_okx_client):
        """Test correct taker side parsing from OKX."""
        start_ms = 1735689660000
        end_ms = 1735689719999

        with patch.object(backfill_service, "_get_client", return_value=mock_okx_client):
            with patch("asyncio.sleep", new_callable=AsyncMock):
                trades = await backfill_service._fetch_okx_trades(
                    mock_okx_client, "BTC", "spot", start_ms, end_ms
                )

        # First trade: side="buy" -> taker bought -> is_buyer_maker=False = BUY
        assert trades[0].is_buyer_maker is False
        assert trades[0].taker_side == TakerSide.BUY
        assert trades[0].price == 97500.0

        # Second trade: side="sell" -> taker sold -> is_buyer_maker=True = SELL
        assert trades[1].is_buyer_maker is True
        assert trades[1].taker_side == TakerSide.SELL
        assert trades[1].price == 97510.0

        # Third trade: side="buy" -> taker bought = BUY
        assert trades[2].is_buyer_maker is False
        assert trades[2].taker_side == TakerSide.BUY
        assert trades[2].price == 97505.0

    @pytest.mark.asyncio
    async def test_fetch_okx_uses_correct_inst_id_spot(self, backfill_service, mock_okx_client):
        """Test BTC spot uses BTC-USDT instId."""
        start_ms = 1735689660000
        end_ms = 1735689719999

        with patch.object(backfill_service, "_get_client", return_value=mock_okx_client):
            with patch("asyncio.sleep", new_callable=AsyncMock):
                await backfill_service._fetch_okx_trades(
                    mock_okx_client, "BTC", "spot", start_ms, end_ms
                )

        call_args = mock_okx_client.get.call_args
        assert call_args[1]["params"]["instId"] == "BTC-USDT"

    @pytest.mark.asyncio
    async def test_fetch_okx_uses_correct_inst_id_perp(self, backfill_service):
        """Test BTC perp uses BTC-USDT-SWAP instId."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "code": "0",
            "msg": "",
            "data": [
                {
                    "instId": "BTC-USDT-SWAP",
                    "tradeId": "123456789",
                    "px": "97500.00",
                    "sz": "0.10",
                    "side": "buy",
                    "ts": "1735689660000",
                },
            ],
        }
        mock_response.raise_for_status = MagicMock()
        client.get = AsyncMock(return_value=mock_response)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_okx_trades(
                client, "BTC", "perp", 1735689660000, 1735689719999
            )

        assert len(trades) == 1
        assert trades[0].market_type == MarketType.PERP

        call_args = client.get.call_args
        assert call_args[1]["params"]["instId"] == "BTC-USDT-SWAP"

    @pytest.mark.asyncio
    async def test_fetch_okx_eth_spot_mapping(self, backfill_service):
        """Test ETH is mapped to ETH-USDT."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "code": "0",
            "msg": "",
            "data": [
                {
                    "instId": "ETH-USDT",
                    "tradeId": "987654321",
                    "px": "3500.00",
                    "sz": "1.0",
                    "side": "buy",
                    "ts": "1735689660000",
                },
            ],
        }
        mock_response.raise_for_status = MagicMock()
        client.get = AsyncMock(return_value=mock_response)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_okx_trades(
                client, "ETH", "spot", 1735689660000, 1735689719999
            )

        assert len(trades) == 1
        assert trades[0].asset == AssetId.ETH

        call_args = client.get.call_args
        assert call_args[1]["params"]["instId"] == "ETH-USDT"

    @pytest.mark.asyncio
    async def test_fetch_okx_unknown_asset_returns_empty(self, backfill_service):
        """Test unknown asset returns empty list (not error)."""
        client = AsyncMock(spec=httpx.AsyncClient)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_okx_trades(
                client, "UNKNOWN", "spot", 1735689660000, 1735689719999
            )

        assert trades == []
        client.get.assert_not_called()

    @pytest.mark.asyncio
    async def test_fetch_okx_filters_by_time_range(self, backfill_service):
        """Test trades outside time range are filtered out."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "code": "0",
            "msg": "",
            "data": [
                # After range
                {"instId": "BTC-USDT", "tradeId": "4", "px": "97600.0", "sz": "0.1", "side": "buy", "ts": "1735689720000"},
                # In range
                {"instId": "BTC-USDT", "tradeId": "3", "px": "97510.0", "sz": "0.1", "side": "buy", "ts": "1735689665000"},
                {"instId": "BTC-USDT", "tradeId": "2", "px": "97500.0", "sz": "0.1", "side": "buy", "ts": "1735689660000"},
                # Before range
                {"instId": "BTC-USDT", "tradeId": "1", "px": "97400.0", "sz": "0.1", "side": "buy", "ts": "1735689659000"},
            ],
        }
        mock_response.raise_for_status = MagicMock()
        client.get = AsyncMock(return_value=mock_response)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_okx_trades(
                client, "BTC", "spot", 1735689660000, 1735689719999
            )

        # Only trades at 1735689660 and 1735689665 should be included
        assert len(trades) == 2
        assert trades[0].price == 97510.0
        assert trades[1].price == 97500.0

    @pytest.mark.asyncio
    async def test_fetch_okx_api_error_raises_exception(self, backfill_service):
        """Test OKX API error is handled and raised."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "code": "50001",
            "msg": "System error",
            "data": [],
        }
        mock_response.raise_for_status = MagicMock()
        client.get = AsyncMock(return_value=mock_response)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            with pytest.raises(RuntimeError) as exc_info:
                await backfill_service._fetch_okx_trades(
                    client, "BTC", "spot", 1735689660000, 1735689719999
                )

        assert "OKX API error" in str(exc_info.value)
        assert "System error" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_fetch_okx_http_error_raises_exception(self, backfill_service):
        """Test HTTP error is handled with venue-prefixed logging."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.text = "Rate limit exceeded"
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Rate limit exceeded",
            request=MagicMock(),
            response=mock_response,
        )
        client.get = AsyncMock(return_value=mock_response)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            with pytest.raises(httpx.HTTPStatusError):
                await backfill_service._fetch_okx_trades(
                    client, "BTC", "spot", 1735689660000, 1735689719999
                )

    @pytest.mark.asyncio
    async def test_fetch_okx_invalid_trade_format_skipped(self, backfill_service):
        """Test malformed trades are skipped with warning."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "code": "0",
            "msg": "",
            "data": [
                # Valid trade
                {"instId": "BTC-USDT", "tradeId": "1", "px": "97500.0", "sz": "0.1", "side": "buy", "ts": "1735689660000"},
                # Invalid: non-numeric price
                {"instId": "BTC-USDT", "tradeId": "2", "px": "invalid", "sz": "0.1", "side": "buy", "ts": "1735689661000"},
                # Invalid: zero price
                {"instId": "BTC-USDT", "tradeId": "3", "px": "0", "sz": "0.1", "side": "buy", "ts": "1735689661500"},
                # Valid trade
                {"instId": "BTC-USDT", "tradeId": "4", "px": "97520.0", "sz": "0.2", "side": "sell", "ts": "1735689662000"},
            ],
        }
        mock_response.raise_for_status = MagicMock()
        client.get = AsyncMock(return_value=mock_response)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_okx_trades(
                client, "BTC", "spot", 1735689660000, 1735689719999
            )

        # Only valid trades should be included
        assert len(trades) == 2
        assert trades[0].price == 97500.0
        assert trades[1].price == 97520.0

    @pytest.mark.asyncio
    async def test_fetch_okx_pagination_uses_after(self, backfill_service):
        """Test pagination uses 'after' parameter with tradeId."""
        client = AsyncMock(spec=httpx.AsyncClient)

        # First response - 100 trades (triggers pagination)
        first_response = {
            "code": "0",
            "msg": "",
            "data": [
                {"instId": "BTC-USDT", "tradeId": str(1000 - i), "px": "97500.0", "sz": "0.1", "side": "buy", "ts": str(1735689660000 + i)}
                for i in range(100)
            ],
        }

        # Second response - fewer trades (end of data)
        second_response = {
            "code": "0",
            "msg": "",
            "data": [
                {"instId": "BTC-USDT", "tradeId": "900", "px": "97600.0", "sz": "0.1", "side": "buy", "ts": "1735689661000"},
            ],
        }

        mock_responses = [MagicMock(), MagicMock()]
        mock_responses[0].json.return_value = first_response
        mock_responses[0].raise_for_status = MagicMock()
        mock_responses[1].json.return_value = second_response
        mock_responses[1].raise_for_status = MagicMock()

        client.get = AsyncMock(side_effect=mock_responses)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_okx_trades(
                client, "BTC", "spot", 1735689660000, 1735689719999
            )

        # Should have made 2 API calls
        assert client.get.call_count == 2

        # Second call should use 'after' with the last tradeId from first response
        second_call = client.get.call_args_list[1]
        assert second_call[1]["params"]["after"] == "901"  # Last trade in first response

    @pytest.mark.asyncio
    async def test_fetch_okx_empty_result_returns_empty(self, backfill_service):
        """Test empty API result returns empty list."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "code": "0",
            "msg": "",
            "data": [],
        }
        mock_response.raise_for_status = MagicMock()
        client.get = AsyncMock(return_value=mock_response)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_okx_trades(
                client, "BTC", "spot", 1735689660000, 1735689719999
            )

        assert trades == []


# =============================================================================
# Bybit Backfill Fetcher Tests
# =============================================================================


class TestBybitBackfillFetcher:
    """Tests for _fetch_bybit_trades()."""

    @pytest.fixture
    def sample_bybit_response(self):
        """Sample Bybit REST API response."""
        return {
            "retCode": 0,
            "retMsg": "OK",
            "result": {
                "category": "linear",
                "list": [
                    {
                        "execId": "123456789",
                        "symbol": "BTCUSDT",
                        "price": "97500.00",
                        "size": "0.10000000",
                        "side": "Buy",  # taker bought -> is_buyer_maker=False
                        "time": "1735689660123",
                        "isBlockTrade": False,
                    },
                    {
                        "execId": "123456790",
                        "symbol": "BTCUSDT",
                        "price": "97510.00",
                        "size": "0.05000000",
                        "side": "Sell",  # taker sold -> is_buyer_maker=True
                        "time": "1735689661234",
                        "isBlockTrade": False,
                    },
                    {
                        "execId": "123456791",
                        "symbol": "BTCUSDT",
                        "price": "97505.00",
                        "size": "0.20000000",
                        "side": "Buy",
                        "time": "1735689662345",
                        "isBlockTrade": False,
                    },
                ],
            },
            "retExtInfo": {},
            "time": 1735689663000,
        }

    @pytest.fixture
    def mock_bybit_client(self, sample_bybit_response):
        """Mock httpx client with Bybit response."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.json.return_value = sample_bybit_response
        mock_response.raise_for_status = MagicMock()
        client.get = AsyncMock(return_value=mock_response)
        return client

    @pytest.mark.asyncio
    async def test_fetch_bybit_trades_success(self, backfill_service, mock_bybit_client):
        """Test successful Bybit trade fetch."""
        start_ms = 1735689660000
        end_ms = 1735689719999

        with patch.object(backfill_service, "_get_client", return_value=mock_bybit_client):
            with patch("asyncio.sleep", new_callable=AsyncMock):
                trades = await backfill_service._fetch_bybit_trades(
                    mock_bybit_client, "BTC", "perp", start_ms, end_ms
                )

        assert len(trades) == 3
        assert all(isinstance(t, Trade) for t in trades)
        assert all(t.venue == VenueId.BYBIT for t in trades)
        assert all(t.asset == AssetId.BTC for t in trades)
        assert all(t.market_type == MarketType.PERP for t in trades)

    @pytest.mark.asyncio
    async def test_fetch_bybit_trades_buy_sell_sides(self, backfill_service, mock_bybit_client):
        """Test correct taker side parsing from Bybit."""
        start_ms = 1735689660000
        end_ms = 1735689719999

        with patch.object(backfill_service, "_get_client", return_value=mock_bybit_client):
            with patch("asyncio.sleep", new_callable=AsyncMock):
                trades = await backfill_service._fetch_bybit_trades(
                    mock_bybit_client, "BTC", "perp", start_ms, end_ms
                )

        # First trade: side="Buy" -> taker bought -> is_buyer_maker=False = BUY
        assert trades[0].is_buyer_maker is False
        assert trades[0].taker_side == TakerSide.BUY
        assert trades[0].price == 97500.0

        # Second trade: side="Sell" -> taker sold -> is_buyer_maker=True = SELL
        assert trades[1].is_buyer_maker is True
        assert trades[1].taker_side == TakerSide.SELL
        assert trades[1].price == 97510.0

        # Third trade: side="Buy" -> taker bought = BUY
        assert trades[2].is_buyer_maker is False
        assert trades[2].taker_side == TakerSide.BUY
        assert trades[2].price == 97505.0

    @pytest.mark.asyncio
    async def test_fetch_bybit_uses_correct_symbol(self, backfill_service, mock_bybit_client):
        """Test BTC perp uses BTCUSDT symbol."""
        start_ms = 1735689660000
        end_ms = 1735689719999

        with patch.object(backfill_service, "_get_client", return_value=mock_bybit_client):
            with patch("asyncio.sleep", new_callable=AsyncMock):
                await backfill_service._fetch_bybit_trades(
                    mock_bybit_client, "BTC", "perp", start_ms, end_ms
                )

        call_args = mock_bybit_client.get.call_args
        assert call_args[1]["params"]["symbol"] == "BTCUSDT"
        assert call_args[1]["params"]["category"] == "linear"

    @pytest.mark.asyncio
    async def test_fetch_bybit_eth_mapping(self, backfill_service):
        """Test ETH is mapped to ETHUSDT."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "retCode": 0,
            "retMsg": "OK",
            "result": {
                "category": "linear",
                "list": [
                    {
                        "execId": "987654321",
                        "symbol": "ETHUSDT",
                        "price": "3500.00",
                        "size": "1.0",
                        "side": "Buy",
                        "time": "1735689660000",
                        "isBlockTrade": False,
                    },
                ],
            },
            "retExtInfo": {},
            "time": 1735689661000,
        }
        mock_response.raise_for_status = MagicMock()
        client.get = AsyncMock(return_value=mock_response)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_bybit_trades(
                client, "ETH", "perp", 1735689660000, 1735689719999
            )

        assert len(trades) == 1
        assert trades[0].asset == AssetId.ETH

        call_args = client.get.call_args
        assert call_args[1]["params"]["symbol"] == "ETHUSDT"

    @pytest.mark.asyncio
    async def test_fetch_bybit_unknown_asset_returns_empty(self, backfill_service):
        """Test unknown asset returns empty list (not error)."""
        client = AsyncMock(spec=httpx.AsyncClient)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_bybit_trades(
                client, "UNKNOWN", "perp", 1735689660000, 1735689719999
            )

        assert trades == []
        client.get.assert_not_called()

    @pytest.mark.asyncio
    async def test_fetch_bybit_spot_not_supported(self, backfill_service):
        """Test spot market returns empty (Bybit only supports perp in our scope)."""
        client = AsyncMock(spec=httpx.AsyncClient)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_bybit_trades(
                client, "BTC", "spot", 1735689660000, 1735689719999
            )

        assert trades == []
        client.get.assert_not_called()

    @pytest.mark.asyncio
    async def test_fetch_bybit_filters_by_time_range(self, backfill_service):
        """Test trades outside time range are filtered out."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "retCode": 0,
            "retMsg": "OK",
            "result": {
                "category": "linear",
                "list": [
                    # After range
                    {"execId": "4", "symbol": "BTCUSDT", "price": "97600.0", "size": "0.1", "side": "Buy", "time": "1735689720000", "isBlockTrade": False},
                    # In range
                    {"execId": "3", "symbol": "BTCUSDT", "price": "97510.0", "size": "0.1", "side": "Buy", "time": "1735689665000", "isBlockTrade": False},
                    {"execId": "2", "symbol": "BTCUSDT", "price": "97500.0", "size": "0.1", "side": "Buy", "time": "1735689660000", "isBlockTrade": False},
                    # Before range
                    {"execId": "1", "symbol": "BTCUSDT", "price": "97400.0", "size": "0.1", "side": "Buy", "time": "1735689659000", "isBlockTrade": False},
                ],
            },
            "retExtInfo": {},
            "time": 1735689721000,
        }
        mock_response.raise_for_status = MagicMock()
        client.get = AsyncMock(return_value=mock_response)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_bybit_trades(
                client, "BTC", "perp", 1735689660000, 1735689719999
            )

        # Only trades at 1735689660 and 1735689665 should be included
        assert len(trades) == 2
        assert trades[0].price == 97510.0
        assert trades[1].price == 97500.0

    @pytest.mark.asyncio
    async def test_fetch_bybit_api_error_raises_exception(self, backfill_service):
        """Test Bybit API error is handled and raised."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "retCode": 10001,
            "retMsg": "Invalid parameter",
            "result": {},
            "retExtInfo": {},
            "time": 1735689660000,
        }
        mock_response.raise_for_status = MagicMock()
        client.get = AsyncMock(return_value=mock_response)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            with pytest.raises(RuntimeError) as exc_info:
                await backfill_service._fetch_bybit_trades(
                    client, "BTC", "perp", 1735689660000, 1735689719999
                )

        assert "Bybit API error" in str(exc_info.value)
        assert "Invalid parameter" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_fetch_bybit_http_error_raises_exception(self, backfill_service):
        """Test HTTP error is handled with venue-prefixed logging."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.text = "Rate limit exceeded"
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Rate limit exceeded",
            request=MagicMock(),
            response=mock_response,
        )
        client.get = AsyncMock(return_value=mock_response)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            with pytest.raises(httpx.HTTPStatusError):
                await backfill_service._fetch_bybit_trades(
                    client, "BTC", "perp", 1735689660000, 1735689719999
                )

    @pytest.mark.asyncio
    async def test_fetch_bybit_invalid_trade_format_skipped(self, backfill_service):
        """Test malformed trades are skipped with warning."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "retCode": 0,
            "retMsg": "OK",
            "result": {
                "category": "linear",
                "list": [
                    # Valid trade
                    {"execId": "1", "symbol": "BTCUSDT", "price": "97500.0", "size": "0.1", "side": "Buy", "time": "1735689660000", "isBlockTrade": False},
                    # Invalid: non-numeric price
                    {"execId": "2", "symbol": "BTCUSDT", "price": "invalid", "size": "0.1", "side": "Buy", "time": "1735689661000", "isBlockTrade": False},
                    # Invalid: zero price
                    {"execId": "3", "symbol": "BTCUSDT", "price": "0", "size": "0.1", "side": "Buy", "time": "1735689661500", "isBlockTrade": False},
                    # Valid trade
                    {"execId": "4", "symbol": "BTCUSDT", "price": "97520.0", "size": "0.2", "side": "Sell", "time": "1735689662000", "isBlockTrade": False},
                ],
            },
            "retExtInfo": {},
            "time": 1735689663000,
        }
        mock_response.raise_for_status = MagicMock()
        client.get = AsyncMock(return_value=mock_response)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_bybit_trades(
                client, "BTC", "perp", 1735689660000, 1735689719999
            )

        # Only valid trades should be included
        assert len(trades) == 2
        assert trades[0].price == 97500.0
        assert trades[1].price == 97520.0

    @pytest.mark.asyncio
    async def test_fetch_bybit_empty_result_returns_empty(self, backfill_service):
        """Test empty API result returns empty list."""
        client = AsyncMock(spec=httpx.AsyncClient)
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "retCode": 0,
            "retMsg": "OK",
            "result": {
                "category": "linear",
                "list": [],
            },
            "retExtInfo": {},
            "time": 1735689660000,
        }
        mock_response.raise_for_status = MagicMock()
        client.get = AsyncMock(return_value=mock_response)

        with patch("asyncio.sleep", new_callable=AsyncMock):
            trades = await backfill_service._fetch_bybit_trades(
                client, "BTC", "perp", 1735689660000, 1735689719999
            )

        assert trades == []


# =============================================================================
# Backfill Service Integration Tests
# =============================================================================


class TestBackfillServiceDispatch:
    """Test _fetch_trades_for_minute dispatch logic."""

    @pytest.mark.asyncio
    async def test_dispatch_to_binance(self, backfill_service):
        """Test binance venue dispatches to _fetch_binance_trades."""
        with patch.object(backfill_service, "_get_client") as mock_get_client:
            mock_client = AsyncMock()
            mock_get_client.return_value = mock_client

            with patch.object(
                backfill_service, "_fetch_binance_trades", new_callable=AsyncMock
            ) as mock_fetch:
                mock_fetch.return_value = []

                await backfill_service._fetch_trades_for_minute(
                    "BTC", "spot", "binance", 1735689660
                )

                mock_fetch.assert_called_once()

    @pytest.mark.asyncio
    async def test_dispatch_to_kraken(self, backfill_service):
        """Test kraken venue dispatches to _fetch_kraken_trades."""
        with patch.object(backfill_service, "_get_client") as mock_get_client:
            mock_client = AsyncMock()
            mock_get_client.return_value = mock_client

            with patch.object(
                backfill_service, "_fetch_kraken_trades", new_callable=AsyncMock
            ) as mock_fetch:
                mock_fetch.return_value = []

                await backfill_service._fetch_trades_for_minute(
                    "BTC", "spot", "kraken", 1735689660
                )

                mock_fetch.assert_called_once()

    @pytest.mark.asyncio
    async def test_dispatch_to_okx(self, backfill_service):
        """Test okx venue dispatches to _fetch_okx_trades."""
        with patch.object(backfill_service, "_get_client") as mock_get_client:
            mock_client = AsyncMock()
            mock_get_client.return_value = mock_client

            with patch.object(
                backfill_service, "_fetch_okx_trades", new_callable=AsyncMock
            ) as mock_fetch:
                mock_fetch.return_value = []

                await backfill_service._fetch_trades_for_minute(
                    "BTC", "spot", "okx", 1735689660
                )

                mock_fetch.assert_called_once()

    @pytest.mark.asyncio
    async def test_dispatch_to_bybit(self, backfill_service):
        """Test bybit venue dispatches to _fetch_bybit_trades."""
        with patch.object(backfill_service, "_get_client") as mock_get_client:
            mock_client = AsyncMock()
            mock_get_client.return_value = mock_client

            with patch.object(
                backfill_service, "_fetch_bybit_trades", new_callable=AsyncMock
            ) as mock_fetch:
                mock_fetch.return_value = []

                await backfill_service._fetch_trades_for_minute(
                    "BTC", "perp", "bybit", 1735689660
                )

                mock_fetch.assert_called_once()

    @pytest.mark.asyncio
    async def test_dispatch_unsupported_venue_returns_empty(self, backfill_service):
        """Test unsupported venue returns empty list with warning."""
        with patch.object(backfill_service, "_get_client") as mock_get_client:
            mock_client = AsyncMock()
            mock_get_client.return_value = mock_client

            trades = await backfill_service._fetch_trades_for_minute(
                "BTC", "spot", "unsupported_venue", 1735689660
            )

            assert trades == []


# =============================================================================
# Constants and Configuration Tests
# =============================================================================


class TestBackfillConstants:
    """Test backfill constants and configuration."""

    def test_kraken_pair_map_btc(self):
        """Test BTC mapping to Kraken format."""
        assert KRAKEN_PAIR_MAP["BTC"] == "XXBTZUSD"

    def test_kraken_pair_map_eth(self):
        """Test ETH mapping to Kraken format."""
        assert KRAKEN_PAIR_MAP["ETH"] == "XETHZUSD"

    def test_kraken_endpoint_correct(self):
        """Test Kraken trades endpoint is correct."""
        assert KRAKEN_TRADES == "https://api.kraken.com/0/public/Trades"

    def test_binance_spot_endpoint_correct(self):
        """Test Binance spot trades endpoint is correct."""
        assert BINANCE_SPOT_TRADES == "https://api.binance.com/api/v3/aggTrades"

    def test_binance_perp_endpoint_correct(self):
        """Test Binance perp trades endpoint is correct."""
        assert BINANCE_PERP_TRADES == "https://fapi.binance.com/fapi/v1/aggTrades"

    def test_okx_endpoint_correct(self):
        """Test OKX trades endpoint is correct."""
        assert OKX_TRADES == "https://www.okx.com/api/v5/market/history-trades"

    def test_okx_inst_map_btc_spot(self):
        """Test BTC spot mapping to OKX format."""
        assert OKX_INST_MAP[("BTC", "spot")] == "BTC-USDT"

    def test_okx_inst_map_btc_perp(self):
        """Test BTC perp mapping to OKX format."""
        assert OKX_INST_MAP[("BTC", "perp")] == "BTC-USDT-SWAP"

    def test_okx_inst_map_eth_spot(self):
        """Test ETH spot mapping to OKX format."""
        assert OKX_INST_MAP[("ETH", "spot")] == "ETH-USDT"

    def test_okx_inst_map_eth_perp(self):
        """Test ETH perp mapping to OKX format."""
        assert OKX_INST_MAP[("ETH", "perp")] == "ETH-USDT-SWAP"

    def test_bybit_endpoint_correct(self):
        """Test Bybit trades endpoint is correct."""
        assert BYBIT_TRADES == "https://api.bybit.com/v5/market/recent-trade"

    def test_bybit_symbol_map_btc_perp(self):
        """Test BTC perp mapping to Bybit format."""
        assert BYBIT_SYMBOL_MAP[("BTC", "perp")] == "BTCUSDT"

    def test_bybit_symbol_map_eth_perp(self):
        """Test ETH perp mapping to Bybit format."""
        assert BYBIT_SYMBOL_MAP[("ETH", "perp")] == "ETHUSDT"
