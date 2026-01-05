"""
Composite Bar Repository

CRUD operations for composite bars in TimescaleDB.

Table schema (expected to exist):
    CREATE TABLE composite_bars (
        time        TIMESTAMPTZ NOT NULL,
        asset       VARCHAR(10) NOT NULL,
        market_type VARCHAR(10) NOT NULL,
        open        DOUBLE PRECISION,
        high        DOUBLE PRECISION,
        low         DOUBLE PRECISION,
        close       DOUBLE PRECISION,
        volume      DOUBLE PRECISION NOT NULL DEFAULT 0,
        degraded    BOOLEAN NOT NULL DEFAULT FALSE,
        is_gap      BOOLEAN NOT NULL DEFAULT FALSE,
        is_backfilled BOOLEAN NOT NULL DEFAULT FALSE,
        included_venues TEXT[] NOT NULL DEFAULT '{}',
        excluded_venues JSONB NOT NULL DEFAULT '[]',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (time, asset, market_type)
    );

    -- TimescaleDB hypertable
    SELECT create_hypertable('composite_bars', 'time', if_not_exists => TRUE);

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_composite_bars_asset_market
        ON composite_bars (asset, market_type, time DESC);
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from ..core.types import AssetId, Bar, CompositeBar, ExcludedVenue, ExcludeReason, MarketType, VenueId
from .pool import DatabasePool


logger = logging.getLogger(__name__)


class VenueBarRepository:
    """
    Repository for per-venue bar persistence.

    Stores individual venue OHLCV bars for forecasting traceability.
    Mirrors MultiCEXResolver's per-exchange data capability.

    Usage:
        repo = VenueBarRepository(pool)
        await repo.insert(bar, included_in_composite=True)
        bars = await repo.get_range("BTC", "spot", "binance", start, end)
    """

    def __init__(self, pool: DatabasePool):
        self.pool = pool

    async def insert(
        self,
        bar: Bar,
        included_in_composite: bool = True,
        exclude_reason: Optional[str] = None
    ) -> bool:
        """
        Insert a venue bar.

        Uses UPSERT to handle duplicates gracefully.

        Args:
            bar: Bar to insert
            included_in_composite: Whether this bar was included in composite calculation
            exclude_reason: Reason for exclusion (if not included)

        Returns:
            True if new row inserted, False if updated
        """
        try:
            timestamp = datetime.fromtimestamp(bar.time, tz=timezone.utc)

            query = """
                INSERT INTO venue_bars (
                    time, asset, market_type, venue,
                    open, high, low, close, volume, trade_count,
                    buy_volume, sell_volume, buy_count, sell_count,
                    included_in_composite, exclude_reason
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                ON CONFLICT (time, asset, market_type, venue)
                DO UPDATE SET
                    open = EXCLUDED.open,
                    high = EXCLUDED.high,
                    low = EXCLUDED.low,
                    close = EXCLUDED.close,
                    volume = EXCLUDED.volume,
                    trade_count = EXCLUDED.trade_count,
                    buy_volume = EXCLUDED.buy_volume,
                    sell_volume = EXCLUDED.sell_volume,
                    buy_count = EXCLUDED.buy_count,
                    sell_count = EXCLUDED.sell_count,
                    included_in_composite = EXCLUDED.included_in_composite,
                    exclude_reason = EXCLUDED.exclude_reason
                RETURNING (xmax = 0) AS inserted
            """

            result = await self.pool.fetchval(
                query,
                timestamp,
                bar.asset.value if bar.asset else "BTC",
                bar.market_type.value if bar.market_type else "spot",
                bar.venue.value if bar.venue else "binance",
                bar.open,
                bar.high,
                bar.low,
                bar.close,
                bar.volume,
                bar.trade_count,
                bar.buy_volume,
                bar.sell_volume,
                bar.buy_count,
                bar.sell_count,
                included_in_composite,
                exclude_reason,
            )

            return bool(result)

        except Exception as e:
            logger.error(f"Failed to insert venue bar: {e}")
            raise

    async def insert_batch(
        self,
        bars: list[tuple[Bar, bool, Optional[str]]]
    ) -> int:
        """
        Insert multiple venue bars in a single transaction.

        Args:
            bars: List of (Bar, included_in_composite, exclude_reason) tuples

        Returns:
            Number of rows inserted/updated
        """
        if not bars:
            return 0

        try:
            async with self.pool.acquire() as conn:
                async with conn.transaction():
                    count = 0
                    for bar, included, exclude_reason in bars:
                        timestamp = datetime.fromtimestamp(bar.time, tz=timezone.utc)

                        await conn.execute(
                            """
                            INSERT INTO venue_bars (
                                time, asset, market_type, venue,
                                open, high, low, close, volume, trade_count,
                                buy_volume, sell_volume, buy_count, sell_count,
                                included_in_composite, exclude_reason
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                            ON CONFLICT (time, asset, market_type, venue) DO UPDATE SET
                                open = EXCLUDED.open,
                                high = EXCLUDED.high,
                                low = EXCLUDED.low,
                                close = EXCLUDED.close,
                                volume = EXCLUDED.volume,
                                trade_count = EXCLUDED.trade_count,
                                buy_volume = EXCLUDED.buy_volume,
                                sell_volume = EXCLUDED.sell_volume,
                                buy_count = EXCLUDED.buy_count,
                                sell_count = EXCLUDED.sell_count,
                                included_in_composite = EXCLUDED.included_in_composite,
                                exclude_reason = EXCLUDED.exclude_reason
                            """,
                            timestamp,
                            bar.asset.value if bar.asset else "BTC",
                            bar.market_type.value if bar.market_type else "spot",
                            bar.venue.value if bar.venue else "binance",
                            bar.open,
                            bar.high,
                            bar.low,
                            bar.close,
                            bar.volume,
                            bar.trade_count,
                            bar.buy_volume,
                            bar.sell_volume,
                            bar.buy_count,
                            bar.sell_count,
                            included,
                            exclude_reason,
                        )
                        count += 1

            logger.debug(f"Batch inserted {count} venue bars")
            return count

        except Exception as e:
            logger.error(f"Failed to batch insert venue bars: {e}")
            raise

    async def get_range(
        self,
        asset: str,
        market_type: str,
        venue: str,
        start_time: int,
        end_time: int,
        limit: int = 1440,
    ) -> list[Bar]:
        """
        Get venue bars in a time range.

        Args:
            asset: Asset ID (BTC, ETH)
            market_type: Market type (spot, perp)
            venue: Venue ID (binance, coinbase, etc.)
            start_time: Start time (unix seconds)
            end_time: End time (unix seconds)
            limit: Maximum bars to return

        Returns:
            List of Bar objects, ordered by time ascending
        """
        try:
            start_ts = datetime.fromtimestamp(start_time, tz=timezone.utc)
            end_ts = datetime.fromtimestamp(end_time, tz=timezone.utc)

            query = """
                SELECT
                    EXTRACT(EPOCH FROM time)::BIGINT as time,
                    asset, market_type, venue,
                    open, high, low, close, volume, trade_count,
                    buy_volume, sell_volume, buy_count, sell_count,
                    included_in_composite, exclude_reason
                FROM venue_bars
                WHERE asset = $1
                  AND market_type = $2
                  AND venue = $3
                  AND time >= $4
                  AND time < $5
                ORDER BY time ASC
                LIMIT $6
            """

            rows = await self.pool.fetch(
                query,
                asset.upper(),
                market_type.lower(),
                venue.lower(),
                start_ts,
                end_ts,
                limit,
            )

            return [self._row_to_bar(row) for row in rows]

        except Exception as e:
            logger.error(f"Failed to get venue bar range: {e}")
            raise

    async def get_all_venues_at_time(
        self,
        asset: str,
        market_type: str,
        bar_time: int,
    ) -> list[dict]:
        """
        Get all venue bars at a specific timestamp for composite validation.

        Args:
            asset: Asset ID
            market_type: Market type
            bar_time: Bar start time (unix seconds)

        Returns:
            List of dicts with venue bar data and inclusion status
        """
        try:
            timestamp = datetime.fromtimestamp(bar_time, tz=timezone.utc)

            query = """
                SELECT
                    venue,
                    open, high, low, close, volume, trade_count,
                    buy_volume, sell_volume, buy_count, sell_count,
                    included_in_composite, exclude_reason
                FROM venue_bars
                WHERE asset = $1
                  AND market_type = $2
                  AND time = $3
                ORDER BY venue
            """

            rows = await self.pool.fetch(
                query,
                asset.upper(),
                market_type.lower(),
                timestamp,
            )

            return [
                {
                    "venue": row["venue"],
                    "open": row["open"],
                    "high": row["high"],
                    "low": row["low"],
                    "close": row["close"],
                    "volume": row["volume"],
                    "trade_count": row["trade_count"],
                    "buy_volume": row["buy_volume"],
                    "sell_volume": row["sell_volume"],
                    "buy_count": row["buy_count"],
                    "sell_count": row["sell_count"],
                    "included_in_composite": row["included_in_composite"],
                    "exclude_reason": row["exclude_reason"],
                }
                for row in rows
            ]

        except Exception as e:
            logger.error(f"Failed to get venue bars at time: {e}")
            raise

    async def enforce_retention(self, retention_days: int) -> int:
        """Delete venue bars older than retention period."""
        if retention_days <= 0:
            return 0

        try:
            query = """
                DELETE FROM venue_bars
                WHERE time < NOW() - INTERVAL '1 day' * $1
            """

            result = await self.pool.execute(query, retention_days)

            deleted = 0
            if result and result.startswith("DELETE"):
                try:
                    deleted = int(result.split()[-1])
                except (ValueError, IndexError):
                    pass

            if deleted > 0:
                logger.info(f"Venue bars retention: deleted {deleted} rows older than {retention_days} days")

            return deleted

        except Exception as e:
            logger.error(f"Failed to enforce venue bars retention: {e}")
            raise

    def _row_to_bar(self, row) -> Bar:
        """Convert database row to Bar."""
        return Bar(
            time=row["time"],
            open=row["open"],
            high=row["high"],
            low=row["low"],
            close=row["close"],
            volume=row["volume"],
            trade_count=row["trade_count"],
            buy_volume=row.get("buy_volume", 0.0),
            sell_volume=row.get("sell_volume", 0.0),
            buy_count=row.get("buy_count", 0),
            sell_count=row.get("sell_count", 0),
            venue=VenueId(row["venue"]) if row["venue"] in [v.value for v in VenueId] else VenueId.BINANCE,
            asset=AssetId(row["asset"]) if row["asset"] in [a.value for a in AssetId] else AssetId.BTC,
            market_type=MarketType(row["market_type"]) if row["market_type"] in [m.value for m in MarketType] else MarketType.SPOT,
            is_partial=False,
            included_in_composite=row.get("included_in_composite", True),
            exclude_reason=row.get("exclude_reason"),
        )


class CompositeBarRepository:
    """
    Repository for composite bar persistence.

    Provides CRUD operations for composite bars in TimescaleDB.
    Handles serialization between Python types and database columns.

    Usage:
        repo = CompositeBarRepository(pool)
        await repo.insert(composite_bar)
        bars = await repo.get_range("BTC", "spot", start, end)
    """

    def __init__(self, pool: DatabasePool):
        self.pool = pool

    async def insert(self, bar: CompositeBar) -> bool:
        """
        Insert a composite bar.

        Uses UPSERT to handle duplicates gracefully.
        Returns True if inserted, False if updated existing.

        Args:
            bar: CompositeBar to insert

        Returns:
            True if new row inserted, False if updated
        """
        try:
            # Convert time to timestamp
            timestamp = datetime.fromtimestamp(bar.time, tz=timezone.utc)

            # Serialize excluded venues to JSON
            excluded_json = json.dumps([
                {"venue": ev.venue, "reason": ev.reason.value}
                for ev in bar.excluded_venues
            ])

            # FROZEN CONTRACT: is_backfilled is monotonic
            # Once true, it stays true. Also, repairing a gap sets it to true.
            query = """
                INSERT INTO composite_bars (
                    time, asset, market_type,
                    open, high, low, close, volume,
                    buy_volume, sell_volume, buy_count, sell_count,
                    degraded, is_gap, is_backfilled,
                    included_venues, excluded_venues
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                ON CONFLICT (time, asset, market_type)
                DO UPDATE SET
                    open = EXCLUDED.open,
                    high = EXCLUDED.high,
                    low = EXCLUDED.low,
                    close = EXCLUDED.close,
                    volume = EXCLUDED.volume,
                    buy_volume = EXCLUDED.buy_volume,
                    sell_volume = EXCLUDED.sell_volume,
                    buy_count = EXCLUDED.buy_count,
                    sell_count = EXCLUDED.sell_count,
                    degraded = EXCLUDED.degraded,
                    is_gap = EXCLUDED.is_gap,
                    is_backfilled = CASE
                        WHEN composite_bars.is_backfilled = TRUE THEN TRUE
                        WHEN composite_bars.is_gap = TRUE AND EXCLUDED.is_gap = FALSE THEN TRUE
                        ELSE EXCLUDED.is_backfilled
                    END,
                    included_venues = EXCLUDED.included_venues,
                    excluded_venues = EXCLUDED.excluded_venues
                RETURNING (xmax = 0) AS inserted
            """

            result = await self.pool.fetchval(
                query,
                timestamp,
                bar.asset.value if bar.asset else "BTC",
                bar.market_type.value if bar.market_type else "spot",
                bar.open,
                bar.high,
                bar.low,
                bar.close,
                bar.volume,
                bar.buy_volume,
                bar.sell_volume,
                bar.buy_count,
                bar.sell_count,
                bar.degraded,
                bar.is_gap,
                bar.is_backfilled,
                bar.included_venues,
                excluded_json,
            )

            if result:
                logger.debug(f"Inserted composite bar: {bar.asset}/{bar.market_type} time={bar.time}")
            else:
                logger.debug(f"Updated composite bar: {bar.asset}/{bar.market_type} time={bar.time}")

            return bool(result)

        except Exception as e:
            logger.error(f"Failed to insert composite bar: {e}")
            raise

    async def insert_batch(self, bars: list[CompositeBar]) -> int:
        """
        Insert multiple composite bars in a single transaction.

        Args:
            bars: List of CompositeBar objects

        Returns:
            Number of rows inserted/updated
        """
        if not bars:
            return 0

        try:
            async with self.pool.acquire() as conn:
                async with conn.transaction():
                    count = 0
                    for bar in bars:
                        timestamp = datetime.fromtimestamp(bar.time, tz=timezone.utc)
                        excluded_json = json.dumps([
                            {"venue": ev.venue, "reason": ev.reason.value}
                            for ev in bar.excluded_venues
                        ])

                        # FROZEN CONTRACT: is_backfilled is monotonic
                        await conn.execute(
                            """
                            INSERT INTO composite_bars (
                                time, asset, market_type,
                                open, high, low, close, volume,
                                buy_volume, sell_volume, buy_count, sell_count,
                                degraded, is_gap, is_backfilled,
                                included_venues, excluded_venues
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                            ON CONFLICT (time, asset, market_type) DO UPDATE SET
                                open = EXCLUDED.open,
                                high = EXCLUDED.high,
                                low = EXCLUDED.low,
                                close = EXCLUDED.close,
                                volume = EXCLUDED.volume,
                                buy_volume = EXCLUDED.buy_volume,
                                sell_volume = EXCLUDED.sell_volume,
                                buy_count = EXCLUDED.buy_count,
                                sell_count = EXCLUDED.sell_count,
                                degraded = EXCLUDED.degraded,
                                is_gap = EXCLUDED.is_gap,
                                is_backfilled = CASE
                                    WHEN composite_bars.is_backfilled = TRUE THEN TRUE
                                    WHEN composite_bars.is_gap = TRUE AND EXCLUDED.is_gap = FALSE THEN TRUE
                                    ELSE EXCLUDED.is_backfilled
                                END,
                                included_venues = EXCLUDED.included_venues,
                                excluded_venues = EXCLUDED.excluded_venues
                            """,
                            timestamp,
                            bar.asset.value if bar.asset else "BTC",
                            bar.market_type.value if bar.market_type else "spot",
                            bar.open,
                            bar.high,
                            bar.low,
                            bar.close,
                            bar.volume,
                            bar.buy_volume,
                            bar.sell_volume,
                            bar.buy_count,
                            bar.sell_count,
                            bar.degraded,
                            bar.is_gap,
                            bar.is_backfilled,
                            bar.included_venues,
                            excluded_json,
                        )
                        count += 1

            logger.info(f"Batch inserted {count} composite bars")
            return count

        except Exception as e:
            logger.error(f"Failed to batch insert composite bars: {e}")
            raise

    async def get_range(
        self,
        asset: str,
        market_type: str,
        start_time: int,
        end_time: int,
        limit: int = 1440,  # 24 hours of 1-min bars
    ) -> list[CompositeBar]:
        """
        Get composite bars in a time range.

        Args:
            asset: Asset ID (BTC, ETH)
            market_type: Market type (spot, perp)
            start_time: Start time (unix seconds)
            end_time: End time (unix seconds)
            limit: Maximum bars to return

        Returns:
            List of CompositeBar objects, ordered by time ascending
        """
        try:
            start_ts = datetime.fromtimestamp(start_time, tz=timezone.utc)
            end_ts = datetime.fromtimestamp(end_time, tz=timezone.utc)

            query = """
                SELECT
                    EXTRACT(EPOCH FROM time)::BIGINT as time,
                    asset, market_type,
                    open, high, low, close, volume,
                    buy_volume, sell_volume, buy_count, sell_count,
                    degraded, is_gap, is_backfilled,
                    included_venues, excluded_venues
                FROM composite_bars
                WHERE asset = $1
                  AND market_type = $2
                  AND time >= $3
                  AND time < $4
                ORDER BY time ASC
                LIMIT $5
            """

            rows = await self.pool.fetch(
                query,
                asset.upper(),
                market_type.lower(),
                start_ts,
                end_ts,
                limit,
            )

            return [self._row_to_composite_bar(row) for row in rows]

        except Exception as e:
            logger.error(f"Failed to get composite bar range: {e}")
            raise

    async def get_latest(
        self,
        asset: str,
        market_type: str,
    ) -> Optional[CompositeBar]:
        """
        Get the most recent composite bar.

        Args:
            asset: Asset ID (BTC, ETH)
            market_type: Market type (spot, perp)

        Returns:
            Latest CompositeBar or None
        """
        try:
            query = """
                SELECT
                    EXTRACT(EPOCH FROM time)::BIGINT as time,
                    asset, market_type,
                    open, high, low, close, volume,
                    buy_volume, sell_volume, buy_count, sell_count,
                    degraded, is_gap, is_backfilled,
                    included_venues, excluded_venues
                FROM composite_bars
                WHERE asset = $1
                  AND market_type = $2
                ORDER BY time DESC
                LIMIT 1
            """

            row = await self.pool.fetchrow(query, asset.upper(), market_type.lower())
            if row:
                return self._row_to_composite_bar(row)
            return None

        except Exception as e:
            logger.error(f"Failed to get latest composite bar: {e}")
            raise

    async def count_gaps(
        self,
        asset: str,
        market_type: str,
        start_time: int,
        end_time: int,
    ) -> int:
        """
        Count gap bars in a time range.

        Args:
            asset: Asset ID
            market_type: Market type
            start_time: Start time (unix seconds)
            end_time: End time (unix seconds)

        Returns:
            Number of gap bars
        """
        try:
            start_ts = datetime.fromtimestamp(start_time, tz=timezone.utc)
            end_ts = datetime.fromtimestamp(end_time, tz=timezone.utc)

            query = """
                SELECT COUNT(*)
                FROM composite_bars
                WHERE asset = $1
                  AND market_type = $2
                  AND time >= $3
                  AND time < $4
                  AND is_gap = TRUE
            """

            return await self.pool.fetchval(
                query,
                asset.upper(),
                market_type.lower(),
                start_ts,
                end_ts,
            )

        except Exception as e:
            logger.error(f"Failed to count gaps: {e}")
            raise

    async def get_gaps(
        self,
        asset: str,
        market_type: str,
        start_time: int,
        end_time: int,
        limit: int = 1000,
    ) -> list[int]:
        """
        Get timestamps of gap bars in a time range.

        Args:
            asset: Asset ID
            market_type: Market type
            start_time: Start time (unix seconds)
            end_time: End time (unix seconds)
            limit: Maximum gaps to return

        Returns:
            List of gap timestamps (unix seconds)
        """
        try:
            start_ts = datetime.fromtimestamp(start_time, tz=timezone.utc)
            end_ts = datetime.fromtimestamp(end_time, tz=timezone.utc)

            query = """
                SELECT EXTRACT(EPOCH FROM time)::BIGINT as time
                FROM composite_bars
                WHERE asset = $1
                  AND market_type = $2
                  AND time >= $3
                  AND time < $4
                  AND is_gap = TRUE
                ORDER BY time ASC
                LIMIT $5
            """

            rows = await self.pool.fetch(
                query,
                asset.upper(),
                market_type.lower(),
                start_ts,
                end_ts,
                limit,
            )

            return [row["time"] for row in rows]

        except Exception as e:
            logger.error(f"Failed to get gaps: {e}")
            raise

    async def get_integrity_stats(
        self,
        asset: str,
        market_type: str,
        start_time: int,
        end_time: int,
    ) -> dict:
        """
        Get integrity statistics for a time range (Type B criteria).

        Args:
            asset: Asset ID
            market_type: Market type
            start_time: Start time (unix seconds)
            end_time: End time (unix seconds)

        Returns:
            Dict with integrity metrics for Type B evaluation
        """
        try:
            start_ts = datetime.fromtimestamp(start_time, tz=timezone.utc)
            end_ts = datetime.fromtimestamp(end_time, tz=timezone.utc)

            # Calculate expected bars (1 per minute)
            expected_bars = (end_time - start_time) // 60

            query = """
                SELECT
                    COUNT(*) as actual_bars,
                    COUNT(*) FILTER (WHERE is_gap = TRUE) as gaps,
                    COUNT(*) FILTER (WHERE degraded = TRUE) as degraded,
                    COUNT(*) FILTER (WHERE is_backfilled = TRUE) as backfilled,
                    COUNT(*) FILTER (WHERE excluded_venues IS NOT NULL AND excluded_venues != '[]'::jsonb) as quality_degraded
                FROM composite_bars
                WHERE asset = $1
                  AND market_type = $2
                  AND time >= $3
                  AND time < $4
            """

            row = await self.pool.fetchrow(
                query,
                asset.upper(),
                market_type.lower(),
                start_ts,
                end_ts,
            )

            actual_bars = row["actual_bars"] if row else 0
            gaps = row["gaps"] if row else 0
            degraded = row["degraded"] if row else 0
            backfilled = row["backfilled"] if row else 0
            quality_degraded = row["quality_degraded"] if row else 0

            # Missing bars are implicit gaps (not yet written)
            missing_bars = max(0, expected_bars - actual_bars)
            total_gaps = gaps + missing_bars

            # Calculate rates
            gap_rate = total_gaps / expected_bars if expected_bars > 0 else 0
            degraded_rate = degraded / expected_bars if expected_bars > 0 else 0
            quality_degraded_rate = quality_degraded / expected_bars if expected_bars > 0 else 0

            # Determine tier per Type B criteria
            # Use quality_degraded (excluded venues) for tier gating instead of degraded (below quorum)
            # This allows Tier 1 to be achievable with 2 venues where no exclusions occurred
            if total_gaps <= 5 and quality_degraded <= 60:
                tier = 1
            elif total_gaps <= 30 and quality_degraded <= 180:
                tier = 2
            else:
                tier = 3

            return {
                "expected_bars": expected_bars,
                "actual_bars": actual_bars,
                "missing_bars": missing_bars,
                "gaps": gaps,
                "total_gaps": total_gaps,
                "gap_rate": round(gap_rate, 6),
                "degraded": degraded,
                "degraded_rate": round(degraded_rate, 6),
                "quality_degraded": quality_degraded,
                "quality_degraded_rate": round(quality_degraded_rate, 6),
                "backfilled": backfilled,
                "tier": tier,
                "tier1_eligible": tier <= 1,
                "tier2_eligible": tier <= 2,
            }

        except Exception as e:
            logger.error(f"Failed to get integrity stats: {e}")
            raise

    async def enforce_retention(self, retention_days: int) -> int:
        """
        Delete composite bars older than retention period.

        Args:
            retention_days: Number of days to retain (must be > 0)

        Returns:
            Number of rows deleted
        """
        if retention_days <= 0:
            logger.debug("Retention enforcement skipped (retention_days=0)")
            return 0

        try:
            # Delete rows older than retention_days
            query = """
                DELETE FROM composite_bars
                WHERE time < NOW() - INTERVAL '1 day' * $1
            """

            result = await self.pool.execute(query, retention_days)

            # Parse "DELETE N" response
            deleted = 0
            if result and result.startswith("DELETE"):
                try:
                    deleted = int(result.split()[-1])
                except (ValueError, IndexError):
                    pass

            if deleted > 0:
                logger.info(f"Retention enforcement: deleted {deleted} bars older than {retention_days} days")
            else:
                logger.debug(f"Retention enforcement: no bars older than {retention_days} days")

            return deleted

        except Exception as e:
            logger.error(f"Failed to enforce retention: {e}")
            raise

    async def get_table_stats(self) -> dict:
        """
        Get table statistics for monitoring.

        Returns:
            Dict with row counts, oldest/newest timestamps, etc.
        """
        try:
            query = """
                SELECT
                    COUNT(*) as total_rows,
                    MIN(time) as oldest_bar,
                    MAX(time) as newest_bar,
                    COUNT(*) FILTER (WHERE is_gap = TRUE) as gap_count,
                    COUNT(*) FILTER (WHERE degraded = TRUE) as degraded_count
                FROM composite_bars
            """

            row = await self.pool.fetchrow(query)
            if row:
                return {
                    "total_rows": row["total_rows"],
                    "oldest_bar": row["oldest_bar"].isoformat() if row["oldest_bar"] else None,
                    "newest_bar": row["newest_bar"].isoformat() if row["newest_bar"] else None,
                    "gap_count": row["gap_count"],
                    "degraded_count": row["degraded_count"],
                }
            return {"total_rows": 0}

        except Exception as e:
            logger.error(f"Failed to get table stats: {e}")
            return {"error": str(e)}

    def _row_to_composite_bar(self, row) -> CompositeBar:
        """Convert database row to CompositeBar."""
        # Parse excluded venues from JSON
        excluded_data = row["excluded_venues"]
        if isinstance(excluded_data, str):
            excluded_data = json.loads(excluded_data)

        from ..core.types import ExcludeReason

        excluded_venues = []
        for ev in excluded_data:
            try:
                excluded_venues.append(ExcludedVenue(
                    venue=ev["venue"],
                    reason=ExcludeReason(ev["reason"]),
                ))
            except (KeyError, ValueError):
                pass

        return CompositeBar(
            time=row["time"],
            open=row["open"],
            high=row["high"],
            low=row["low"],
            close=row["close"],
            volume=row["volume"],
            buy_volume=row.get("buy_volume", 0.0),
            sell_volume=row.get("sell_volume", 0.0),
            buy_count=row.get("buy_count", 0),
            sell_count=row.get("sell_count", 0),
            degraded=row["degraded"],
            is_gap=row["is_gap"],
            is_backfilled=row["is_backfilled"],
            included_venues=list(row["included_venues"]),
            excluded_venues=excluded_venues,
            asset=AssetId(row["asset"]) if row["asset"] in [a.value for a in AssetId] else None,
            market_type=MarketType(row["market_type"]) if row["market_type"] in [m.value for m in MarketType] else None,
        )
