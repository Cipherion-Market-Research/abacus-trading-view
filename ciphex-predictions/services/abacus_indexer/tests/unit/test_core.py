"""
Unit tests for Abacus Indexer core modules.

Tests cover:
- types: Model validation
- constants: Frozen threshold values
- symbol_mapping: Venue symbol lookups
- bar_builder: Trade accumulation and bar completion
- outlier_filter: Median calculation, stale detection, outlier exclusion
"""

import pytest

from services.abacus_indexer.core.types import (
    AssetId,
    Bar,
    CompositeBar,
    ExcludedVenue,
    ExcludeReason,
    MarketType,
    Trade,
    VenueId,
)
from services.abacus_indexer.core.constants import (
    BAR_INTERVAL_SECONDS,
    OUTLIER_THRESHOLD_BPS,
    get_quorum_config,
    get_stale_threshold,
)
from services.abacus_indexer.core.symbol_mapping import (
    get_symbol,
    get_stream_name,
    venue_supports_market,
    build_subscription_message,
    parse_venue_symbol,
)
from services.abacus_indexer.core.bar_builder import (
    BarBuilder,
    floor_to_minute,
)
from services.abacus_indexer.core.outlier_filter import (
    calculate_median,
    calculate_deviation_bps,
    filter_outliers,
    VenuePriceInput,
)


# =============================================================================
# Types Tests
# =============================================================================

class TestTypes:
    """Test core type definitions."""

    def test_trade_model(self):
        """Test Trade model creation."""
        trade = Trade(
            timestamp=1704067200000,
            local_timestamp=1704067200010,
            price=94250.50,
            quantity=0.5,
            is_buyer_maker=True,
            venue=VenueId.BINANCE,
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )
        assert trade.price == 94250.50
        assert trade.venue == VenueId.BINANCE

    def test_bar_model(self):
        """Test Bar model creation."""
        bar = Bar(
            time=1704067200,
            open=94250.0,
            high=94300.0,
            low=94200.0,
            close=94275.0,
            volume=10.5,
            trade_count=50,
            venue=VenueId.BINANCE,
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )
        assert bar.time == 1704067200
        assert bar.high > bar.low

    def test_composite_bar_gap(self):
        """Test CompositeBar gap semantics per frozen contract."""
        gap_bar = CompositeBar(
            time=1704067200,
            open=None,
            high=None,
            low=None,
            close=None,
            volume=0,
            degraded=True,
            is_gap=True,
            is_backfilled=False,
            included_venues=[],
            excluded_venues=[
                ExcludedVenue(venue="binance", reason=ExcludeReason.DISCONNECTED),
            ],
        )
        assert gap_bar.is_gap is True
        assert gap_bar.open is None
        assert gap_bar.volume == 0
        assert not gap_bar.is_valid()

    def test_composite_bar_valid(self):
        """Test CompositeBar valid bar."""
        bar = CompositeBar(
            time=1704067200,
            open=94250.0,
            high=94300.0,
            low=94200.0,
            close=94275.0,
            volume=50.0,
            degraded=False,
            is_gap=False,
            included_venues=["binance", "coinbase", "okx"],
            excluded_venues=[],
        )
        assert bar.is_valid()
        assert bar.open is not None


# =============================================================================
# Constants Tests
# =============================================================================

class TestConstants:
    """Test frozen contract constants."""

    def test_outlier_threshold_frozen(self):
        """Outlier threshold must be 100 bps per frozen contract."""
        assert OUTLIER_THRESHOLD_BPS == 100

    def test_bar_interval_frozen(self):
        """Bar interval must be 60 seconds."""
        assert BAR_INTERVAL_SECONDS == 60

    def test_quorum_production_values(self):
        """Production quorum must be min=2, preferred=3."""
        quorum = get_quorum_config()
        assert quorum.min_quorum == 2
        assert quorum.preferred_quorum == 3
        assert quorum.allow_single_source is False

    def test_stale_thresholds_per_venue(self):
        """Verify stale thresholds per venue per frozen contract."""
        # Binance: 10s
        assert get_stale_threshold(VenueId.BINANCE, MarketType.SPOT) == 10_000
        assert get_stale_threshold(VenueId.BINANCE, MarketType.PERP) == 10_000

        # Coinbase: 30s
        assert get_stale_threshold(VenueId.COINBASE, MarketType.SPOT) == 30_000

        # OKX: 15s
        assert get_stale_threshold(VenueId.OKX, MarketType.SPOT) == 15_000
        assert get_stale_threshold(VenueId.OKX, MarketType.PERP) == 15_000

        # Bybit: 15s (Amendment 1)
        assert get_stale_threshold(VenueId.BYBIT, MarketType.PERP) == 15_000


# =============================================================================
# Symbol Mapping Tests
# =============================================================================

class TestSymbolMapping:
    """Test venue symbol mapping."""

    def test_binance_spot_btc(self):
        """Binance spot BTC should be BTCUSDT."""
        assert get_symbol(VenueId.BINANCE, AssetId.BTC, MarketType.SPOT) == "BTCUSDT"

    def test_coinbase_spot_btc(self):
        """Coinbase spot BTC should be BTC-USD."""
        assert get_symbol(VenueId.COINBASE, AssetId.BTC, MarketType.SPOT) == "BTC-USD"

    def test_kraken_spot_btc(self):
        """Kraken spot BTC should be XBT/USD (not BTC)."""
        assert get_symbol(VenueId.KRAKEN, AssetId.BTC, MarketType.SPOT) == "XBT/USD"

    def test_okx_perp_btc(self):
        """OKX perp BTC should be BTC-USDT-SWAP."""
        assert get_symbol(VenueId.OKX, AssetId.BTC, MarketType.PERP) == "BTC-USDT-SWAP"

    def test_coinbase_no_perp(self):
        """Coinbase should not support perp."""
        assert get_symbol(VenueId.COINBASE, AssetId.BTC, MarketType.PERP) is None

    def test_bybit_no_spot(self):
        """Bybit should not support spot in v0."""
        assert get_symbol(VenueId.BYBIT, AssetId.BTC, MarketType.SPOT) is None

    def test_stream_name_binance(self):
        """Binance stream names should be lowercase."""
        assert get_stream_name(VenueId.BINANCE, AssetId.BTC, MarketType.SPOT) == "btcusdt"

    def test_venue_supports_market(self):
        """Test venue market support checks."""
        assert venue_supports_market(VenueId.BINANCE, MarketType.SPOT) is True
        assert venue_supports_market(VenueId.BINANCE, MarketType.PERP) is True
        assert venue_supports_market(VenueId.COINBASE, MarketType.PERP) is False
        assert venue_supports_market(VenueId.BYBIT, MarketType.SPOT) is False

    def test_subscription_message_binance(self):
        """Test Binance subscription message format."""
        msg = build_subscription_message(
            VenueId.BINANCE, AssetId.BTC, MarketType.SPOT, ["trades"]
        )
        assert msg is not None
        assert msg["method"] == "SUBSCRIBE"
        assert "btcusdt@aggTrade" in msg["params"]

    def test_subscription_message_okx(self):
        """Test OKX subscription message format."""
        msg = build_subscription_message(
            VenueId.OKX, AssetId.BTC, MarketType.PERP, ["trades"]
        )
        assert msg is not None
        assert msg["op"] == "subscribe"
        assert msg["args"][0]["instId"] == "BTC-USDT-SWAP"

    def test_parse_venue_symbol(self):
        """Test reverse symbol parsing."""
        result = parse_venue_symbol(VenueId.BINANCE, "BTCUSDT")
        assert result is not None
        assert result["asset"] == AssetId.BTC

        result = parse_venue_symbol(VenueId.KRAKEN, "XBT/USD")
        assert result is not None
        assert result["asset"] == AssetId.BTC


# =============================================================================
# Bar Builder Tests
# =============================================================================

class TestBarBuilder:
    """Test bar building from trades."""

    def test_floor_to_minute(self):
        """Test timestamp flooring to minute boundary."""
        # 2024-01-01 00:00:00.000 UTC
        assert floor_to_minute(1704067200000) == 1704067200
        # 2024-01-01 00:00:30.000 UTC (mid-minute)
        assert floor_to_minute(1704067230000) == 1704067200
        # 2024-01-01 00:00:59.999 UTC (end of minute)
        assert floor_to_minute(1704067259999) == 1704067200
        # 2024-01-01 00:01:00.000 UTC (next minute)
        assert floor_to_minute(1704067260000) == 1704067260

    def test_bar_builder_single_trade(self):
        """Test bar builder with a single trade."""
        builder = BarBuilder(
            venue=VenueId.BINANCE,
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        trade = Trade(
            timestamp=1704067200000,
            local_timestamp=1704067200010,
            price=94250.50,
            quantity=0.5,
            is_buyer_maker=True,
            venue=VenueId.BINANCE,
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        result = builder.add_trade(trade)
        assert result is None  # No completed bar yet

        partial = builder.get_partial_bar()
        assert partial is not None
        assert partial.open == 94250.50
        assert partial.close == 94250.50
        assert partial.is_partial is True

    def test_bar_builder_ohlc(self):
        """Test OHLC calculation from multiple trades."""
        builder = BarBuilder(
            venue=VenueId.BINANCE,
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        # Add trades: first is open, then high, then low, then close
        trades = [
            (1704067200000, 94250.0, 0.1),  # Open
            (1704067210000, 94300.0, 0.2),  # High
            (1704067220000, 94200.0, 0.3),  # Low
            (1704067230000, 94275.0, 0.4),  # Close
        ]

        for ts, price, qty in trades:
            builder.add_trade(Trade(
                timestamp=ts,
                local_timestamp=ts + 10,
                price=price,
                quantity=qty,
                is_buyer_maker=True,
                venue=VenueId.BINANCE,
                asset=AssetId.BTC,
                market_type=MarketType.SPOT,
            ))

        partial = builder.get_partial_bar()
        assert partial.open == 94250.0
        assert partial.high == 94300.0
        assert partial.low == 94200.0
        assert partial.close == 94275.0
        assert partial.volume == 1.0

    def test_bar_builder_bar_completion(self):
        """Test bar completion on minute boundary."""
        completed_bars = []

        builder = BarBuilder(
            venue=VenueId.BINANCE,
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
            on_bar_complete=lambda bar: completed_bars.append(bar),
        )

        # Trade in minute 1
        builder.add_trade(Trade(
            timestamp=1704067200000,  # 00:00:00
            local_timestamp=1704067200010,
            price=94250.0,
            quantity=0.5,
            is_buyer_maker=True,
            venue=VenueId.BINANCE,
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        ))

        # Trade in minute 2 - should complete minute 1
        result = builder.add_trade(Trade(
            timestamp=1704067260000,  # 00:01:00
            local_timestamp=1704067260010,
            price=94300.0,
            quantity=0.3,
            is_buyer_maker=True,
            venue=VenueId.BINANCE,
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        ))

        assert result is not None
        assert result.time == 1704067200
        assert result.is_partial is False
        assert len(completed_bars) == 1
        assert builder.bar_count == 1


# =============================================================================
# Outlier Filter Tests
# =============================================================================

class TestOutlierFilter:
    """Test outlier detection and composite calculation."""

    def test_calculate_median_odd(self):
        """Test median calculation with odd number of values."""
        assert calculate_median([1, 2, 3]) == 2
        assert calculate_median([94000, 94100, 94200]) == 94100

    def test_calculate_median_even(self):
        """Test median calculation with even number of values."""
        assert calculate_median([1, 2, 3, 4]) == 2.5
        assert calculate_median([94000, 94100, 94200, 94300]) == 94150

    def test_calculate_median_empty(self):
        """Test median with empty list."""
        assert calculate_median([]) is None

    def test_calculate_deviation_bps(self):
        """Test deviation calculation in basis points."""
        # 1% deviation = 100 bps
        assert calculate_deviation_bps(101, 100) == 100
        assert calculate_deviation_bps(99, 100) == 100

        # 0.5% deviation = 50 bps
        deviation = calculate_deviation_bps(100.5, 100)
        assert abs(deviation - 50) < 0.01

    def test_filter_outliers_all_connected(self):
        """Test composite with all venues connected and valid."""
        inputs = [
            VenuePriceInput(VenueId.BINANCE, 94100.0, 1000, True),
            VenuePriceInput(VenueId.COINBASE, 94100.0, 1000, True),
            VenuePriceInput(VenueId.OKX, 94100.0, 1000, True),
        ]

        result = filter_outliers(inputs, 2000, MarketType.SPOT)

        assert result.price == 94100.0
        assert result.included_count == 3
        assert result.is_gap is False
        assert result.degraded is False

    def test_filter_outliers_one_stale(self):
        """Test composite with one stale venue."""
        # Binance stale threshold is 10000ms
        inputs = [
            VenuePriceInput(VenueId.BINANCE, 94100.0, 0, True),  # 15000ms old = stale
            VenuePriceInput(VenueId.COINBASE, 94100.0, 14000, True),  # Fresh
            VenuePriceInput(VenueId.OKX, 94100.0, 14000, True),  # Fresh
        ]

        result = filter_outliers(inputs, 15000, MarketType.SPOT)

        assert result.included_count == 2
        assert result.degraded is True  # Below preferred quorum of 3

        # Check Binance was excluded as stale
        binance_contrib = next(c for c in result.venues if c.venue == VenueId.BINANCE)
        assert binance_contrib.exclude_reason == ExcludeReason.STALE

    def test_filter_outliers_one_disconnected(self):
        """Test composite with one disconnected venue."""
        inputs = [
            VenuePriceInput(VenueId.BINANCE, None, None, False),  # Disconnected
            VenuePriceInput(VenueId.COINBASE, 94100.0, 1000, True),
            VenuePriceInput(VenueId.OKX, 94100.0, 1000, True),
        ]

        result = filter_outliers(inputs, 2000, MarketType.SPOT)

        assert result.included_count == 2
        assert result.degraded is True

        binance_contrib = next(c for c in result.venues if c.venue == VenueId.BINANCE)
        assert binance_contrib.exclude_reason == ExcludeReason.DISCONNECTED

    def test_filter_outliers_outlier_excluded(self):
        """Test that outlier is excluded (>100bps from median)."""
        # Median of 94100, 94100 is 94100
        # 95100 is ~1.06% away = 106 bps > 100 bps threshold
        inputs = [
            VenuePriceInput(VenueId.BINANCE, 94100.0, 1000, True),
            VenuePriceInput(VenueId.COINBASE, 94100.0, 1000, True),
            VenuePriceInput(VenueId.OKX, 95100.0, 1000, True),  # Outlier
        ]

        result = filter_outliers(inputs, 2000, MarketType.SPOT)

        assert result.included_count == 2

        okx_contrib = next(c for c in result.venues if c.venue == VenueId.OKX)
        assert okx_contrib.exclude_reason == ExcludeReason.OUTLIER
        assert okx_contrib.deviation_bps > 100

    def test_filter_outliers_gap_below_quorum(self):
        """Test gap when below min quorum."""
        inputs = [
            VenuePriceInput(VenueId.BINANCE, None, None, False),  # Disconnected
            VenuePriceInput(VenueId.COINBASE, None, None, False),  # Disconnected
            VenuePriceInput(VenueId.OKX, 94100.0, 1000, True),  # Only one
        ]

        result = filter_outliers(inputs, 2000, MarketType.SPOT)

        assert result.included_count == 1
        assert result.is_gap is True  # Below min quorum of 2
        assert result.price is None  # No price when gap

    def test_filter_exclusion_order(self):
        """Test exclusion order: DISCONNECTED → STALE → OUTLIER."""
        # This is a critical invariant from the frozen contract
        # Stale venues must be excluded BEFORE outlier calculation

        # Scenario: Binance has stale data that would be an outlier
        # if included in median calculation
        inputs = [
            VenuePriceInput(VenueId.BINANCE, 95100.0, 0, True),  # Stale AND would be outlier
            VenuePriceInput(VenueId.COINBASE, 94100.0, 14000, True),
            VenuePriceInput(VenueId.OKX, 94100.0, 14000, True),
        ]

        result = filter_outliers(inputs, 15000, MarketType.SPOT)

        # Binance should be excluded as STALE, not as OUTLIER
        binance_contrib = next(c for c in result.venues if c.venue == VenueId.BINANCE)
        assert binance_contrib.exclude_reason == ExcludeReason.STALE

        # The median should be calculated from Coinbase + OKX only
        assert result.price == 94100.0


# =============================================================================
# Integration Tests
# =============================================================================

class TestIntegration:
    """Integration tests for core module interactions."""

    def test_bar_builder_to_composite_flow(self):
        """Test full flow from trades to composite bar."""
        # Create bar builders for two venues
        binance_builder = BarBuilder(
            venue=VenueId.BINANCE,
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )
        coinbase_builder = BarBuilder(
            venue=VenueId.COINBASE,
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
        )

        # Add trades
        for builder, price in [(binance_builder, 94100.0), (coinbase_builder, 94100.0)]:
            builder.add_trade(Trade(
                timestamp=1704067200000,
                local_timestamp=1704067200010,
                price=price,
                quantity=0.5,
                is_buyer_maker=True,
                venue=builder.venue,
                asset=AssetId.BTC,
                market_type=MarketType.SPOT,
            ))

        # Get current prices
        binance_price = binance_builder.get_current_price()
        coinbase_price = coinbase_builder.get_current_price()

        # Filter outliers
        inputs = [
            VenuePriceInput(VenueId.BINANCE, binance_price, 1704067200010, True),
            VenuePriceInput(VenueId.COINBASE, coinbase_price, 1704067200010, True),
        ]

        result = filter_outliers(inputs, 1704067200100, MarketType.SPOT)

        assert result.price == 94100.0
        assert result.included_count == 2
