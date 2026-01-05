"""
Abacus Indexer Symbol Mapping

Canonical mapping from (asset, venue, market_type) to venue-specific symbols.
This is the foundation for all venue integrations.

Matches POC symbolMapping.ts.
"""

from typing import Any, Optional

from .types import AssetId, MarketType, VenueId


# =============================================================================
# Symbol Mapping Tables
# =============================================================================

# Spot symbol mapping per venue
# Format varies by exchange:
# - Binance: BTCUSDT (no separator, uppercase)
# - Coinbase: BTC-USD (dash separator, uppercase)
# - Kraken: XBT/USD (slash separator, XBT not BTC)
# - OKX: BTC-USDT (dash separator)
# - Bybit: N/A for spot in POC
SPOT_SYMBOLS: dict[VenueId, dict[AssetId, Optional[str]]] = {
    VenueId.BINANCE: {
        AssetId.BTC: "BTCUSDT",
        AssetId.ETH: "ETHUSDT",
    },
    VenueId.COINBASE: {
        AssetId.BTC: "BTC-USD",
        AssetId.ETH: "ETH-USD",
    },
    VenueId.KRAKEN: {
        AssetId.BTC: "XBT/USD",
        AssetId.ETH: "ETH/USD",
    },
    VenueId.OKX: {
        AssetId.BTC: "BTC-USDT",
        AssetId.ETH: "ETH-USDT",
    },
    VenueId.BYBIT: {
        AssetId.BTC: None,  # Bybit spot not in scope
        AssetId.ETH: None,
    },
}

# Perpetual symbol mapping per venue
# Format varies by exchange:
# - Binance: BTCUSDT (same as spot, different endpoint)
# - Coinbase: N/A (no perps)
# - Kraken: N/A for POC
# - OKX: BTC-USDT-SWAP (SWAP suffix)
# - Bybit: BTCUSDT (category=linear in subscription)
PERP_SYMBOLS: dict[VenueId, dict[AssetId, Optional[str]]] = {
    VenueId.BINANCE: {
        AssetId.BTC: "BTCUSDT",
        AssetId.ETH: "ETHUSDT",
    },
    VenueId.COINBASE: {
        AssetId.BTC: None,  # No perps
        AssetId.ETH: None,
    },
    VenueId.KRAKEN: {
        AssetId.BTC: None,  # Kraken perps not in POC
        AssetId.ETH: None,
    },
    VenueId.OKX: {
        AssetId.BTC: "BTC-USDT-SWAP",
        AssetId.ETH: "ETH-USDT-SWAP",
    },
    VenueId.BYBIT: {
        AssetId.BTC: "BTCUSDT",
        AssetId.ETH: "ETHUSDT",
    },
}


# =============================================================================
# Public API
# =============================================================================

def get_symbol(
    venue: VenueId,
    asset: AssetId,
    market_type: MarketType,
) -> Optional[str]:
    """
    Get the venue-specific symbol for an asset and market type.

    Args:
        venue: Target venue
        asset: Asset (BTC, ETH)
        market_type: Market type (spot, perp)

    Returns:
        Venue-specific symbol or None if not supported

    Examples:
        >>> get_symbol(VenueId.BINANCE, AssetId.BTC, MarketType.SPOT)
        'BTCUSDT'
        >>> get_symbol(VenueId.OKX, AssetId.BTC, MarketType.PERP)
        'BTC-USDT-SWAP'
        >>> get_symbol(VenueId.KRAKEN, AssetId.BTC, MarketType.SPOT)
        'XBT/USD'
        >>> get_symbol(VenueId.COINBASE, AssetId.BTC, MarketType.PERP)
        None
    """
    table = SPOT_SYMBOLS if market_type == MarketType.SPOT else PERP_SYMBOLS
    venue_symbols = table.get(venue, {})
    return venue_symbols.get(asset)


def get_stream_name(
    venue: VenueId,
    asset: AssetId,
    market_type: MarketType,
) -> Optional[str]:
    """
    Get the WebSocket stream/channel name for subscribing.
    This is often different from the symbol itself.

    Args:
        venue: Target venue
        asset: Asset
        market_type: Market type

    Returns:
        Stream name for WS subscription or None if not supported

    Examples:
        >>> get_stream_name(VenueId.BINANCE, AssetId.BTC, MarketType.SPOT)
        'btcusdt'
        >>> get_stream_name(VenueId.OKX, AssetId.BTC, MarketType.PERP)
        'BTC-USDT-SWAP'
    """
    symbol = get_symbol(venue, asset, market_type)
    if not symbol:
        return None

    # Apply venue-specific formatting
    if venue == VenueId.BINANCE:
        return symbol.lower()

    return symbol


def venue_supports_market(venue: VenueId, market_type: MarketType) -> bool:
    """Check if a venue supports a given market type."""
    table = SPOT_SYMBOLS if market_type == MarketType.SPOT else PERP_SYMBOLS
    venue_symbols = table.get(venue, {})
    return any(s is not None for s in venue_symbols.values())


def venue_supports_asset(
    venue: VenueId,
    asset: AssetId,
    market_type: MarketType,
) -> bool:
    """Check if a venue supports a specific asset and market type."""
    return get_symbol(venue, asset, market_type) is not None


def get_supported_combinations(
    market_type: MarketType,
) -> list[dict[str, Any]]:
    """
    Get all supported venue/asset combinations for a market type.

    Returns:
        List of dicts with venue, asset, and symbol
    """
    table = SPOT_SYMBOLS if market_type == MarketType.SPOT else PERP_SYMBOLS
    results: list[dict[str, Any]] = []

    for venue, assets in table.items():
        for asset, symbol in assets.items():
            if symbol:
                results.append({
                    "venue": venue,
                    "asset": asset,
                    "symbol": symbol,
                })

    return results


# =============================================================================
# Subscription Message Builders
# =============================================================================

def build_subscription_message(
    venue: VenueId,
    asset: AssetId,
    market_type: MarketType,
    channels: list[str],
) -> Optional[dict[str, Any]]:
    """
    Build the WebSocket subscription message for a venue.
    Each venue has a different subscription format.

    Args:
        venue: Target venue
        asset: Asset
        market_type: Market type
        channels: List of channels ('trades', 'ticker', 'kline')

    Returns:
        Subscription message dict or None if not supported
    """
    symbol = get_symbol(venue, asset, market_type)
    if not symbol:
        return None

    if venue == VenueId.BINANCE:
        streams = []
        base = symbol.lower()
        for ch in channels:
            if ch == "trades":
                streams.append(f"{base}@aggTrade")
            elif ch == "ticker":
                streams.append(f"{base}@ticker")
            elif ch == "kline":
                streams.append(f"{base}@kline_1m")
        return {
            "method": "SUBSCRIBE",
            "params": streams,
            "id": 1,
        }

    elif venue == VenueId.COINBASE:
        channel_names = []
        for ch in channels:
            if ch == "trades":
                channel_names.append("matches")
            elif ch == "ticker":
                channel_names.append("ticker")
            elif ch == "kline":
                channel_names.append("ticker")  # No native klines
        return {
            "type": "subscribe",
            "product_ids": [symbol],
            "channels": list(set(channel_names)),
        }

    elif venue == VenueId.KRAKEN:
        kraken_channel = "trade"  # Default
        for ch in channels:
            if ch == "trades":
                kraken_channel = "trade"
            elif ch == "ticker":
                kraken_channel = "ticker"
            elif ch == "kline":
                kraken_channel = "ohlc"
        return {
            "event": "subscribe",
            "pair": [symbol],
            "subscription": {
                "name": kraken_channel,
            },
        }

    elif venue == VenueId.OKX:
        args = []
        for ch in channels:
            if ch == "trades":
                channel = "trades"
            elif ch == "ticker":
                channel = "tickers"
            elif ch == "kline":
                channel = "candle1m"
            else:
                channel = "trades"
            args.append({
                "channel": channel,
                "instId": symbol,
            })
        return {
            "op": "subscribe",
            "args": args,
        }

    elif venue == VenueId.BYBIT:
        topics = []
        for ch in channels:
            if ch == "trades":
                topics.append(f"publicTrade.{symbol}")
            elif ch == "ticker":
                topics.append(f"tickers.{symbol}")
            elif ch == "kline":
                topics.append(f"kline.1.{symbol}")
        return {
            "op": "subscribe",
            "args": topics,
        }

    return None


# =============================================================================
# Reverse Mapping (for parsing)
# =============================================================================

def parse_venue_symbol(
    venue: VenueId,
    venue_symbol: str,
) -> Optional[dict[str, Any]]:
    """
    Parse a venue-specific symbol back to canonical (asset, market_type).
    Useful when receiving messages that contain the symbol.

    Args:
        venue: Source venue
        venue_symbol: Venue-specific symbol from message

    Returns:
        Dict with asset and market_type, or None if not found
    """
    venue_symbol_upper = venue_symbol.upper()

    # Check spot symbols
    for asset, symbol in SPOT_SYMBOLS.get(venue, {}).items():
        if symbol and venue_symbol_upper == symbol.upper():
            return {"asset": asset, "market_type": MarketType.SPOT}

    # Check perp symbols
    for asset, symbol in PERP_SYMBOLS.get(venue, {}).items():
        if symbol and venue_symbol_upper == symbol.upper():
            return {"asset": asset, "market_type": MarketType.PERP}

    return None
