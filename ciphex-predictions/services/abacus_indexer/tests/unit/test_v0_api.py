"""
Unit tests for Abacus Indexer V0 API endpoints.

Tests the /v0/* endpoints using TestClient.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi.testclient import TestClient

from services.abacus_indexer.app.main import app
from services.abacus_indexer.core.types import (
    AssetId,
    CompositeBar,
    ConnectionState,
    MarketType,
    VenueId,
    VenueTelemetry,
)


@pytest.fixture
def mock_aggregator():
    """Create a mock aggregator."""
    aggregator = MagicMock()
    aggregator.get_current_prices.return_value = {
        "BTC_spot_binance": 45000.0,
        "BTC_perp_binance": 45050.0,
        "ETH_spot_binance": 2500.0,
        "ETH_perp_binance": 2505.0,
    }
    aggregator.get_connection_status.return_value = {
        "BTC_spot_binance": True,
        "BTC_perp_binance": True,
        "ETH_spot_binance": True,
        "ETH_perp_binance": True,
    }
    aggregator._connectors = {}
    return aggregator


@pytest.fixture
def mock_repository():
    """Create a mock repository."""
    repository = MagicMock()

    async def mock_get_latest(asset, market_type):
        return CompositeBar(
            time=1700000000,
            open=45000.0,
            high=45100.0,
            low=44900.0,
            close=45050.0,
            volume=100.0,
            degraded=False,
            is_gap=False,
            is_backfilled=False,
            included_venues=["binance", "coinbase"],
            excluded_venues=[],
            asset=AssetId(asset),
            market_type=MarketType(market_type),
        )

    async def mock_get_range(asset, market_type, start_time, end_time, limit):
        return [
            CompositeBar(
                time=1700000000 + i * 60,
                open=45000.0 + i,
                high=45100.0 + i,
                low=44900.0 + i,
                close=45050.0 + i,
                volume=100.0,
                degraded=False,
                is_gap=False,
                is_backfilled=False,
                included_venues=["binance"],
                excluded_venues=[],
                asset=AssetId(asset),
                market_type=MarketType(market_type),
            )
            for i in range(min(limit, 5))
        ]

    repository.get_latest = mock_get_latest
    repository.get_range = mock_get_range
    return repository


@pytest.fixture
def client_with_mocks(mock_aggregator, mock_repository):
    """Create test client with mocked dependencies."""
    app.state.aggregator = mock_aggregator
    app.state.repository = mock_repository
    return TestClient(app)


class TestLatestEndpoint:
    """Tests for GET /v0/latest."""

    def test_latest_returns_all_assets(self, client_with_mocks):
        """Should return prices for all assets/markets."""
        response = client_with_mocks.get("/v0/latest")

        assert response.status_code == 200
        data = response.json()

        # Should have 4 entries: BTC spot/perp, ETH spot/perp
        assert len(data) == 4

        # Check structure
        for item in data:
            assert "asset" in item
            assert "market_type" in item
            assert "price" in item
            assert "time" in item
            assert "included_venues" in item

    def test_latest_filter_by_asset(self, client_with_mocks):
        """Should filter by asset."""
        response = client_with_mocks.get("/v0/latest?asset=BTC")

        assert response.status_code == 200
        data = response.json()

        # Should only have BTC entries
        assert len(data) == 2
        assert all(item["asset"] == "BTC" for item in data)

    def test_latest_filter_by_market_type(self, client_with_mocks):
        """Should filter by market type."""
        response = client_with_mocks.get("/v0/latest?market_type=spot")

        assert response.status_code == 200
        data = response.json()

        # Should only have spot entries
        assert len(data) == 2
        assert all(item["market_type"] == "spot" for item in data)

    def test_latest_filter_by_both(self, client_with_mocks):
        """Should filter by both asset and market type."""
        response = client_with_mocks.get("/v0/latest?asset=BTC&market_type=spot")

        assert response.status_code == 200
        data = response.json()

        assert len(data) == 1
        assert data[0]["asset"] == "BTC"
        assert data[0]["market_type"] == "spot"

    def test_latest_includes_last_bar(self, client_with_mocks):
        """Should include last completed bar when repository available."""
        response = client_with_mocks.get("/v0/latest?asset=BTC&market_type=spot")

        assert response.status_code == 200
        data = response.json()

        assert len(data) == 1
        assert data[0]["last_bar"] is not None
        assert data[0]["last_bar"]["close"] == 45050.0


class TestCandlesEndpoint:
    """Tests for GET /v0/candles."""

    def test_candles_requires_asset(self, client_with_mocks):
        """Should require asset parameter."""
        response = client_with_mocks.get("/v0/candles?market_type=spot")

        assert response.status_code == 422  # Validation error

    def test_candles_requires_market_type(self, client_with_mocks):
        """Should require market_type parameter."""
        response = client_with_mocks.get("/v0/candles?asset=BTC")

        assert response.status_code == 422  # Validation error

    def test_candles_returns_data(self, client_with_mocks):
        """Should return candle data."""
        response = client_with_mocks.get("/v0/candles?asset=BTC&market_type=spot")

        assert response.status_code == 200
        data = response.json()

        assert data["asset"] == "BTC"
        assert data["market_type"] == "spot"
        assert "candles" in data
        assert len(data["candles"]) > 0

    def test_candles_with_time_range(self, client_with_mocks):
        """Should accept time range parameters."""
        response = client_with_mocks.get(
            "/v0/candles?asset=BTC&market_type=spot&start=1700000000&end=1700003600"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["start_time"] == 1700000000
        assert data["end_time"] == 1700003600

    def test_candles_with_limit(self, client_with_mocks):
        """Should respect limit parameter."""
        response = client_with_mocks.get(
            "/v0/candles?asset=BTC&market_type=spot&limit=3"
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["candles"]) <= 3

    def test_candles_invalid_asset(self, client_with_mocks):
        """Should reject invalid asset."""
        response = client_with_mocks.get(
            "/v0/candles?asset=INVALID&market_type=spot"
        )

        assert response.status_code == 400

    def test_candles_invalid_market_type(self, client_with_mocks):
        """Should reject invalid market type."""
        response = client_with_mocks.get(
            "/v0/candles?asset=BTC&market_type=invalid"
        )

        assert response.status_code == 400

    def test_candles_invalid_time_range(self, client_with_mocks):
        """Should reject start >= end."""
        response = client_with_mocks.get(
            "/v0/candles?asset=BTC&market_type=spot&start=1700003600&end=1700000000"
        )

        assert response.status_code == 400


class TestTelemetryEndpoint:
    """Tests for GET /v0/telemetry."""

    def test_telemetry_returns_data(self, mock_aggregator, mock_repository):
        """Should return telemetry data."""
        # Add mock connectors with telemetry
        mock_connector = MagicMock()
        mock_connector.get_telemetry.return_value = VenueTelemetry(
            venue=VenueId.BINANCE,
            market_type=MarketType.SPOT,
            asset=AssetId.BTC,
            connection_state=ConnectionState.CONNECTED,
            last_message_time=1700000000000,
            message_count=1000,
            trade_count=500,
            reconnect_count=0,
            uptime_percent=100.0,
        )
        mock_aggregator._connectors = {
            (VenueId.BINANCE, AssetId.BTC, MarketType.SPOT): mock_connector,
        }

        app.state.aggregator = mock_aggregator
        app.state.repository = mock_repository

        client = TestClient(app)
        response = client.get("/v0/telemetry")

        assert response.status_code == 200
        data = response.json()

        assert "venues" in data
        assert "system_health" in data
        assert "timestamp" in data
        assert len(data["venues"]) == 1
        assert data["venues"][0]["venue"] == "binance"
        assert data["venues"][0]["connection_state"] == "connected"


class TestStreamEndpoint:
    """Tests for GET /v0/stream (SSE)."""

    @pytest.mark.skip(reason="SSE streaming tests require async context - tested manually")
    def test_stream_endpoint_exists(self, client_with_mocks):
        """SSE endpoint should exist and return streaming response."""
        # SSE testing with sync TestClient blocks indefinitely
        # This endpoint is validated via manual testing and integration tests
        pass


class TestALBRouting:
    """Tests for ALB path-based routing (/indexer/v0/*)."""

    def test_latest_via_alb_prefix(self, client_with_mocks):
        """Should work with /indexer prefix."""
        response = client_with_mocks.get("/indexer/v0/latest")

        assert response.status_code == 200

    def test_candles_via_alb_prefix(self, client_with_mocks):
        """Should work with /indexer prefix."""
        response = client_with_mocks.get(
            "/indexer/v0/candles?asset=BTC&market_type=spot"
        )

        assert response.status_code == 200

    def test_telemetry_via_alb_prefix(self, mock_aggregator, mock_repository):
        """Should work with /indexer prefix."""
        mock_aggregator._connectors = {}
        app.state.aggregator = mock_aggregator
        app.state.repository = mock_repository

        client = TestClient(app)
        response = client.get("/indexer/v0/telemetry")

        assert response.status_code == 200
