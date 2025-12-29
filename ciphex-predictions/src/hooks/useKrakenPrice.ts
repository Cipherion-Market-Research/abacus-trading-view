'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ExchangePricePoint, Interval } from '@/types';

// Kraken WebSocket URL (v2)
const KRAKEN_WS_URL = 'wss://ws.kraken.com/v2';

// Kraken REST API for historical OHLC
const KRAKEN_API_URL = 'https://api.kraken.com/0/public';

// Kraken interval mapping (minutes)
const KRAKEN_INTERVAL: Record<Interval, number> = {
  '15s': 1,    // Kraken minimum is 1 minute
  '1m': 1,
  '15m': 15,
  '1h': 60,
};

// Aggregation seconds for each interval
const INTERVAL_SECONDS: Record<Interval, number> = {
  '15s': 15,
  '1m': 60,
  '15m': 900,
  '1h': 3600,
};

interface KrakenTradeData {
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  qty: number;
  ord_type: string;
  trade_id: number;
  timestamp: string;
}

interface KrakenTradeMessage {
  channel: 'trade';
  type: 'snapshot' | 'update';
  data: KrakenTradeData[];
}

interface UseKrakenPriceOptions {
  symbol: string;       // Base symbol like 'BTC'
  interval: Interval;
  enabled?: boolean;
}

interface UseKrakenPriceReturn {
  priceHistory: ExchangePricePoint[];
  currentPrice: number | null;
  connected: boolean;
  error: string | null;
}

export function useKrakenPrice({
  symbol,
  interval,
  enabled = true,
}: UseKrakenPriceOptions): UseKrakenPriceReturn {
  const [priceHistory, setPriceHistory] = useState<ExchangePricePoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevSymbolRef = useRef<string>(symbol);

  // Clear state when symbol changes to prevent stale data
  useEffect(() => {
    if (prevSymbolRef.current !== symbol) {
      setPriceHistory([]);
      setCurrentPrice(null);
      setError(null);
      prevSymbolRef.current = symbol;
    }
  }, [symbol]);

  // Build Kraken pair format (BTC -> BTC/USD)
  const krakenPair = `${symbol.toUpperCase()}/USD`;
  // REST API uses different format (BTC -> XBTUSD for BTC specifically)
  const krakenRestPair = symbol.toUpperCase() === 'BTC' ? 'XBTUSD' : `${symbol.toUpperCase()}USD`;

  // Fetch initial historical data via REST
  const fetchHistory = useCallback(async () => {
    if (!symbol || !enabled) return;

    try {
      const intervalMinutes = KRAKEN_INTERVAL[interval];

      const response = await fetch(
        `${KRAKEN_API_URL}/OHLC?pair=${krakenRestPair}&interval=${intervalMinutes}`
      );

      if (!response.ok) {
        throw new Error(`Kraken API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.error && data.error.length > 0) {
        throw new Error(data.error[0]);
      }

      // Kraken returns data in result object with pair key
      const pairKey = Object.keys(data.result).find(k => k !== 'last');
      if (pairKey && Array.isArray(data.result[pairKey])) {
        // Kraken OHLC format: [time, open, high, low, close, vwap, volume, count]
        const history: ExchangePricePoint[] = data.result[pairKey].map((candle: (string | number)[]) => ({
          time: Number(candle[0]), // Unix timestamp in seconds
          price: Number(candle[4]), // Close price (string in API)
        }));

        setPriceHistory(history);

        if (history.length > 0) {
          setCurrentPrice(history[history.length - 1].price);
        }
      }
    } catch (err) {
      console.error('Kraken history fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch Kraken data');
    }
  }, [symbol, interval, krakenRestPair, enabled]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!symbol || !enabled) {
      return;
    }

    // Fetch historical data first
    fetchHistory();

    const aggregationSeconds = INTERVAL_SECONDS[interval];

    let ws: WebSocket;
    let isCleanedUp = false;

    const connect = () => {
      if (isCleanedUp) return;

      ws = new WebSocket(KRAKEN_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isCleanedUp) return;
        setConnected(true);
        setError(null);

        // Subscribe to trade channel (v2 format)
        ws.send(JSON.stringify({
          method: 'subscribe',
          params: {
            channel: 'trade',
            symbol: [krakenPair],
            snapshot: false,
          },
        }));
      };

      ws.onmessage = (event) => {
        if (isCleanedUp) return;

        try {
          const message = JSON.parse(event.data);

          // Handle trade updates
          if (message.channel === 'trade' && (message.type === 'update' || message.type === 'snapshot')) {
            const tradeMsg = message as KrakenTradeMessage;
            const trades = tradeMsg.data;

            if (trades && trades.length > 0) {
              const latestTrade = trades[trades.length - 1];
              const tradePrice = Number(latestTrade.price);
              const tradeTime = Math.floor(new Date(latestTrade.timestamp).getTime() / 1000);
              const snappedTime = Math.floor(tradeTime / aggregationSeconds) * aggregationSeconds;

              setCurrentPrice(tradePrice);

              setPriceHistory((prev) => {
                if (prev.length === 0) {
                  return [{ time: snappedTime, price: tradePrice }];
                }

                const last = prev[prev.length - 1];

                if (last.time === snappedTime) {
                  return [...prev.slice(0, -1), { time: snappedTime, price: tradePrice }];
                } else if (snappedTime > last.time) {
                  return [...prev, { time: snappedTime, price: tradePrice }];
                }

                return prev;
              });
            }
          }
        } catch (err) {
          console.error('Kraken message parse error:', err);
        }
      };

      ws.onerror = () => {
        if (isCleanedUp) return;
        setConnected(false);
        setError('Kraken WebSocket error');
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
  }, [symbol, interval, krakenPair, enabled, fetchHistory]);

  return {
    priceHistory,
    currentPrice,
    connected,
    error,
  };
}
