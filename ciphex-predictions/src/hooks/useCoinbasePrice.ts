'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ExchangePricePoint, Interval } from '@/types';

// Coinbase WebSocket URL
const COINBASE_WS_URL = 'wss://ws-feed.exchange.coinbase.com';

// Coinbase REST API for historical candles
const COINBASE_API_URL = 'https://api.exchange.coinbase.com';

// Coinbase granularity mapping (our intervals -> Coinbase seconds)
const COINBASE_GRANULARITY: Record<Interval, number> = {
  '15s': 60,    // Coinbase minimum is 60s, we'll use that
  '1m': 60,
  '15m': 900,
  '1h': 3600,
};

// Aggregation seconds for each interval
const INTERVAL_SECONDS: Record<Interval, number> = {
  '15s': 15,
  '1m': 60,
  '15m': 900,
  '1h': 3600,
};

interface CoinbaseMatchMessage {
  type: 'match' | 'last_match';
  trade_id: number;
  maker_order_id: string;
  taker_order_id: string;
  side: 'buy' | 'sell';
  size: string;
  price: string;
  product_id: string;
  sequence: number;
  time: string;
}

interface UseCoinbasePriceOptions {
  symbol: string;       // Base symbol like 'BTC'
  interval: Interval;
  enabled?: boolean;
}

interface UseCoinbasePriceReturn {
  priceHistory: ExchangePricePoint[];
  currentPrice: number | null;
  connected: boolean;
  error: string | null;
}

export function useCoinbasePrice({
  symbol,
  interval,
  enabled = true,
}: UseCoinbasePriceOptions): UseCoinbasePriceReturn {
  const [priceHistory, setPriceHistory] = useState<ExchangePricePoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial historical data via REST
  const fetchHistory = useCallback(async () => {
    if (!symbol || !enabled) return;

    try {
      const productId = `${symbol.toUpperCase()}-USD`;
      const granularity = COINBASE_GRANULARITY[interval];

      // Coinbase returns max 300 candles
      const response = await fetch(
        `${COINBASE_API_URL}/products/${productId}/candles?granularity=${granularity}`
      );

      if (!response.ok) {
        throw new Error(`Coinbase API error: ${response.status}`);
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        // Coinbase returns [time, low, high, open, close, volume] arrays
        // Data is newest first, reverse for chronological order
        const history: ExchangePricePoint[] = data
          .reverse()
          .map((candle: number[]) => ({
            time: candle[0], // Unix timestamp in seconds
            price: candle[4], // Close price
          }));

        setPriceHistory(history);

        if (history.length > 0) {
          setCurrentPrice(history[history.length - 1].price);
        }
      }
    } catch (err) {
      console.error('Coinbase history fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch Coinbase data');
    }
  }, [symbol, interval, enabled]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!symbol || !enabled) {
      return;
    }

    // Fetch historical data first
    fetchHistory();

    const productId = `${symbol.toUpperCase()}-USD`;
    const aggregationSeconds = INTERVAL_SECONDS[interval];

    let ws: WebSocket;
    let isCleanedUp = false;

    const connect = () => {
      if (isCleanedUp) return;

      ws = new WebSocket(COINBASE_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isCleanedUp) return;
        setConnected(true);
        setError(null);

        // Subscribe to matches channel
        ws.send(JSON.stringify({
          type: 'subscribe',
          product_ids: [productId],
          channels: ['matches'],
        }));
      };

      ws.onmessage = (event) => {
        if (isCleanedUp) return;

        try {
          const message = JSON.parse(event.data);

          // Handle match messages (trades)
          if (message.type === 'match' || message.type === 'last_match') {
            const match = message as CoinbaseMatchMessage;
            const tradePrice = parseFloat(match.price);
            const tradeTime = Math.floor(new Date(match.time).getTime() / 1000);
            const snappedTime = Math.floor(tradeTime / aggregationSeconds) * aggregationSeconds;

            setCurrentPrice(tradePrice);

            setPriceHistory((prev) => {
              if (prev.length === 0) {
                return [{ time: snappedTime, price: tradePrice }];
              }

              const last = prev[prev.length - 1];

              if (last.time === snappedTime) {
                // Update existing candle
                return [...prev.slice(0, -1), { time: snappedTime, price: tradePrice }];
              } else if (snappedTime > last.time) {
                // New candle
                return [...prev, { time: snappedTime, price: tradePrice }];
              }

              return prev;
            });
          }
        } catch (err) {
          console.error('Coinbase message parse error:', err);
        }
      };

      ws.onerror = () => {
        if (isCleanedUp) return;
        setConnected(false);
        setError('Coinbase WebSocket error');
      };

      ws.onclose = () => {
        if (isCleanedUp) return;
        setConnected(false);

        // Reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isCleanedUp) {
            connect();
          }
        }, 5000);
      };
    };

    connect();

    return () => {
      isCleanedUp = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
    };
  }, [symbol, interval, enabled, fetchHistory]);

  return {
    priceHistory,
    currentPrice,
    connected,
    error,
  };
}
