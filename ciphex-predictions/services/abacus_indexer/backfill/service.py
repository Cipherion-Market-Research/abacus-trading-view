"""
Backfill Service

Fetches historical trade data from exchange REST APIs and repairs gaps.

Usage:
    service = BackfillService(repository, venue_repository)
    result = await service.backfill_gaps("BTC", "spot", start_time, end_time)
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import httpx

from ..core.types import (
    AssetId,
    Bar,
    CompositeBar,
    ExcludedVenue,
    ExcludeReason,
    MarketType,
    Trade,
    VenueId,
)
from ..core.bar_builder import BarAccumulator, floor_to_minute
from ..core.constants import (
    BACKFILL_EXCLUDED_VENUES,
    get_backfill_venues,
    get_enabled_venues,
)
from ..persistence import CompositeBarRepository, VenueBarRepository

logger = logging.getLogger(__name__)


# Binance REST API endpoints
BINANCE_SPOT_TRADES = "https://api.binance.com/api/v3/aggTrades"
BINANCE_PERP_TRADES = "https://fapi.binance.com/fapi/v1/aggTrades"

# Coinbase REST API endpoints
COINBASE_TRADES = "https://api.exchange.coinbase.com/products/{symbol}/trades"

# Kraken REST API endpoints
KRAKEN_TRADES = "https://api.kraken.com/0/public/Trades"

# OKX REST API endpoints
# OKX uses /market/history-trades for historical trades with pagination
OKX_TRADES = "https://www.okx.com/api/v5/market/history-trades"

# Bybit REST API endpoints
# Bybit uses /v5/market/recent-trade for recent trades (no time-range filter)
# For historical trades with time range: /v5/market/trading-records (requires auth)
# We'll use recent-trade with pagination for backfill
BYBIT_TRADES = "https://api.bybit.com/v5/market/recent-trade"

# Rate limiting (conservative to avoid 429s)
BINANCE_RATE_LIMIT_DELAY = 0.1  # 100ms between requests
COINBASE_RATE_LIMIT_DELAY = 0.2  # 200ms between requests
KRAKEN_RATE_LIMIT_DELAY = 0.5  # 500ms between requests (Kraken is more restrictive)
OKX_RATE_LIMIT_DELAY = 0.2  # 200ms between requests
BYBIT_RATE_LIMIT_DELAY = 0.2  # 200ms between requests

# Kraken pair mapping (they use different symbols)
KRAKEN_PAIR_MAP = {
    "BTC": "XXBTZUSD",  # Kraken uses XBT for Bitcoin
    "ETH": "XETHZUSD",
}

# OKX instrument ID mapping
OKX_INST_MAP = {
    ("BTC", "spot"): "BTC-USDT",
    ("ETH", "spot"): "ETH-USDT",
    ("BTC", "perp"): "BTC-USDT-SWAP",
    ("ETH", "perp"): "ETH-USDT-SWAP",
}

# Bybit symbol mapping (perp only, linear USDT)
BYBIT_SYMBOL_MAP = {
    ("BTC", "perp"): "BTCUSDT",
    ("ETH", "perp"): "ETHUSDT",
}


@dataclass
class BackfillResult:
    """Result of a backfill operation."""

    asset: str
    market_type: str
    start_time: int
    end_time: int
    gaps_found: int = 0
    bars_repaired: int = 0
    bars_failed: int = 0
    venue_bars_inserted: int = 0
    errors: list[str] = field(default_factory=list)
    duration_seconds: float = 0.0


class BackfillService:
    """
    Service for backfilling gaps via exchange REST APIs.

    Per COINBASE_BACKFILL_ARCHITECTURE_DECISION.md (Option A):
    - Uses BACKFILL_VENUES only (venues with historical REST APIs)
    - Coinbase is excluded (no time-range query support)
    - Excluded realtime venues are marked with BACKFILL_UNAVAILABLE reason

    Priority order for backfill:
    1. Binance REST (highest volume, reliable, full pagination)
    2. Kraken REST (good historical API, when implemented)
    3. OKX REST (good historical API, when implemented)

    The service:
    - Detects gaps in composite_bars
    - Fetches historical trades for gap minutes from BACKFILL_VENUES
    - Builds venue bars using same BarAccumulator logic
    - Creates composite bars from venue data
    - Marks realtime-only venues (Coinbase) as BACKFILL_UNAVAILABLE
    - Upserts with is_backfilled=true
    """

    def __init__(
        self,
        composite_repo: CompositeBarRepository,
        venue_repo: VenueBarRepository,
    ):
        self.composite_repo = composite_repo
        self.venue_repo = venue_repo
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def close(self) -> None:
        """Close HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def backfill_gaps(
        self,
        asset: str,
        market_type: str,
        start_time: int,
        end_time: int,
        venues: Optional[list[str]] = None,
    ) -> BackfillResult:
        """
        Backfill gaps in a time range.

        Args:
            asset: Asset ID (BTC, ETH)
            market_type: Market type (spot, perp)
            start_time: Start time (unix seconds)
            end_time: End time (unix seconds)
            venues: Venues to use for backfill (default: from BACKFILL_VENUES)

        Returns:
            BackfillResult with statistics
        """
        start = datetime.now()
        result = BackfillResult(
            asset=asset,
            market_type=market_type,
            start_time=start_time,
            end_time=end_time,
        )

        try:
            # Get gap timestamps
            gaps = await self.composite_repo.get_gaps(
                asset, market_type, start_time, end_time
            )
            result.gaps_found = len(gaps)

            if not gaps:
                logger.info(f"No gaps found for {asset}/{market_type} in range")
                return result

            logger.info(f"Found {len(gaps)} gaps to backfill for {asset}/{market_type}")

            # Determine venues to use (from BACKFILL_VENUES, not all realtime venues)
            # Per Option A: Coinbase excluded, only venues with historical APIs
            if venues is None:
                mt = MarketType(market_type.lower())
                backfill_venues = get_backfill_venues(mt)
                venues = [v.value for v in backfill_venues]
                logger.info(f"Using backfill venues: {venues}")

            # Backfill each gap
            for gap_time in gaps:
                try:
                    venue_count = await self._backfill_single_gap(
                        asset, market_type, gap_time, venues
                    )
                    if venue_count > 0:
                        result.bars_repaired += 1
                        result.venue_bars_inserted += venue_count
                    else:
                        result.bars_failed += 1
                except Exception as e:
                    logger.error(f"Failed to backfill gap at {gap_time}: {e}")
                    result.bars_failed += 1
                    result.errors.append(f"Gap {gap_time}: {str(e)}")

        except Exception as e:
            logger.error(f"Backfill operation failed: {e}")
            result.errors.append(str(e))

        result.duration_seconds = (datetime.now() - start).total_seconds()
        return result

    async def _backfill_single_gap(
        self,
        asset: str,
        market_type: str,
        gap_time: int,
        venues: list[str],
    ) -> int:
        """
        Backfill a single gap minute.

        Args:
            asset: Asset ID
            market_type: Market type
            gap_time: Gap timestamp (unix seconds, bar start)
            venues: Venues to fetch from

        Returns:
            Number of venue bars successfully inserted (0 if repair failed)
        """
        logger.debug(f"Backfilling gap at {gap_time} for {asset}/{market_type}")

        # Fetch trades from each venue for this minute
        venue_bars: list[tuple[Bar, bool, Optional[str]]] = []
        valid_venue_bars: dict[VenueId, Bar] = {}

        for venue_str in venues:
            try:
                venue_id = VenueId(venue_str.lower())
                trades = await self._fetch_trades_for_minute(
                    asset, market_type, venue_str, gap_time
                )

                if not trades:
                    logger.debug(f"No trades from {venue_str} for minute {gap_time}")
                    continue

                # Build bar from trades
                bar = self._build_bar_from_trades(
                    trades, gap_time, venue_id,
                    AssetId(asset.upper()),
                    MarketType(market_type.lower())
                )

                if bar:
                    valid_venue_bars[venue_id] = bar
                    venue_bars.append((bar, True, None))  # included, no exclude reason

            except Exception as e:
                logger.warning(f"Failed to fetch from {venue_str}: {e}")
                continue

        # Check if we have enough venues for quorum
        if len(valid_venue_bars) < 2:
            logger.debug(f"Insufficient venues ({len(valid_venue_bars)}) for gap repair at {gap_time}")
            return 0

        # Build composite bar from venue bars
        composite = self._build_composite_from_venue_bars(
            valid_venue_bars,
            gap_time,
            AssetId(asset.upper()),
            MarketType(market_type.lower()),
        )

        if not composite:
            logger.debug(f"Failed to build composite for gap at {gap_time}")
            return 0

        # Mark as backfilled
        composite = CompositeBar(
            time=composite.time,
            open=composite.open,
            high=composite.high,
            low=composite.low,
            close=composite.close,
            volume=composite.volume,
            buy_volume=composite.buy_volume,
            sell_volume=composite.sell_volume,
            buy_count=composite.buy_count,
            sell_count=composite.sell_count,
            degraded=composite.degraded,
            is_gap=False,  # No longer a gap
            is_backfilled=True,  # Repaired via backfill
            included_venues=composite.included_venues,
            excluded_venues=composite.excluded_venues,
            asset=composite.asset,
            market_type=composite.market_type,
        )

        # Persist venue bars
        inserted_count = len(venue_bars)
        if venue_bars:
            await self.venue_repo.insert_batch(venue_bars)

        # Persist composite bar (will trigger is_backfilled=true via UPSERT logic)
        await self.composite_repo.insert(composite)

        logger.info(f"Repaired gap at {gap_time} with {len(valid_venue_bars)} venues")
        return inserted_count

    async def _fetch_trades_for_minute(
        self,
        asset: str,
        market_type: str,
        venue: str,
        bar_time: int,
    ) -> list[Trade]:
        """
        Fetch trades for a specific minute from a venue.

        Args:
            asset: Asset ID
            market_type: Market type
            venue: Venue name
            bar_time: Bar start time (unix seconds)

        Returns:
            List of Trade objects
        """
        client = await self._get_client()
        start_ms = bar_time * 1000
        end_ms = (bar_time + 60) * 1000 - 1  # End of minute

        if venue == "binance":
            return await self._fetch_binance_trades(
                client, asset, market_type, start_ms, end_ms
            )
        elif venue == "coinbase":
            return await self._fetch_coinbase_trades(
                client, asset, market_type, start_ms, end_ms
            )
        elif venue == "kraken":
            return await self._fetch_kraken_trades(
                client, asset, market_type, start_ms, end_ms
            )
        elif venue == "okx":
            return await self._fetch_okx_trades(
                client, asset, market_type, start_ms, end_ms
            )
        elif venue == "bybit":
            return await self._fetch_bybit_trades(
                client, asset, market_type, start_ms, end_ms
            )
        else:
            logger.warning(f"[backfill] Unsupported venue: {venue} - no fetcher implemented")
            return []

    async def _fetch_binance_trades(
        self,
        client: httpx.AsyncClient,
        asset: str,
        market_type: str,
        start_ms: int,
        end_ms: int,
    ) -> list[Trade]:
        """
        Fetch trades from Binance REST API with pagination.

        For liquid markets like BTC, one minute can have 3000+ trades,
        exceeding the 1000 limit per request. This method paginates
        using the fromId parameter to fetch all trades in the window.
        """
        # Determine symbol and endpoint
        if market_type == "spot":
            symbol = f"{asset.upper()}USDT"
            url = BINANCE_SPOT_TRADES
        else:
            symbol = f"{asset.upper()}USDT"
            url = BINANCE_PERP_TRADES

        all_trades: list[Trade] = []
        last_id: Optional[int] = None
        max_pages = 10  # Safety limit to prevent infinite loops

        try:
            for page in range(max_pages):
                params = {
                    "symbol": symbol,
                    "startTime": start_ms,
                    "endTime": end_ms,
                    "limit": 1000,
                }

                # Use fromId for pagination after first request
                if last_id is not None:
                    params["fromId"] = last_id + 1

                await asyncio.sleep(BINANCE_RATE_LIMIT_DELAY)
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

                if not data:
                    break  # No more trades

                for item in data:
                    # Binance aggTrade format:
                    # {"a": aggTradeId, "p": price, "q": qty, "f": firstTradeId,
                    #  "l": lastTradeId, "T": timestamp, "m": isBuyerMaker}
                    timestamp_ms = int(item["T"])
                    trade = Trade(
                        price=float(item["p"]),
                        quantity=float(item["q"]),
                        timestamp=timestamp_ms,
                        local_timestamp=timestamp_ms,  # Backfill uses exchange time
                        is_buyer_maker=item.get("m", False),
                        venue=VenueId.BINANCE,
                        asset=AssetId(asset.upper()),
                        market_type=MarketType(market_type.lower()),
                    )
                    all_trades.append(trade)

                # Update last_id for pagination
                last_id = data[-1]["a"]  # aggTradeId

                # If we got fewer than limit, we've reached the end
                if len(data) < 1000:
                    break

                logger.debug(f"Binance pagination: page {page + 1}, {len(all_trades)} trades so far")

            if len(all_trades) > 1000:
                logger.info(f"Binance backfill fetched {len(all_trades)} trades (paginated)")

            return all_trades

        except httpx.HTTPStatusError as e:
            # Venue-specific HTTP error
            logger.error(
                f"[binance/backfill] HTTP error {e.response.status_code} for {asset}: "
                f"{e.response.text[:200] if e.response.text else 'no body'}"
            )
            raise
        except Exception as e:
            # Unexpected error - likely code issue
            logger.error(
                f"[binance/backfill] Unexpected error for {asset}: "
                f"{type(e).__name__}: {e}"
            )
            raise

    async def _fetch_coinbase_trades(
        self,
        client: httpx.AsyncClient,
        asset: str,
        market_type: str,
        start_ms: int,
        end_ms: int,
    ) -> list[Trade]:
        """Fetch trades from Coinbase REST API."""
        if market_type != "spot":
            # Coinbase only supports spot in this implementation
            return []

        symbol = f"{asset.upper()}-USD"
        url = COINBASE_TRADES.format(symbol=symbol)

        try:
            await asyncio.sleep(COINBASE_RATE_LIMIT_DELAY)
            response = await client.get(url, params={"limit": 1000})
            response.raise_for_status()
            data = response.json()

            trades = []
            for item in data:
                # Coinbase trade format:
                # {"time": ISO8601, "trade_id": int, "price": str, "size": str, "side": "buy"|"sell"}
                timestamp_ms = int(datetime.fromisoformat(
                    item["time"].replace("Z", "+00:00")
                ).timestamp() * 1000)

                # Filter to our time range
                if timestamp_ms < start_ms or timestamp_ms > end_ms:
                    continue

                # Coinbase "side" is the TAKER's side (not maker)
                # is_buyer_maker = True means buyer was passive (taker sold)
                side_str = item.get("side", "buy")
                is_buyer_maker = side_str == "sell"  # If taker sold, buyer was maker

                trade = Trade(
                    price=float(item["price"]),
                    quantity=float(item["size"]),
                    timestamp=timestamp_ms,
                    local_timestamp=timestamp_ms,  # Backfill uses exchange time
                    is_buyer_maker=is_buyer_maker,
                    venue=VenueId.COINBASE,
                    asset=AssetId(asset.upper()),
                    market_type=MarketType.SPOT,
                )
                trades.append(trade)

            return trades

        except httpx.HTTPStatusError as e:
            logger.error(f"[coinbase/backfill] HTTP error {e.response.status_code}: {e}")
            raise
        except Exception as e:
            logger.error(f"[coinbase/backfill] Unexpected error: {type(e).__name__}: {e}")
            raise

    async def _fetch_kraken_trades(
        self,
        client: httpx.AsyncClient,
        asset: str,
        market_type: str,
        start_ms: int,
        end_ms: int,
    ) -> list[Trade]:
        """
        Fetch trades from Kraken REST API with pagination.

        Kraken Trades API:
        - Endpoint: https://api.kraken.com/0/public/Trades
        - Params: pair (e.g., XXBTZUSD), since (nanosecond timestamp)
        - Returns up to 1000 trades per request
        - Response includes 'last' timestamp for pagination

        Trade format in response:
        [price, volume, time, buy/sell, market/limit, misc]
        - time is unix timestamp (seconds with decimals)
        - buy/sell: "b" = buyer was taker, "s" = seller was taker
        """
        if market_type != "spot":
            # Kraken perps not supported in this implementation
            logger.debug(f"[kraken/backfill] Perps not supported, skipping {asset}")
            return []

        # Map to Kraken pair format
        pair = KRAKEN_PAIR_MAP.get(asset.upper())
        if not pair:
            logger.warning(f"[kraken/backfill] Unknown asset mapping for {asset}")
            return []

        all_trades: list[Trade] = []
        # Kraken 'since' param is nanoseconds for precise pagination
        since_ns = start_ms * 1_000_000  # ms to ns
        end_ns = end_ms * 1_000_000
        max_pages = 10  # Safety limit

        try:
            for page in range(max_pages):
                params = {
                    "pair": pair,
                    "since": since_ns,
                }

                await asyncio.sleep(KRAKEN_RATE_LIMIT_DELAY)
                response = await client.get(KRAKEN_TRADES, params=params)
                response.raise_for_status()
                data = response.json()

                # Check for Kraken API errors
                if data.get("error") and len(data["error"]) > 0:
                    error_msgs = data["error"]
                    # Kraken returns errors as list of strings
                    logger.error(f"[kraken/backfill] API error: {error_msgs}")
                    raise RuntimeError(f"Kraken API error: {error_msgs}")

                result = data.get("result", {})
                if not result:
                    logger.debug(f"[kraken/backfill] Empty result for {pair}")
                    break

                # Get trades array - key is the pair name
                # Kraken uses different key formats: XXBTZUSD or XBTUSD
                trades_data = None
                for key in result.keys():
                    if key != "last":
                        trades_data = result[key]
                        break

                if not trades_data:
                    logger.debug(f"[kraken/backfill] No trades in result for {pair}")
                    break

                trades_in_range = 0
                for item in trades_data:
                    # Kraken trade format:
                    # [price, volume, time, buy/sell, market/limit, misc, trade_id]
                    # Note: trade_id was added later, may not always be present
                    try:
                        price = float(item[0])
                        volume = float(item[1])
                        time_sec = float(item[2])
                        side = item[3]  # "b" or "s"
                    except (IndexError, ValueError, TypeError) as e:
                        logger.warning(f"[kraken/backfill] Invalid trade format: {e}")
                        continue

                    # Convert to milliseconds
                    timestamp_ms = int(time_sec * 1000)

                    # Filter to our time range
                    if timestamp_ms < start_ms:
                        continue
                    if timestamp_ms > end_ms:
                        # Past our window, we can stop pagination
                        break

                    # Kraken "b" = buyer was taker (is_buyer_maker = False)
                    # Kraken "s" = seller was taker (is_buyer_maker = True)
                    is_buyer_maker = side == "s"

                    trade = Trade(
                        price=price,
                        quantity=volume,
                        timestamp=timestamp_ms,
                        local_timestamp=timestamp_ms,  # Backfill uses exchange time
                        is_buyer_maker=is_buyer_maker,
                        venue=VenueId.KRAKEN,
                        asset=AssetId(asset.upper()),
                        market_type=MarketType.SPOT,
                    )
                    all_trades.append(trade)
                    trades_in_range += 1

                # Get 'last' timestamp for pagination
                last_ns = result.get("last")
                if last_ns:
                    # Check if we've gone past our window
                    last_ms = int(last_ns) // 1_000_000
                    if last_ms > end_ms:
                        break
                    since_ns = int(last_ns)
                else:
                    break

                # If we got fewer trades than max, we've reached the end
                if len(trades_data) < 1000:
                    break

                logger.debug(
                    f"[kraken/backfill] Page {page + 1}: {len(trades_data)} trades, "
                    f"{trades_in_range} in range, {len(all_trades)} total"
                )

            if all_trades:
                logger.debug(
                    f"[kraken/backfill] Fetched {len(all_trades)} trades for "
                    f"{asset}/{market_type} ({start_ms}-{end_ms})"
                )

            return all_trades

        except httpx.HTTPStatusError as e:
            # Venue-specific HTTP error (rate limit, server error, etc.)
            logger.error(
                f"[kraken/backfill] HTTP error {e.response.status_code} for {asset}: "
                f"{e.response.text[:200] if e.response.text else 'no body'}"
            )
            raise
        except RuntimeError as e:
            # Kraken API-level error (already logged above)
            raise
        except Exception as e:
            # Unexpected error - likely code issue
            logger.error(
                f"[kraken/backfill] Unexpected error for {asset}: "
                f"{type(e).__name__}: {e}"
            )
            raise

    async def _fetch_okx_trades(
        self,
        client: httpx.AsyncClient,
        asset: str,
        market_type: str,
        start_ms: int,
        end_ms: int,
    ) -> list[Trade]:
        """
        Fetch trades from OKX REST API with pagination.

        OKX History Trades API:
        - Endpoint: https://www.okx.com/api/v5/market/history-trades
        - Params: instId, after (tradeId for pagination), limit
        - Returns up to 100 trades per request
        - Pagination via 'after' parameter (tradeId of last trade)

        Trade format in response:
        {
            "instId": "BTC-USDT",
            "side": "buy",     // taker's side
            "sz": "0.1",
            "px": "97500.0",
            "tradeId": "123456789",
            "ts": "1705314600000"  // timestamp in ms
        }
        """
        # Map to OKX instrument ID
        inst_id = OKX_INST_MAP.get((asset.upper(), market_type.lower()))
        if not inst_id:
            logger.warning(f"[okx/backfill] Unknown asset/market mapping for {asset}/{market_type}")
            return []

        all_trades: list[Trade] = []
        after_id: Optional[str] = None
        max_pages = 50  # Safety limit (100 trades/page * 50 = 5000 trades max)

        try:
            for page in range(max_pages):
                params = {
                    "instId": inst_id,
                    "limit": "100",  # Max 100 per request
                }

                # Use 'after' for pagination (tradeId of last trade)
                if after_id:
                    params["after"] = after_id

                await asyncio.sleep(OKX_RATE_LIMIT_DELAY)
                response = await client.get(OKX_TRADES, params=params)
                response.raise_for_status()
                data = response.json()

                # Check for OKX API errors
                if data.get("code") != "0":
                    error_msg = data.get("msg", "Unknown error")
                    logger.error(f"[okx/backfill] API error: {error_msg}")
                    raise RuntimeError(f"OKX API error: {error_msg}")

                trades_data = data.get("data", [])
                if not trades_data:
                    break

                trades_in_range = 0
                for item in trades_data:
                    try:
                        ts_str = item.get("ts", "0")
                        timestamp_ms = int(ts_str)
                    except (ValueError, TypeError):
                        logger.warning(f"[okx/backfill] Invalid timestamp: {item.get('ts')}")
                        continue

                    # Filter to our time range
                    if timestamp_ms < start_ms:
                        # OKX returns newest first, so older trades mean we can stop
                        continue
                    if timestamp_ms > end_ms:
                        continue

                    try:
                        price = float(item.get("px", 0))
                        quantity = float(item.get("sz", 0))
                        side = item.get("side", "")
                    except (ValueError, TypeError) as e:
                        logger.warning(f"[okx/backfill] Invalid trade data: {e}")
                        continue

                    if price <= 0 or quantity <= 0:
                        continue

                    # OKX "side" is the taker's side
                    # side = "sell" -> taker sold -> is_buyer_maker = True
                    # side = "buy" -> taker bought -> is_buyer_maker = False
                    is_buyer_maker = (side.lower() == "sell")

                    trade = Trade(
                        price=price,
                        quantity=quantity,
                        timestamp=timestamp_ms,
                        local_timestamp=timestamp_ms,  # Backfill uses exchange time
                        is_buyer_maker=is_buyer_maker,
                        venue=VenueId.OKX,
                        asset=AssetId(asset.upper()),
                        market_type=MarketType(market_type.lower()),
                    )
                    all_trades.append(trade)
                    trades_in_range += 1

                # Get last tradeId for pagination
                if trades_data:
                    after_id = trades_data[-1].get("tradeId")

                # If we got fewer trades than limit, we've reached the end
                if len(trades_data) < 100:
                    break

                # Check if oldest trade is before our window (stop pagination)
                if trades_data:
                    oldest_ts = int(trades_data[-1].get("ts", "0"))
                    if oldest_ts < start_ms:
                        break

                logger.debug(
                    f"[okx/backfill] Page {page + 1}: {len(trades_data)} trades, "
                    f"{trades_in_range} in range, {len(all_trades)} total"
                )

            if all_trades:
                logger.debug(
                    f"[okx/backfill] Fetched {len(all_trades)} trades for "
                    f"{asset}/{market_type} ({start_ms}-{end_ms})"
                )

            return all_trades

        except httpx.HTTPStatusError as e:
            # Venue-specific HTTP error (rate limit, server error, etc.)
            logger.error(
                f"[okx/backfill] HTTP error {e.response.status_code} for {asset}: "
                f"{e.response.text[:200] if e.response.text else 'no body'}"
            )
            raise
        except RuntimeError:
            # OKX API-level error (already logged above)
            raise
        except Exception as e:
            # Unexpected error - likely code issue
            logger.error(
                f"[okx/backfill] Unexpected error for {asset}: "
                f"{type(e).__name__}: {e}"
            )
            raise

    async def _fetch_bybit_trades(
        self,
        client: httpx.AsyncClient,
        asset: str,
        market_type: str,
        start_ms: int,
        end_ms: int,
    ) -> list[Trade]:
        """
        Fetch trades from Bybit REST API (RECENT-ONLY).

        IMPORTANT: This is a RECENT-ONLY backfill fetcher.
        - Uses public recent-trade endpoint (no auth required)
        - Returns only the most recent ~1000 trades
        - No time-range query params available
        - Suitable for repairing very recent gaps only
        - NOT suitable for arbitrary historical window recovery

        For full historical backfill, Bybit requires authenticated access
        to the trading-records endpoint, which is not implemented.

        Bybit Recent Trade API:
        - Endpoint: https://api.bybit.com/v5/market/recent-trade
        - Params: category, symbol, limit
        - Returns up to 1000 trades per request (newest first)
        - No cursor pagination, single page only

        Trade format in response:
        {
            "symbol": "BTCUSDT",
            "side": "Buy",     // taker's side
            "size": "0.001",
            "price": "97500.00",
            "time": "1705314600123",  // timestamp ms
            "isBlockTrade": false
        }

        Note: Bybit only supports perp in our scope.
        """
        # Bybit only supports perp
        if market_type.lower() != "perp":
            logger.warning(f"[bybit/backfill] Only perp supported, got {market_type}")
            return []

        # Map to Bybit symbol
        symbol = BYBIT_SYMBOL_MAP.get((asset.upper(), market_type.lower()))
        if not symbol:
            logger.warning(f"[bybit/backfill] Unknown asset/market mapping for {asset}/{market_type}")
            return []

        all_trades: list[Trade] = []
        max_pages = 10  # Safety limit (1000 trades/page * 10 = 10000 trades max)

        try:
            for page in range(max_pages):
                params = {
                    "category": "linear",
                    "symbol": symbol,
                    "limit": "1000",  # Max per request
                }

                await asyncio.sleep(BYBIT_RATE_LIMIT_DELAY)
                response = await client.get(BYBIT_TRADES, params=params)
                response.raise_for_status()
                data = response.json()

                # Check for Bybit API errors
                ret_code = data.get("retCode", -1)
                if ret_code != 0:
                    error_msg = data.get("retMsg", "Unknown error")
                    logger.error(f"[bybit/backfill] API error: {error_msg}")
                    raise RuntimeError(f"Bybit API error: {error_msg}")

                result = data.get("result", {})
                trades_data = result.get("list", [])
                if not trades_data:
                    break

                trades_in_range = 0
                oldest_ts = None

                for item in trades_data:
                    try:
                        ts_str = item.get("time", "0")
                        timestamp_ms = int(ts_str)
                    except (ValueError, TypeError):
                        logger.warning(f"[bybit/backfill] Invalid timestamp: {item.get('time')}")
                        continue

                    # Track oldest for pagination check
                    if oldest_ts is None or timestamp_ms < oldest_ts:
                        oldest_ts = timestamp_ms

                    # Filter to our time range
                    if timestamp_ms < start_ms:
                        continue
                    if timestamp_ms > end_ms:
                        continue

                    try:
                        price = float(item.get("price", 0))
                        quantity = float(item.get("size", 0))
                        side = item.get("side", "")
                    except (ValueError, TypeError) as e:
                        logger.warning(f"[bybit/backfill] Invalid trade data: {e}")
                        continue

                    if price <= 0 or quantity <= 0:
                        continue

                    # Bybit "side" is the taker's side
                    # side = "Sell" -> taker sold -> is_buyer_maker = True
                    # side = "Buy" -> taker bought -> is_buyer_maker = False
                    is_buyer_maker = (side.lower() == "sell")

                    trade = Trade(
                        price=price,
                        quantity=quantity,
                        timestamp=timestamp_ms,
                        local_timestamp=timestamp_ms,  # Backfill uses exchange time
                        is_buyer_maker=is_buyer_maker,
                        venue=VenueId.BYBIT,
                        asset=AssetId(asset.upper()),
                        market_type=MarketType(market_type.lower()),
                    )
                    all_trades.append(trade)
                    trades_in_range += 1

                # Bybit returns newest first, so if oldest trade is still > start_ms
                # we might need to paginate (but Bybit doesn't support cursor for public API)
                # For now, we just take what we get from the first page
                # The recent-trade endpoint only returns recent trades, not historical
                break  # Only one page since no pagination cursor for this endpoint

            if all_trades:
                logger.debug(
                    f"[bybit/backfill] Fetched {len(all_trades)} trades for "
                    f"{asset}/{market_type} ({start_ms}-{end_ms})"
                )

            return all_trades

        except httpx.HTTPStatusError as e:
            logger.error(
                f"[bybit/backfill] HTTP error {e.response.status_code} for {asset}: "
                f"{e.response.text[:200] if e.response.text else 'no body'}"
            )
            raise
        except RuntimeError:
            raise
        except Exception as e:
            logger.error(
                f"[bybit/backfill] Unexpected error for {asset}: "
                f"{type(e).__name__}: {e}"
            )
            raise

    def _build_bar_from_trades(
        self,
        trades: list[Trade],
        bar_time: int,
        venue: VenueId,
        asset: AssetId,
        market_type: MarketType,
    ) -> Optional[Bar]:
        """Build a bar from a list of trades."""
        if not trades:
            return None

        accumulator = BarAccumulator(bar_time=bar_time)

        for trade in trades:
            # Only include trades for this minute
            trade_bar_time = floor_to_minute(trade.timestamp)
            if trade_bar_time == bar_time:
                accumulator.add_trade(trade)

        bar = accumulator.to_bar(is_partial=False)
        if bar:
            # Override venue/asset/market_type
            return Bar(
                time=bar.time,
                open=bar.open,
                high=bar.high,
                low=bar.low,
                close=bar.close,
                volume=bar.volume,
                trade_count=bar.trade_count,
                buy_volume=bar.buy_volume,
                sell_volume=bar.sell_volume,
                buy_count=bar.buy_count,
                sell_count=bar.sell_count,
                venue=venue,
                asset=asset,
                market_type=market_type,
                is_partial=False,
            )

        return None

    def _build_composite_from_venue_bars(
        self,
        venue_bars: dict[VenueId, Bar],
        bar_time: int,
        asset: AssetId,
        market_type: MarketType,
    ) -> Optional[CompositeBar]:
        """
        Build a composite bar from venue bars.

        Uses median price for OHLC, sum for volume.
        Explicitly marks realtime-only venues (like Coinbase) as BACKFILL_UNAVAILABLE.
        """
        if not venue_bars:
            return None

        bars = list(venue_bars.values())

        # Calculate median for OHLC
        opens = sorted([b.open for b in bars])
        highs = sorted([b.high for b in bars])
        lows = sorted([b.low for b in bars])
        closes = sorted([b.close for b in bars])

        def median(values: list[float]) -> float:
            n = len(values)
            if n == 0:
                return 0.0
            mid = n // 2
            if n % 2 == 0:
                return (values[mid - 1] + values[mid]) / 2
            return values[mid]

        # Sum volumes
        total_volume = sum(b.volume for b in bars)
        total_buy_volume = sum(b.buy_volume for b in bars)
        total_sell_volume = sum(b.sell_volume for b in bars)
        total_buy_count = sum(b.buy_count for b in bars)
        total_sell_count = sum(b.sell_count for b in bars)

        # Determine degraded status (below preferred quorum of 3)
        degraded = len(bars) < 3

        # Build excluded venues list
        # Per Option A: Mark realtime-only venues as BACKFILL_UNAVAILABLE
        # This ensures quality_degraded correctly counts these exclusions
        excluded_venues: list[ExcludedVenue] = []
        enabled_venues = set(get_enabled_venues(market_type))
        included_venue_ids = set(venue_bars.keys())

        for venue_id in enabled_venues:
            if venue_id not in included_venue_ids:
                # Determine exclusion reason
                if venue_id in BACKFILL_EXCLUDED_VENUES:
                    # Venue is realtime-only (e.g., Coinbase)
                    reason = ExcludeReason.BACKFILL_UNAVAILABLE
                else:
                    # Venue supports backfill but didn't return data
                    reason = ExcludeReason.NO_DATA
                excluded_venues.append(ExcludedVenue(venue=venue_id.value, reason=reason))

        return CompositeBar(
            time=bar_time,
            open=median(opens),
            high=median(highs),
            low=median(lows),
            close=median(closes),
            volume=total_volume,
            buy_volume=total_buy_volume,
            sell_volume=total_sell_volume,
            buy_count=total_buy_count,
            sell_count=total_sell_count,
            degraded=degraded,
            is_gap=False,
            is_backfilled=True,
            included_venues=[v.value for v in venue_bars.keys()],
            excluded_venues=excluded_venues,
            asset=asset,
            market_type=market_type,
        )
