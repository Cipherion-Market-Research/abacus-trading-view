"""
Abacus Indexer Outlier Filter

Median-based outlier detection for composite price calculation.
Implements the exclusion order: DISCONNECTED → STALE → OUTLIER

Per ABACUS_INDEXER_V0_CONTRACT_FREEZE.md:
- Outlier threshold: 100 bps (1.0%) deviation from median
- Stale venues excluded BEFORE outlier filtering
- Outlier values must not pollute the median calculation
"""

import statistics
from dataclasses import dataclass
from typing import Optional

from .constants import (
    OUTLIER_THRESHOLD_BPS,
    OUTLIER_THRESHOLD_DECIMAL,
    get_quorum_config,
    get_stale_threshold,
)
from .types import (
    AssetId,
    CompositeBar,
    CompositePrice,
    DegradedReason,
    ExcludedVenue,
    ExcludeReason,
    MarketType,
    VenueContribution,
    VenueId,
)


@dataclass
class VenuePriceInput:
    """Input for composite calculation: a venue's current price state."""

    venue: VenueId
    price: Optional[float]  # None if disconnected or no data
    last_update_ms: Optional[int]  # None if never received data
    is_connected: bool = True


@dataclass
class CompositeResult:
    """Result of composite price calculation."""

    price: Optional[float]
    venues: list[VenueContribution]
    included_count: int
    total_count: int
    degraded: bool
    degraded_reason: DegradedReason
    is_gap: bool  # True if below min quorum


def calculate_median(prices: list[float]) -> Optional[float]:
    """
    Calculate median of a list of prices.

    Returns None if list is empty.
    Uses statistics.median which handles odd/even counts.
    """
    if not prices:
        return None
    return statistics.median(prices)


def calculate_deviation_bps(price: float, median: float) -> float:
    """
    Calculate deviation from median in basis points.

    Args:
        price: The price to check
        median: The reference median

    Returns:
        Absolute deviation in basis points
    """
    if median == 0:
        return 0.0
    return abs((price - median) / median) * 10000


def filter_outliers(
    inputs: list[VenuePriceInput],
    current_time_ms: int,
    market_type: MarketType,
) -> CompositeResult:
    """
    Filter venue prices and compute composite.

    Implements the exclusion order per frozen contract:
    1. DISCONNECTED - venue not connected
    2. STALE - no update within stale threshold
    3. OUTLIER - price deviates > 100bps from median

    Args:
        inputs: List of venue price inputs
        current_time_ms: Current timestamp for stale detection
        market_type: Market type for stale threshold lookup

    Returns:
        CompositeResult with filtered prices and composite
    """
    quorum = get_quorum_config()
    contributions: list[VenueContribution] = []
    total_count = len(inputs)

    # Phase 1: Filter DISCONNECTED and STALE venues
    # These are excluded BEFORE outlier calculation per frozen contract
    candidates: list[tuple[VenueId, float]] = []

    for inp in inputs:
        contribution = VenueContribution(
            venue=inp.venue,
            price=inp.price,
            included=False,
        )

        # Check disconnected
        if not inp.is_connected:
            contribution.exclude_reason = ExcludeReason.DISCONNECTED
            contributions.append(contribution)
            continue

        # Check no data
        if inp.price is None or inp.last_update_ms is None:
            contribution.exclude_reason = ExcludeReason.NO_DATA
            contributions.append(contribution)
            continue

        # Check stale
        stale_threshold = get_stale_threshold(inp.venue, market_type)
        age_ms = current_time_ms - inp.last_update_ms
        if age_ms > stale_threshold:
            contribution.exclude_reason = ExcludeReason.STALE
            contributions.append(contribution)
            continue

        # Venue passes initial filters - add to candidates for outlier check
        candidates.append((inp.venue, inp.price))
        contributions.append(contribution)

    # Phase 2: Calculate median from non-stale, connected venues
    # This is the "clean" median that outliers deviate from
    candidate_prices = [p for _, p in candidates]
    median = calculate_median(candidate_prices)

    # Phase 3: Filter outliers
    included_prices: list[float] = []
    included_venues: list[VenueId] = []

    for venue, price in candidates:
        # Find the contribution to update
        contrib = next(c for c in contributions if c.venue == venue)

        if median is None:
            # Can't determine outliers without a median
            # Include all candidates
            contrib.included = True
            contrib.deviation_bps = 0.0
            included_prices.append(price)
            included_venues.append(venue)
            continue

        deviation = calculate_deviation_bps(price, median)
        contrib.deviation_bps = deviation

        if deviation > OUTLIER_THRESHOLD_BPS:
            contrib.exclude_reason = ExcludeReason.OUTLIER
            contrib.included = False
        else:
            contrib.included = True
            included_prices.append(price)
            included_venues.append(venue)

    # Phase 4: Calculate final composite from included venues
    included_count = len(included_prices)
    final_price = calculate_median(included_prices)

    # Determine degraded status
    is_gap = included_count < quorum.min_quorum
    degraded = included_count < quorum.preferred_quorum or is_gap

    # Determine degraded reason based on most severe exclusion reason present
    # Priority order: DISCONNECTED > NO_DATA > STALE > OUTLIER
    def _derive_degraded_reason() -> DegradedReason:
        if not degraded:
            return DegradedReason.NONE

        has_disconnected = any(c.exclude_reason == ExcludeReason.DISCONNECTED for c in contributions)
        has_no_data = any(c.exclude_reason == ExcludeReason.NO_DATA for c in contributions)
        has_stale = any(c.exclude_reason == ExcludeReason.STALE for c in contributions)
        has_outlier = any(c.exclude_reason == ExcludeReason.OUTLIER for c in contributions)

        if is_gap:
            # Gap: derive reason from most severe exclusion
            if has_disconnected:
                return DegradedReason.VENUE_DISCONNECTED
            elif has_no_data or has_stale:
                return DegradedReason.VENUE_STALE
            elif has_outlier:
                return DegradedReason.VENUE_OUTLIER
            elif included_count == 1:
                return DegradedReason.SINGLE_SOURCE
            else:
                return DegradedReason.BELOW_PREFERRED_QUORUM
        else:
            # Degraded but not gap: at least minQuorum met
            if has_disconnected:
                return DegradedReason.VENUE_DISCONNECTED
            elif has_stale:
                return DegradedReason.VENUE_STALE
            elif has_outlier:
                return DegradedReason.VENUE_OUTLIER
            else:
                return DegradedReason.BELOW_PREFERRED_QUORUM

    degraded_reason = _derive_degraded_reason()

    return CompositeResult(
        price=final_price if not is_gap else None,
        venues=contributions,
        included_count=included_count,
        total_count=total_count,
        degraded=degraded,
        degraded_reason=degraded_reason,
        is_gap=is_gap,
    )


def build_composite_bar(
    time: int,
    open_result: CompositeResult,
    high_result: CompositeResult,
    low_result: CompositeResult,
    close_result: CompositeResult,
    total_volume: float,
    asset: AssetId,
    market_type: MarketType,
    buy_volume: float = 0.0,
    sell_volume: float = 0.0,
    buy_count: int = 0,
    sell_count: int = 0,
) -> CompositeBar:
    """
    Build a CompositeBar from OHLC composite results.

    Args:
        time: Bar start time (unix seconds)
        open_result: Composite result for open price
        high_result: Composite result for high price
        low_result: Composite result for low price
        close_result: Composite result for close price
        total_volume: Aggregated volume across venues
        asset: Asset
        market_type: Market type
        buy_volume: Sum of taker buy volume from included venues
        sell_volume: Sum of taker sell volume from included venues
        buy_count: Sum of taker buy count from included venues
        sell_count: Sum of taker sell count from included venues

    Returns:
        CompositeBar with gap/degraded flags set correctly

    FROZEN CONTRACT DECISION:
        The `included_venues` and `excluded_venues` fields are derived from
        the CLOSE composite result only. This is intentional:
        - Close is the most representative price point for the bar
        - Venue sets could vary across O/H/L/C if connectivity changes intra-minute
        - Using close keeps the logic simple and deterministic
        - Alternative (union across OHLC) would be noisier and harder to interpret
    """
    # Bar is a gap if close is a gap (most representative)
    is_gap = close_result.is_gap

    # FROZEN: Use close result for venue inclusion/exclusion lists
    excluded_venues = [
        ExcludedVenue(venue=c.venue.value, reason=c.exclude_reason)
        for c in close_result.venues
        if c.exclude_reason is not None
    ]

    # Collect included venues
    included_venues = [
        c.venue.value for c in close_result.venues if c.included
    ]

    # Degraded if any OHLC was degraded
    degraded = (
        open_result.degraded
        or high_result.degraded
        or low_result.degraded
        or close_result.degraded
    )

    return CompositeBar(
        time=time,
        open=open_result.price if not is_gap else None,
        high=high_result.price if not is_gap else None,
        low=low_result.price if not is_gap else None,
        close=close_result.price if not is_gap else None,
        volume=total_volume if not is_gap else 0.0,
        buy_volume=buy_volume if not is_gap else 0.0,
        sell_volume=sell_volume if not is_gap else 0.0,
        buy_count=buy_count if not is_gap else 0,
        sell_count=sell_count if not is_gap else 0,
        degraded=degraded,
        is_gap=is_gap,
        is_backfilled=False,
        included_venues=included_venues,
        excluded_venues=excluded_venues,
        asset=asset,
        market_type=market_type,
    )


def build_composite_price(
    result: CompositeResult,
    time: int,
    asset: AssetId,
    market_type: MarketType,
) -> CompositePrice:
    """
    Build a CompositePrice from a composite result.

    Args:
        result: Result from filter_outliers
        time: Current time (unix seconds)
        asset: Asset
        market_type: Market type

    Returns:
        CompositePrice for API response
    """
    return CompositePrice(
        price=result.price,
        time=time,
        venues=result.venues,
        included_count=result.included_count,
        total_venues=result.total_count,
        degraded=result.degraded,
        degraded_reason=result.degraded_reason,
        asset=asset,
        market_type=market_type,
    )
