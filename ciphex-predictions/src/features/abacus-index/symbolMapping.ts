/**
 * Abacus:INDEX Symbol Mapping
 *
 * Step 0 deliverable: canonical mapping from (asset, venue, marketType) to venue-specific symbols.
 * This is the foundation for all venue integrations.
 *
 * Reference: EXCHANGE_INDEX_ANALYSIS.md Section A20
 */

import { VenueId, AssetId, MarketType } from './types';

// =============================================================================
// Symbol Mapping Tables
// =============================================================================

/**
 * Spot symbol mapping per venue
 *
 * Format varies by exchange:
 * - Binance: BTCUSDT (no separator, uppercase)
 * - Coinbase: BTC-USD (dash separator, uppercase)
 * - Kraken: XBT/USD (slash separator, XBT not BTC)
 * - OKX: BTC-USDT (dash separator)
 * - Bybit: N/A for spot in POC
 */
const SPOT_SYMBOLS: Record<VenueId, Record<AssetId, string | null>> = {
  binance: {
    BTC: 'BTCUSDT',
    ETH: 'ETHUSDT',
  },
  coinbase: {
    BTC: 'BTC-USD',
    ETH: 'ETH-USD',
  },
  kraken: {
    BTC: 'XBT/USD',
    ETH: 'ETH/USD',
  },
  okx: {
    BTC: 'BTC-USDT',
    ETH: 'ETH-USDT',
  },
  bybit: {
    BTC: null, // Bybit spot not in POC scope
    ETH: null,
  },
};

/**
 * Perpetual symbol mapping per venue
 *
 * Format varies by exchange:
 * - Binance: BTCUSDT (same as spot, different endpoint)
 * - Coinbase: N/A (no perps)
 * - Kraken: N/A for POC
 * - OKX: BTC-USDT-SWAP (SWAP suffix)
 * - Bybit: BTCUSDT (category=linear in subscription)
 */
const PERP_SYMBOLS: Record<VenueId, Record<AssetId, string | null>> = {
  binance: {
    BTC: 'BTCUSDT',
    ETH: 'ETHUSDT',
  },
  coinbase: {
    BTC: null, // No perps
    ETH: null,
  },
  kraken: {
    BTC: null, // Kraken perps not in POC
    ETH: null,
  },
  okx: {
    BTC: 'BTC-USDT-SWAP',
    ETH: 'ETH-USDT-SWAP',
  },
  bybit: {
    BTC: 'BTCUSDT',
    ETH: 'ETHUSDT',
  },
};

// =============================================================================
// WebSocket Stream Names
// =============================================================================

/**
 * Get the WebSocket stream/channel name for subscribing
 * This is often different from the symbol itself
 */
const WS_STREAM_FORMATTERS: Record<VenueId, {
  spot?: (symbol: string, asset: AssetId) => string;
  perp?: (symbol: string, asset: AssetId) => string;
}> = {
  binance: {
    // Binance uses lowercase streams: btcusdt@aggTrade, btcusdt@kline_1m
    spot: (symbol) => symbol.toLowerCase(),
    perp: (symbol) => symbol.toLowerCase(),
  },
  coinbase: {
    // Coinbase uses symbol directly in subscription message
    spot: (symbol) => symbol,
  },
  kraken: {
    // Kraken uses symbol directly, but watch for XBT
    spot: (symbol) => symbol,
  },
  okx: {
    // OKX uses instId in subscription: { instId: "BTC-USDT" }
    spot: (symbol) => symbol,
    perp: (symbol) => symbol,
  },
  bybit: {
    // Bybit uses symbol in topic: "tickers.BTCUSDT"
    perp: (symbol) => symbol,
  },
};

// =============================================================================
// Public API
// =============================================================================

/**
 * Get the venue-specific symbol for an asset and market type
 *
 * @param venue - Target venue
 * @param asset - Asset (BTC, ETH)
 * @param marketType - Market type (spot, perp)
 * @returns Venue-specific symbol or null if not supported
 *
 * @example
 * getSymbol('binance', 'BTC', 'spot')  // 'BTCUSDT'
 * getSymbol('okx', 'BTC', 'perp')      // 'BTC-USDT-SWAP'
 * getSymbol('kraken', 'BTC', 'spot')   // 'XBT/USD'
 * getSymbol('coinbase', 'BTC', 'perp') // null (not supported)
 */
export function getSymbol(
  venue: VenueId,
  asset: AssetId,
  marketType: MarketType
): string | null {
  const table = marketType === 'spot' ? SPOT_SYMBOLS : PERP_SYMBOLS;
  return table[venue]?.[asset] ?? null;
}

/**
 * Get the WebSocket stream/channel name for subscribing
 *
 * @param venue - Target venue
 * @param asset - Asset
 * @param marketType - Market type
 * @returns Stream name for WS subscription or null if not supported
 *
 * @example
 * getStreamName('binance', 'BTC', 'spot')  // 'btcusdt'
 * getStreamName('okx', 'BTC', 'perp')      // 'BTC-USDT-SWAP'
 */
export function getStreamName(
  venue: VenueId,
  asset: AssetId,
  marketType: MarketType
): string | null {
  const symbol = getSymbol(venue, asset, marketType);
  if (!symbol) return null;

  const formatter = WS_STREAM_FORMATTERS[venue]?.[marketType];
  if (!formatter) return symbol;

  return formatter(symbol, asset);
}

/**
 * Check if a venue supports a given market type
 */
export function venueSupportsMarket(venue: VenueId, marketType: MarketType): boolean {
  const table = marketType === 'spot' ? SPOT_SYMBOLS : PERP_SYMBOLS;
  // Check if any asset is supported (not null)
  return Object.values(table[venue] ?? {}).some((s) => s !== null);
}

/**
 * Check if a venue supports a specific asset and market type
 */
export function venueSupportsAsset(
  venue: VenueId,
  asset: AssetId,
  marketType: MarketType
): boolean {
  return getSymbol(venue, asset, marketType) !== null;
}

/**
 * Get all supported venue/asset combinations for a market type
 */
export function getSupportedCombinations(marketType: MarketType): Array<{
  venue: VenueId;
  asset: AssetId;
  symbol: string;
}> {
  const table = marketType === 'spot' ? SPOT_SYMBOLS : PERP_SYMBOLS;
  const results: Array<{ venue: VenueId; asset: AssetId; symbol: string }> = [];

  for (const [venue, assets] of Object.entries(table) as [VenueId, Record<AssetId, string | null>][]) {
    for (const [asset, symbol] of Object.entries(assets) as [AssetId, string | null][]) {
      if (symbol) {
        results.push({ venue, asset, symbol });
      }
    }
  }

  return results;
}

// =============================================================================
// Subscription Message Builders
// =============================================================================

/**
 * Build the WebSocket subscription message for a venue
 * Each venue has a different subscription format
 */
export function buildSubscriptionMessage(
  venue: VenueId,
  asset: AssetId,
  marketType: MarketType,
  channels: ('trades' | 'ticker' | 'kline')[]
): object | null {
  const symbol = getSymbol(venue, asset, marketType);
  if (!symbol) return null;

  switch (venue) {
    case 'binance': {
      // Binance combined stream subscription is done via URL, not message
      // For single stream, use: { method: "SUBSCRIBE", params: [...], id: 1 }
      const streams = channels.map((ch) => {
        const base = symbol.toLowerCase();
        switch (ch) {
          case 'trades': return `${base}@aggTrade`;
          case 'ticker': return `${base}@ticker`;
          case 'kline': return `${base}@kline_1m`;
        }
      });
      return {
        method: 'SUBSCRIBE',
        params: streams,
        id: Date.now(),
      };
    }

    case 'coinbase': {
      // Coinbase subscription message
      const channelNames = channels.map((ch) => {
        switch (ch) {
          case 'trades': return 'matches';
          case 'ticker': return 'ticker';
          case 'kline': return 'ticker'; // Coinbase doesn't have native klines
        }
      });
      return {
        type: 'subscribe',
        product_ids: [symbol],
        channels: [...new Set(channelNames)],
      };
    }

    case 'kraken': {
      // Kraken subscription message
      const krakenChannels = channels.map((ch) => {
        switch (ch) {
          case 'trades': return 'trade';
          case 'ticker': return 'ticker';
          case 'kline': return 'ohlc';
        }
      });
      return {
        event: 'subscribe',
        pair: [symbol],
        subscription: {
          name: krakenChannels[0], // Kraken subscribes to one channel at a time
        },
      };
    }

    case 'okx': {
      // OKX subscription message
      const args = channels.map((ch) => {
        let channel: string;
        switch (ch) {
          case 'trades': channel = 'trades'; break;
          case 'ticker': channel = 'tickers'; break;
          case 'kline': channel = 'candle1m'; break;
          default: channel = 'trades';
        }
        return {
          channel,
          instId: symbol,
        };
      });
      return {
        op: 'subscribe',
        args,
      };
    }

    case 'bybit': {
      // Bybit subscription message (v5 API)
      const topics = channels.map((ch) => {
        switch (ch) {
          case 'trades': return `publicTrade.${symbol}`;
          case 'ticker': return `tickers.${symbol}`;
          case 'kline': return `kline.1.${symbol}`;
        }
      });
      return {
        op: 'subscribe',
        args: topics,
      };
    }

    default:
      return null;
  }
}

// =============================================================================
// Reverse Mapping (for parsing)
// =============================================================================

/**
 * Parse a venue-specific symbol back to canonical (asset, marketType)
 * Useful when receiving messages that contain the symbol
 */
export function parseVenueSymbol(
  venue: VenueId,
  venueSymbol: string
): { asset: AssetId; marketType: MarketType } | null {
  // Check spot symbols
  for (const [asset, symbol] of Object.entries(SPOT_SYMBOLS[venue] ?? {})) {
    if (symbol && venueSymbol.toUpperCase() === symbol.toUpperCase()) {
      return { asset: asset as AssetId, marketType: 'spot' };
    }
  }

  // Check perp symbols
  for (const [asset, symbol] of Object.entries(PERP_SYMBOLS[venue] ?? {})) {
    if (symbol && venueSymbol.toUpperCase() === symbol.toUpperCase()) {
      return { asset: asset as AssetId, marketType: 'perp' };
    }
  }

  return null;
}
