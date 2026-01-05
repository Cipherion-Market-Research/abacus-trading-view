"""
Unit tests for Abacus Indexer Aggregator.

Tests composite bar computation and aggregator logic.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock

from services.abacus_indexer.core.types import (
    AssetId,
    Bar,
    CompositeBar,
    MarketType,
    VenueId,
)
from services.abacus_indexer.aggregator.composite_aggregator import (
    CompositeAggregator,
    AggregatorConfig,
    VenueBarBuffer,
)


class TestAggregatorConfig:
    """Tests for AggregatorConfig."""

    def test_default_config(self):
        """Default config should have BTC, ETH and Binance."""
        config = AggregatorConfig()

        assert AssetId.BTC in config.assets
        assert AssetId.ETH in config.assets
        assert VenueId.BINANCE in config.spot_venues
        assert VenueId.BINANCE in config.perp_venues

    def test_custom_config(self):
        """Custom config should override defaults."""
        config = AggregatorConfig(
            assets=[AssetId.BTC],
            spot_venues=[VenueId.BINANCE, VenueId.COINBASE],
            perp_venues=[VenueId.BINANCE],
        )

        assert config.assets == [AssetId.BTC]
        assert len(config.spot_venues) == 2
        assert len(config.perp_venues) == 1


class TestVenueBarBuffer:
    """Tests for VenueBarBuffer."""

    def test_initial_state(self):
        """Buffer should start empty."""
        buffer = VenueBarBuffer(
            venue=VenueId.BINANCE,
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        assert buffer.latest_bar is None
        assert buffer.bar_time is None

    def test_buffer_update(self):
        """Buffer should hold latest bar."""
        buffer = VenueBarBuffer(
            venue=VenueId.BINANCE,
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        bar = Bar(
            time=1700000000,
            open=45000.0,
            high=45100.0,
            low=44900.0,
            close=45050.0,
            volume=10.5,
            trade_count=100,
            venue=VenueId.BINANCE,
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        buffer.latest_bar = bar
        buffer.bar_time = bar.time

        assert buffer.latest_bar == bar
        assert buffer.bar_time == 1700000000


class TestCompositeAggregator:
    """Tests for CompositeAggregator."""

    def test_aggregator_creation(self):
        """Aggregator should create with config."""
        config = AggregatorConfig(
            assets=[AssetId.BTC],
            spot_venues=[VenueId.BINANCE],
            perp_venues=[VenueId.BINANCE],
        )
        aggregator = CompositeAggregator(config=config)

        assert aggregator.config == config
        assert len(aggregator._connectors) == 0
        assert len(aggregator._bar_buffers) == 0

    def test_aggregator_with_callback(self):
        """Aggregator should store callback."""
        mock_callback = MagicMock()
        aggregator = CompositeAggregator(on_composite_bar=mock_callback)

        assert aggregator.on_composite_bar == mock_callback

    def test_build_composite_all_venues_present(self):
        """Composite should be built from all venue bars when quorum met."""
        aggregator = CompositeAggregator()
        bar_time = 1700000000
        current_time_ms = bar_time * 1000 + 60 * 1000  # Bar close time

        # Create mock venue bars - need 2 venues for minQuorum=2
        venue_bars = {
            VenueId.BINANCE: Bar(
                time=bar_time,
                open=45000.0,
                high=45100.0,
                low=44900.0,
                close=45050.0,
                volume=10.5,
                trade_count=100,
                venue=VenueId.BINANCE,
                asset=AssetId.BTC,
                market_type=MarketType.SPOT,
            ),
            VenueId.COINBASE: Bar(
                time=bar_time,
                open=45010.0,
                high=45110.0,
                low=44910.0,
                close=45060.0,
                volume=8.2,
                trade_count=80,
                venue=VenueId.COINBASE,
                asset=AssetId.BTC,
                market_type=MarketType.SPOT,
            ),
        }

        # Provide venue state: both connected with recent updates
        venue_state = {
            VenueId.BINANCE: (True, current_time_ms - 1000),  # Updated 1s ago
            VenueId.COINBASE: (True, current_time_ms - 2000),  # Updated 2s ago
        }

        composite, close_result = aggregator._build_composite(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
            bar_time=bar_time,
            venue_bars=venue_bars,
            venue_state=venue_state,
        )

        assert composite.time == bar_time
        assert composite.asset == AssetId.BTC
        assert composite.market_type == MarketType.SPOT
        # Median of 45050 and 45060 = 45055
        assert composite.close == 45055.0
        assert not composite.is_gap

    def test_build_composite_single_venue_is_gap(self):
        """Single venue should produce gap when minQuorum=2."""
        aggregator = CompositeAggregator()
        bar_time = 1700000000
        current_time_ms = bar_time * 1000 + 60 * 1000

        venue_bars = {
            VenueId.BINANCE: Bar(
                time=bar_time,
                open=45000.0,
                high=45100.0,
                low=44900.0,
                close=45050.0,
                volume=10.5,
                trade_count=100,
                venue=VenueId.BINANCE,
                asset=AssetId.BTC,
                market_type=MarketType.SPOT,
            ),
        }

        # Single venue connected
        venue_state = {
            VenueId.BINANCE: (True, current_time_ms - 1000),
        }

        composite, close_result = aggregator._build_composite(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
            bar_time=bar_time,
            venue_bars=venue_bars,
            venue_state=venue_state,
        )

        # With minQuorum=2, single venue produces gap
        assert composite.is_gap
        assert composite.close is None
        assert "binance" in composite.included_venues

    def test_build_composite_no_venues(self):
        """Composite should be gap when no venues have data."""
        aggregator = CompositeAggregator()
        bar_time = 1700000000

        venue_bars = {
            VenueId.BINANCE: None,
        }

        # Venue is disconnected (no state provided defaults to disconnected)
        venue_state = {
            VenueId.BINANCE: (False, None),  # Disconnected
        }

        composite, close_result = aggregator._build_composite(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
            bar_time=bar_time,
            venue_bars=venue_bars,
            venue_state=venue_state,
        )

        assert composite.is_gap
        assert composite.close is None
        assert composite.open is None

    def test_build_composite_mixed_venues(self):
        """Composite should handle mix of present/absent venues."""
        aggregator = CompositeAggregator()
        bar_time = 1700000000
        current_time_ms = bar_time * 1000 + 60 * 1000

        venue_bars = {
            VenueId.BINANCE: Bar(
                time=bar_time,
                open=45000.0,
                high=45100.0,
                low=44900.0,
                close=45050.0,
                volume=10.5,
                trade_count=100,
                venue=VenueId.BINANCE,
                asset=AssetId.BTC,
                market_type=MarketType.SPOT,
            ),
            VenueId.COINBASE: None,  # Disconnected
        }

        venue_state = {
            VenueId.BINANCE: (True, current_time_ms - 1000),
            VenueId.COINBASE: (False, None),  # Disconnected
        }

        composite, close_result = aggregator._build_composite(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
            bar_time=bar_time,
            venue_bars=venue_bars,
            venue_state=venue_state,
        )

        # With minQuorum=2, single active venue produces gap
        assert composite.time == bar_time
        assert composite.is_gap

    def test_build_composite_stale_venue_excluded(self):
        """Stale venue should be excluded from composite."""
        aggregator = CompositeAggregator()
        bar_time = 1700000000
        current_time_ms = bar_time * 1000 + 60 * 1000

        # Two venues with bars
        venue_bars = {
            VenueId.BINANCE: Bar(
                time=bar_time,
                open=45000.0,
                high=45100.0,
                low=44900.0,
                close=45050.0,
                volume=10.5,
                trade_count=100,
                venue=VenueId.BINANCE,
                asset=AssetId.BTC,
                market_type=MarketType.SPOT,
            ),
            VenueId.COINBASE: Bar(
                time=bar_time,
                open=45010.0,
                high=45110.0,
                low=44910.0,
                close=45060.0,
                volume=8.2,
                trade_count=80,
                venue=VenueId.COINBASE,
                asset=AssetId.BTC,
                market_type=MarketType.SPOT,
            ),
        }

        # Binance is fresh, Coinbase is stale (> 30s for Coinbase threshold)
        venue_state = {
            VenueId.BINANCE: (True, current_time_ms - 1000),  # Updated 1s ago
            VenueId.COINBASE: (True, current_time_ms - 35_000),  # Updated 35s ago (stale)
        }

        composite, close_result = aggregator._build_composite(
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
            bar_time=bar_time,
            venue_bars=venue_bars,
            venue_state=venue_state,
        )

        # Coinbase should be excluded for staleness, leaving only Binance
        # With minQuorum=2, this produces a gap
        assert composite.is_gap
        assert "binance" in composite.included_venues
        # Coinbase should be in excluded venues with STALE reason
        excluded_venues = [ev.venue for ev in composite.excluded_venues]
        assert "coinbase" in excluded_venues

    def test_get_current_prices_empty(self):
        """Should return empty dict when no connectors."""
        aggregator = CompositeAggregator()
        prices = aggregator.get_current_prices()
        assert prices == {}

    def test_get_connection_status_empty(self):
        """Should return empty dict when no connectors."""
        aggregator = CompositeAggregator()
        status = aggregator.get_connection_status()
        assert status == {}


class TestCompositeBarOutput:
    """Tests for composite bar serialization."""

    def test_composite_bar_camel_case(self):
        """CompositeBar should serialize with camelCase."""
        bar = CompositeBar(
            time=1700000000,
            open=45000.0,
            high=45100.0,
            low=44900.0,
            close=45050.0,
            volume=10.5,
            degraded=False,
            is_gap=False,
            is_backfilled=False,
            included_venues=["binance"],
            excluded_venues=[],
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        data = bar.model_dump(by_alias=True)

        assert "isGap" in data
        assert "isBackfilled" in data
        assert "includedVenues" in data
        assert "excludedVenues" in data
        assert "marketType" in data

    def test_composite_bar_gap_serialization(self):
        """Gap bar should serialize correctly."""
        bar = CompositeBar(
            time=1700000000,
            open=None,
            high=None,
            low=None,
            close=None,
            volume=0.0,
            degraded=True,
            is_gap=True,
            is_backfilled=False,
            included_venues=[],
            excluded_venues=[],
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        assert bar.is_gap is True
        assert bar.is_valid() is False
        assert bar.close is None


class TestInMemoryBarBuffer:
    """Tests for in-memory composite bar buffer."""

    def _make_composite_bar(self, time: int, close: float, asset: AssetId, market_type: MarketType) -> CompositeBar:
        """Helper to create test composite bars."""
        return CompositeBar(
            time=time,
            open=close - 10,
            high=close + 10,
            low=close - 20,
            close=close,
            volume=100.0,
            degraded=False,
            is_gap=False,
            is_backfilled=False,
            included_venues=["binance", "coinbase"],
            excluded_venues=[],
            asset=asset,
            market_type=market_type,
        )

    def test_store_and_retrieve_latest_bar(self):
        """Should store and retrieve the latest bar."""
        aggregator = CompositeAggregator()

        bar = self._make_composite_bar(1700000000, 45000.0, AssetId.BTC, MarketType.SPOT)
        aggregator._store_composite_bar(bar)

        latest = aggregator.get_latest_bar(AssetId.BTC, MarketType.SPOT)

        assert latest is not None
        assert latest.time == 1700000000
        assert latest.close == 45000.0

    def test_get_latest_bar_empty(self):
        """Should return None when no bars stored."""
        aggregator = CompositeAggregator()

        latest = aggregator.get_latest_bar(AssetId.BTC, MarketType.SPOT)

        assert latest is None

    def test_store_multiple_bars(self):
        """Should store multiple bars and return most recent."""
        aggregator = CompositeAggregator()

        # Store 3 bars
        for i in range(3):
            bar = self._make_composite_bar(1700000000 + i * 60, 45000.0 + i, AssetId.BTC, MarketType.SPOT)
            aggregator._store_composite_bar(bar)

        latest = aggregator.get_latest_bar(AssetId.BTC, MarketType.SPOT)

        assert latest is not None
        assert latest.time == 1700000000 + 2 * 60  # Most recent
        assert latest.close == 45002.0

    def test_get_bars_range(self):
        """Should retrieve bars within time range."""
        aggregator = CompositeAggregator()

        # Store 5 bars
        for i in range(5):
            bar = self._make_composite_bar(1700000000 + i * 60, 45000.0 + i, AssetId.BTC, MarketType.SPOT)
            aggregator._store_composite_bar(bar)

        # Get bars 1-3 (inclusive)
        bars = aggregator.get_bars(
            AssetId.BTC,
            MarketType.SPOT,
            start_time=1700000060,  # Bar 1
            end_time=1700000180,    # Bar 3
        )

        assert len(bars) == 3
        assert bars[0].time == 1700000060
        assert bars[-1].time == 1700000180

    def test_get_bars_with_limit(self):
        """Should respect limit parameter."""
        aggregator = CompositeAggregator()

        # Store 10 bars
        for i in range(10):
            bar = self._make_composite_bar(1700000000 + i * 60, 45000.0 + i, AssetId.BTC, MarketType.SPOT)
            aggregator._store_composite_bar(bar)

        bars = aggregator.get_bars(AssetId.BTC, MarketType.SPOT, limit=5)

        assert len(bars) == 5

    def test_get_bars_sorted_ascending(self):
        """Bars should be returned in ascending time order."""
        aggregator = CompositeAggregator()

        # Store bars out of order (shouldn't happen in practice but test sorting)
        for i in [3, 1, 4, 1, 5]:  # Some duplicates
            bar = self._make_composite_bar(1700000000 + i * 60, 45000.0 + i, AssetId.BTC, MarketType.SPOT)
            aggregator._store_composite_bar(bar)

        bars = aggregator.get_bars(AssetId.BTC, MarketType.SPOT)

        # Should be sorted by time
        times = [b.time for b in bars]
        assert times == sorted(times)

    def test_separate_buffers_per_asset_market(self):
        """Different asset/market combos should have separate buffers."""
        aggregator = CompositeAggregator()

        # Store bars for different asset/market combos
        aggregator._store_composite_bar(
            self._make_composite_bar(1700000000, 45000.0, AssetId.BTC, MarketType.SPOT)
        )
        aggregator._store_composite_bar(
            self._make_composite_bar(1700000000, 2500.0, AssetId.ETH, MarketType.SPOT)
        )
        aggregator._store_composite_bar(
            self._make_composite_bar(1700000000, 45010.0, AssetId.BTC, MarketType.PERP)
        )

        btc_spot = aggregator.get_latest_bar(AssetId.BTC, MarketType.SPOT)
        eth_spot = aggregator.get_latest_bar(AssetId.ETH, MarketType.SPOT)
        btc_perp = aggregator.get_latest_bar(AssetId.BTC, MarketType.PERP)

        assert btc_spot.close == 45000.0
        assert eth_spot.close == 2500.0
        assert btc_perp.close == 45010.0

    def test_bar_count(self):
        """Should return correct bar count."""
        aggregator = CompositeAggregator()

        assert aggregator.get_bar_count(AssetId.BTC, MarketType.SPOT) == 0

        for i in range(5):
            bar = self._make_composite_bar(1700000000 + i * 60, 45000.0 + i, AssetId.BTC, MarketType.SPOT)
            aggregator._store_composite_bar(bar)

        assert aggregator.get_bar_count(AssetId.BTC, MarketType.SPOT) == 5
        assert aggregator.get_bar_count(AssetId.ETH, MarketType.SPOT) == 0

    def test_buffer_max_size(self):
        """Buffer should not exceed max size (ring buffer behavior)."""
        from services.abacus_indexer.aggregator.composite_aggregator import MAX_IN_MEMORY_BARS

        aggregator = CompositeAggregator()

        # Store more bars than max
        for i in range(MAX_IN_MEMORY_BARS + 10):
            bar = self._make_composite_bar(1700000000 + i * 60, 45000.0 + i, AssetId.BTC, MarketType.SPOT)
            aggregator._store_composite_bar(bar)

        # Should only keep MAX_IN_MEMORY_BARS
        assert aggregator.get_bar_count(AssetId.BTC, MarketType.SPOT) == MAX_IN_MEMORY_BARS

        # Oldest bar should be dropped
        bars = aggregator.get_bars(AssetId.BTC, MarketType.SPOT, limit=MAX_IN_MEMORY_BARS + 10)
        assert bars[0].time == 1700000000 + 10 * 60  # First 10 bars dropped
