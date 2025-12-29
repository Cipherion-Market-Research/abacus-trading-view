'use client';

import { useMemo } from 'react';
import { ExchangePricePoint } from '@/types';

/**
 * Composite Index Hook
 *
 * Calculates a TradingView-style INDEX price by averaging prices from 4 USD exchanges.
 * Matches TradingView's INDEX:BTCUSD formula exactly:
 * (BITSTAMP:BTCUSD + COINBASE:BTCUSD + BITFINEX:BTCUSD + KRAKEN:BTCUSD) / 4
 *
 * Source: https://www.tradingview.com/support/solutions/43000659124-how-is-the-btc-index-being-calculated/
 */

interface ExchangePrice {
  currentPrice: number | null;
  priceHistory: ExchangePricePoint[];
  connected: boolean;
}

interface UseCompositeIndexOptions {
  bitstamp: ExchangePrice;
  coinbase: ExchangePrice;
  bitfinex: ExchangePrice;
  kraken: ExchangePrice;
  enabled?: boolean;
}

interface UseCompositeIndexReturn {
  currentPrice: number | null;
  priceHistory: ExchangePricePoint[];
  sources: {
    name: string;
    price: number | null;
    connected: boolean;
    weight: number;
  }[];
  connectedCount: number;
}

export function useCompositeIndex({
  bitstamp,
  coinbase,
  bitfinex,
  kraken,
  enabled = true,
}: UseCompositeIndexOptions): UseCompositeIndexReturn {

  // Check if ALL 4 exchanges have their WebSocket connections live
  // This is the GATE for all INDEX calculations - nothing is returned until all 4 are live
  const allExchangesConnected = useMemo(() => {
    return bitstamp.connected && coinbase.connected && bitfinex.connected && kraken.connected;
  }, [bitstamp.connected, coinbase.connected, bitfinex.connected, kraken.connected]);

  // Calculate current composite price (average of all 4 USD exchange prices)
  // TradingView formula: (Bitstamp + Coinbase + Bitfinex + Kraken) / 4
  // IMPORTANT: Only return price when ALL 4 exchanges are CONNECTED (WebSocket live)
  // This prevents chart distortion from partial data with large spreads
  const { currentPrice, sources, connectedCount } = useMemo(() => {
    // Order matches TradingView's INDEX:BTCUSD formula
    const exchanges = [
      { name: 'Bitstamp', data: bitstamp },
      { name: 'Coinbase', data: coinbase },
      { name: 'Bitfinex', data: bitfinex },
      { name: 'Kraken', data: kraken },
    ];

    const connectedExchanges = exchanges.filter(e => e.data.connected).length;

    // CRITICAL: Don't calculate anything unless enabled AND all 4 exchanges are connected
    if (!enabled || !allExchangesConnected) {
      const sourceInfo = exchanges.map(ex => ({
        name: ex.name,
        price: ex.data.currentPrice,
        connected: ex.data.connected,
        weight: 0,
      }));
      return { currentPrice: null, sources: sourceInfo, connectedCount: connectedExchanges };
    }

    const validPrices: number[] = [];
    const sourceInfo = exchanges.map(ex => {
      const hasValidPrice = ex.data.currentPrice !== null && ex.data.currentPrice > 0;
      if (hasValidPrice) {
        validPrices.push(ex.data.currentPrice!);
      }
      return {
        name: ex.name,
        price: ex.data.currentPrice,
        connected: ex.data.connected,
        weight: hasValidPrice ? 0.25 : 0, // Each exchange is 1/4 of INDEX
      };
    });

    const count = validPrices.length;

    // Only calculate INDEX when ALL 4 exchanges have valid prices
    // This ensures the formula is always (Bitstamp + Coinbase + Bitfinex + Kraken) / 4
    const avgPrice = count === 4
      ? validPrices.reduce((sum, p) => sum + p, 0) / 4
      : null;

    return {
      currentPrice: avgPrice,
      sources: sourceInfo,
      connectedCount: connectedExchanges,
    };
  }, [bitstamp, coinbase, bitfinex, kraken, enabled, allExchangesConnected]);

  // Calculate composite price history by averaging prices at each timestamp
  // CRITICAL: Only calculate when ALL 4 exchanges have live WebSocket connections
  const priceHistory = useMemo(() => {
    // GATE: Return empty array unless enabled AND all 4 exchanges are connected
    // This prevents the chart from receiving ANY INDEX data until all feeds are live
    if (!enabled || !allExchangesConnected) return [];

    const exchanges = [bitstamp, coinbase, bitfinex, kraken];

    // Verify all exchanges have price history data
    const allHaveHistory = exchanges.every(ex => ex.priceHistory.length > 0);
    if (!allHaveHistory) return [];

    // Collect all unique timestamps from all exchanges
    const allTimestamps = new Set<number>();
    exchanges.forEach(ex => {
      ex.priceHistory.forEach(p => {
        if (p.price > 0) {
          allTimestamps.add(p.time);
        }
      });
    });

    if (allTimestamps.size === 0) return [];

    // Sort timestamps chronologically
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    // For each timestamp, calculate the average of available prices
    // Use last known price if an exchange doesn't have data at that exact timestamp
    const lastKnownPrices: (number | null)[] = exchanges.map(() => null);

    const result: ExchangePricePoint[] = [];

    for (const timestamp of sortedTimestamps) {
      const pricesAtTime: number[] = [];

      exchanges.forEach((ex, idx) => {
        // Find price at this timestamp or use last known
        const pricePoint = ex.priceHistory.find(p => p.time === timestamp);
        if (pricePoint && pricePoint.price > 0) {
          lastKnownPrices[idx] = pricePoint.price;
        }

        // Use last known price if available and valid
        if (lastKnownPrices[idx] !== null && lastKnownPrices[idx]! > 0) {
          pricesAtTime.push(lastKnownPrices[idx]!);
        }
      });

      // Only add point if ALL 4 exchanges have valid data
      if (pricesAtTime.length === 4) {
        const avgPrice = pricesAtTime.reduce((sum, p) => sum + p, 0) / 4;

        // Sanity check: verify prices are within reasonable spread (max 10% deviation)
        // This prevents chart distortion from one exchange having bad/stale data
        const maxDeviation = Math.max(...pricesAtTime.map(p => Math.abs(p - avgPrice) / avgPrice));

        // Only include this point if all prices are within 10% of the average
        if (maxDeviation <= 0.10) {
          result.push({ time: timestamp, price: avgPrice });
        }
      }
    }

    return result;
  }, [bitstamp, coinbase, bitfinex, kraken, enabled, allExchangesConnected]);

  return {
    currentPrice,
    priceHistory,
    sources,
    connectedCount,
  };
}
