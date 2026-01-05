"""
Abacus Indexer Bar Builder

Constructs 1-minute OHLCV bars from incoming trades.
Handles bar accumulation, completion detection, and history management.
"""

from collections import deque
from dataclasses import dataclass, field
from typing import Callable, Optional

from .constants import BAR_INTERVAL_SECONDS, MAX_BARS_PER_VENUE, MAX_TRADE_BUFFER_SIZE
from .types import AssetId, Bar, MarketType, TakerSide, Trade, VenueId


def floor_to_minute(timestamp_ms: int) -> int:
    """Floor a timestamp (ms) to the start of its minute (unix seconds)."""
    return (timestamp_ms // 1000 // BAR_INTERVAL_SECONDS) * BAR_INTERVAL_SECONDS


@dataclass
class BarAccumulator:
    """
    Accumulates trades into a forming bar.

    This is a mutable state object that collects trades for the current minute
    and produces a completed Bar when the minute boundary is crossed.

    Buy/Sell volume separation follows the normalized taker-side semantics:
    - buy_volume/buy_count: Taker-initiated buys (aggressive buys)
    - sell_volume/sell_count: Taker-initiated sells (aggressive sells)
    """

    bar_time: int  # Unix seconds (start of bar)
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: Optional[float] = None
    volume: float = 0.0
    trade_count: int = 0

    # Buy/Sell volume separation (taker-initiated)
    buy_volume: float = 0.0
    sell_volume: float = 0.0
    buy_count: int = 0
    sell_count: int = 0

    venue: Optional[VenueId] = None
    asset: Optional[AssetId] = None
    market_type: Optional[MarketType] = None

    def add_trade(self, trade: Trade) -> None:
        """
        Add a trade to the accumulator.

        Assumes trade belongs to this bar's minute (caller should verify).
        Uses trade.taker_side for normalized buy/sell classification.
        """
        price = trade.price
        quantity = trade.quantity

        # First trade sets all values
        if self.open is None:
            self.open = price
            self.high = price
            self.low = price
            self.close = price
            self.venue = trade.venue
            self.asset = trade.asset
            self.market_type = trade.market_type
        else:
            # Update OHLC
            if price > self.high:  # type: ignore
                self.high = price
            if price < self.low:  # type: ignore
                self.low = price
            self.close = price

        # Accumulate total volume and count
        self.volume += quantity
        self.trade_count += 1

        # Accumulate buy/sell volume using normalized taker_side
        if trade.taker_side == TakerSide.BUY:
            self.buy_volume += quantity
            self.buy_count += 1
        else:
            self.sell_volume += quantity
            self.sell_count += 1

    def to_bar(self, is_partial: bool = False) -> Optional[Bar]:
        """
        Convert accumulator to a Bar.

        Returns None if no trades have been accumulated.
        """
        if self.open is None or self.venue is None or self.asset is None or self.market_type is None:
            return None

        return Bar(
            time=self.bar_time,
            open=self.open,
            high=self.high,  # type: ignore
            low=self.low,  # type: ignore
            close=self.close,  # type: ignore
            volume=self.volume,
            trade_count=self.trade_count,
            buy_volume=self.buy_volume,
            sell_volume=self.sell_volume,
            buy_count=self.buy_count,
            sell_count=self.sell_count,
            venue=self.venue,
            asset=self.asset,
            market_type=self.market_type,
            is_partial=is_partial,
        )

    def reset(self, new_bar_time: int) -> None:
        """Reset accumulator for a new bar."""
        self.bar_time = new_bar_time
        self.open = None
        self.high = None
        self.low = None
        self.close = None
        self.volume = 0.0
        self.trade_count = 0
        self.buy_volume = 0.0
        self.sell_volume = 0.0
        self.buy_count = 0
        self.sell_count = 0


@dataclass
class BarBuilder:
    """
    Builds 1-minute OHLCV bars from a stream of trades.

    Features:
    - Automatic bar completion on minute boundary crossing
    - Partial bar support (current forming bar)
    - History management with ring buffer (MAX_BARS_PER_VENUE)
    - Callback on bar completion

    Usage:
        builder = BarBuilder(
            venue=VenueId.BINANCE,
            asset=AssetId.BTC,
            market_type=MarketType.SPOT,
            on_bar_complete=handle_completed_bar,
        )
        builder.add_trade(trade)
        partial_bar = builder.get_partial_bar()
        history = builder.get_bars()
    """

    venue: VenueId
    asset: AssetId
    market_type: MarketType
    on_bar_complete: Optional[Callable[[Bar], None]] = None

    # Internal state
    _accumulator: Optional[BarAccumulator] = field(default=None, init=False)
    _completed_bars: deque[Bar] = field(default_factory=lambda: deque(maxlen=MAX_BARS_PER_VENUE), init=False)
    _trade_count: int = field(default=0, init=False)
    _last_trade_time: Optional[int] = field(default=None, init=False)

    def add_trade(self, trade: Trade) -> Optional[Bar]:
        """
        Add a trade to the builder.

        Args:
            trade: Incoming trade

        Returns:
            Completed bar if a bar was closed, None otherwise
        """
        trade_bar_time = floor_to_minute(trade.timestamp)

        # Initialize accumulator if needed
        if self._accumulator is None:
            self._accumulator = BarAccumulator(bar_time=trade_bar_time)

        completed_bar: Optional[Bar] = None

        # Check if trade belongs to a new bar - MUST happen before trade count check
        # so that _trade_count gets reset even if we were at the limit
        if trade_bar_time > self._accumulator.bar_time:
            # Complete the current bar
            completed_bar = self._accumulator.to_bar(is_partial=False)
            if completed_bar:
                self._completed_bars.append(completed_bar)
                if self.on_bar_complete:
                    self.on_bar_complete(completed_bar)

            # Fill any gap bars (no trades for entire minutes)
            # We don't create synthetic bars - gaps are handled at composite level
            self._accumulator.reset(trade_bar_time)
            self._trade_count = 0

        # Safety check: limit trades per minute (AFTER bar time check to ensure reset)
        if self._trade_count >= MAX_TRADE_BUFFER_SIZE:
            return completed_bar  # Return any completed bar but don't process this trade

        # Add trade to current accumulator
        self._accumulator.add_trade(trade)
        self._trade_count += 1
        self._last_trade_time = trade.timestamp

        return completed_bar

    def get_partial_bar(self) -> Optional[Bar]:
        """
        Get the current forming bar (partial).

        Returns None if no trades received yet.
        """
        if self._accumulator is None:
            return None
        return self._accumulator.to_bar(is_partial=True)

    def get_bars(self, limit: Optional[int] = None) -> list[Bar]:
        """
        Get completed bars (oldest first).

        Args:
            limit: Optional limit on number of bars to return

        Returns:
            List of completed bars
        """
        bars = list(self._completed_bars)
        if limit:
            return bars[-limit:]
        return bars

    def get_latest_bar(self) -> Optional[Bar]:
        """Get the most recently completed bar."""
        if not self._completed_bars:
            return None
        return self._completed_bars[-1]

    def get_current_price(self) -> Optional[float]:
        """Get the current price (close of partial bar)."""
        if self._accumulator is None:
            return None
        return self._accumulator.close

    def get_last_trade_time(self) -> Optional[int]:
        """Get the timestamp of the last trade received (ms)."""
        return self._last_trade_time

    @property
    def bar_count(self) -> int:
        """Number of completed bars in history."""
        return len(self._completed_bars)


def merge_bars(bars: list[Bar]) -> Optional[Bar]:
    """
    Merge multiple bars into a single bar.

    Used for combining bars from different sources or
    creating aggregated timeframes.

    Args:
        bars: List of bars to merge (must be from same time, venue, asset)

    Returns:
        Merged bar or None if no bars provided
    """
    if not bars:
        return None

    # Use first bar as template
    first = bars[0]

    open_price = first.open
    high_price = first.high
    low_price = first.low
    close_price = first.close
    total_volume = first.volume
    total_trades = first.trade_count
    total_buy_volume = first.buy_volume
    total_sell_volume = first.sell_volume
    total_buy_count = first.buy_count
    total_sell_count = first.sell_count

    for bar in bars[1:]:
        if bar.high > high_price:
            high_price = bar.high
        if bar.low < low_price:
            low_price = bar.low
        close_price = bar.close
        total_volume += bar.volume
        total_trades += bar.trade_count
        total_buy_volume += bar.buy_volume
        total_sell_volume += bar.sell_volume
        total_buy_count += bar.buy_count
        total_sell_count += bar.sell_count

    return Bar(
        time=first.time,
        open=open_price,
        high=high_price,
        low=low_price,
        close=close_price,
        volume=total_volume,
        trade_count=total_trades,
        buy_volume=total_buy_volume,
        sell_volume=total_sell_volume,
        buy_count=total_buy_count,
        sell_count=total_sell_count,
        venue=first.venue,
        asset=first.asset,
        market_type=first.market_type,
        is_partial=any(b.is_partial for b in bars),
    )
