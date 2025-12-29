'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ExchangePricePoint, Interval } from '@/types';

// Gemini WebSocket URL (v2 marketdata)
const GEMINI_WS_URL = 'wss://api.gemini.com/v2/marketdata';

// Gemini REST API for historical candles
const GEMINI_API_URL = 'https://api.gemini.com/v2';

// Gemini candle time frame mapping
const GEMINI_TIMEFRAME: Record<Interval, string> = {
  '15s': '1m',    // Gemini minimum is 1m
  '1m': '1m',
  '15m': '15m',
  '1h': '1hr',
};

// Aggregation seconds for each interval
const INTERVAL_SECONDS: Record<Interval, number> = {
  '15s': 15,
  '1m': 60,
  '15m': 900,
  '1h': 3600,
};

interface GeminiCandleUpdate {
  type: 'candles_1m_updates' | 'candles_5m_updates' | 'candles_15m_updates' | 'candles_1hr_updates';
  symbol: string;
  changes: Array<[
    number,  // time (ms)
    number,  // open
    number,  // high
    number,  // low
    number,  // close
    number   // volume
  ]>;
}

interface GeminiTradeUpdate {
  type: 'trade';
  symbol: string;
  event_id: number;
  timestamp: number;
  price: string;
  quantity: string;
  side: 'buy' | 'sell';
}

interface UseGeminiPriceOptions {
  symbol: string;       // Base symbol like 'BTC'
  interval: Interval;
  enabled?: boolean;
}

interface UseGeminiPriceReturn {
  priceHistory: ExchangePricePoint[];
  currentPrice: number | null;
  connected: boolean;
  error: string | null;
}

export function useGeminiPrice({
  symbol,
  interval,
  enabled = true,
}: UseGeminiPriceOptions): UseGeminiPriceReturn {
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

  // Fetch initial historical data via REST
  const fetchHistory = useCallback(async () => {
    if (!symbol || !enabled) return;

    try {
      const geminiSymbol = `${symbol.toLowerCase()}usd`;
      const timeframe = GEMINI_TIMEFRAME[interval];

      const response = await fetch(
        `${GEMINI_API_URL}/candles/${geminiSymbol}/${timeframe}`
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        // Gemini returns [time, open, high, low, close, volume] arrays
        // Data is newest first, reverse for chronological order
        const history: ExchangePricePoint[] = data
          .reverse()
          .map((candle: number[]) => ({
            time: Math.floor(candle[0] / 1000), // Convert ms to seconds
            price: candle[4], // Close price
          }));

        setPriceHistory(history);

        if (history.length > 0) {
          setCurrentPrice(history[history.length - 1].price);
        }
      }
    } catch (err) {
      console.error('Gemini history fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch Gemini data');
    }
  }, [symbol, interval, enabled]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!symbol || !enabled) {
      return;
    }

    // Fetch historical data first
    fetchHistory();

    const geminiSymbol = `${symbol.toUpperCase()}USD`;
    const aggregationSeconds = INTERVAL_SECONDS[interval];

    let ws: WebSocket;
    let isCleanedUp = false;

    const connect = () => {
      if (isCleanedUp) return;

      ws = new WebSocket(GEMINI_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isCleanedUp) return;
        setConnected(true);
        setError(null);

        // Subscribe to trades for real-time price updates
        ws.send(JSON.stringify({
          type: 'subscribe',
          subscriptions: [
            {
              name: 'l2',
              symbols: [geminiSymbol],
            },
          ],
        }));
      };

      ws.onmessage = (event) => {
        if (isCleanedUp) return;

        try {
          const message = JSON.parse(event.data);

          // Handle trade updates
          if (message.type === 'trade') {
            const trade = message as GeminiTradeUpdate;
            const tradePrice = parseFloat(trade.price);
            const tradeTime = Math.floor(trade.timestamp / 1000);
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

          // Handle candle updates (if available for the timeframe)
          if (message.type && message.type.startsWith('candles_') && message.changes) {
            const candleUpdate = message as GeminiCandleUpdate;
            const changes = candleUpdate.changes;

            if (changes.length > 0) {
              const latestCandle = changes[0];
              const candleTime = Math.floor(latestCandle[0] / 1000);
              const closePrice = latestCandle[4];
              const snappedTime = Math.floor(candleTime / aggregationSeconds) * aggregationSeconds;

              setCurrentPrice(closePrice);

              setPriceHistory((prev) => {
                if (prev.length === 0) {
                  return [{ time: snappedTime, price: closePrice }];
                }

                const last = prev[prev.length - 1];

                if (last.time === snappedTime) {
                  return [...prev.slice(0, -1), { time: snappedTime, price: closePrice }];
                } else if (snappedTime > last.time) {
                  return [...prev, { time: snappedTime, price: closePrice }];
                }

                return prev;
              });
            }
          }
        } catch (err) {
          console.error('Gemini message parse error:', err);
        }
      };

      ws.onerror = () => {
        if (isCleanedUp) return;
        setConnected(false);
        setError('Gemini WebSocket error');
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
