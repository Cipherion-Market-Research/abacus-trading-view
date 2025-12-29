'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ExchangePricePoint, Interval } from '@/types';

// Crypto.com WebSocket URL
const CRYPTO_COM_WS_URL = 'wss://stream.crypto.com/exchange/v1/market';

// Crypto.com REST API for historical candles
const CRYPTO_COM_API_URL = 'https://api.crypto.com/exchange/v1/public';

// Crypto.com timeframe mapping
const CRYPTO_COM_TIMEFRAME: Record<Interval, string> = {
  '15s': '1m',    // Crypto.com minimum is 1m
  '1m': '1m',
  '15m': '15m',
  '1h': '1h',
};

// Aggregation seconds for each interval
const INTERVAL_SECONDS: Record<Interval, number> = {
  '15s': 15,
  '1m': 60,
  '15m': 900,
  '1h': 3600,
};

interface CryptoComCandlestickData {
  t: number;    // End time of candlestick (Unix timestamp in ms)
  o: number;    // Open
  h: number;    // High
  l: number;    // Low
  c: number;    // Close
  v: number;    // Volume
}

interface CryptoComCandlestickMessage {
  id: number;
  method: string;
  code: number;
  result?: {
    channel: string;
    subscription: string;
    data: CryptoComCandlestickData[];
  };
}

interface CryptoComTradeMessage {
  id: number;
  method: string;
  code: number;
  result?: {
    channel: string;
    subscription: string;
    data: Array<{
      d: string;    // Trade ID
      t: number;    // Trade timestamp (ms)
      p: string;    // Trade price
      q: string;    // Trade quantity
      s: string;    // Side: BUY or SELL
    }>;
  };
}

export type QuoteCurrency = 'USD' | 'USDT';

interface UseCryptoComPriceOptions {
  symbol: string;           // Base symbol like 'BTC'
  interval: Interval;
  quoteCurrency: QuoteCurrency;
  enabled?: boolean;
}

interface UseCryptoComPriceReturn {
  priceHistory: ExchangePricePoint[];
  currentPrice: number | null;
  connected: boolean;
  error: string | null;
}

export function useCryptoComPrice({
  symbol,
  interval,
  quoteCurrency,
  enabled = true,
}: UseCryptoComPriceOptions): UseCryptoComPriceReturn {
  const [priceHistory, setPriceHistory] = useState<ExchangePricePoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
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

  // Build instrument name
  const instrumentName = `${symbol.toUpperCase()}_${quoteCurrency}`;

  // Fetch initial historical data via REST
  const fetchHistory = useCallback(async () => {
    if (!symbol || !enabled) return;

    try {
      const timeframe = CRYPTO_COM_TIMEFRAME[interval];

      const response = await fetch(
        `${CRYPTO_COM_API_URL}/get-candlestick?instrument_name=${instrumentName}&timeframe=${timeframe}&count=300`
      );

      if (!response.ok) {
        throw new Error(`Crypto.com API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.result?.data && Array.isArray(data.result.data)) {
        // Crypto.com returns candles oldest first
        // Note: Crypto.com API may return prices as strings, so convert to numbers
        const history: ExchangePricePoint[] = data.result.data.map((candle: CryptoComCandlestickData) => ({
          time: Math.floor(candle.t / 1000), // Convert ms to seconds
          price: Number(candle.c), // Close price - ensure it's a number
        }));

        setPriceHistory(history);

        if (history.length > 0) {
          setCurrentPrice(Number(history[history.length - 1].price));
        }
      }
    } catch (err) {
      console.error('Crypto.com history fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch Crypto.com data');
    }
  }, [symbol, interval, instrumentName, enabled]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!symbol || !enabled) {
      return;
    }

    // Fetch historical data first
    fetchHistory();

    const timeframe = CRYPTO_COM_TIMEFRAME[interval];
    const aggregationSeconds = INTERVAL_SECONDS[interval];

    let ws: WebSocket;
    let isCleanedUp = false;
    let requestId = 1;

    const connect = () => {
      if (isCleanedUp) return;

      ws = new WebSocket(CRYPTO_COM_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isCleanedUp) return;

        // Crypto.com recommends 1 second delay before sending requests
        setTimeout(() => {
          if (isCleanedUp || ws.readyState !== WebSocket.OPEN) return;

          setConnected(true);
          setError(null);

          // Subscribe to candlestick channel
          ws.send(JSON.stringify({
            id: requestId++,
            method: 'subscribe',
            params: {
              channels: [`candlestick.${timeframe}.${instrumentName}`],
            },
          }));

          // Subscribe to trade channel for real-time updates
          ws.send(JSON.stringify({
            id: requestId++,
            method: 'subscribe',
            params: {
              channels: [`trade.${instrumentName}`],
            },
          }));
        }, 1000);

        // Set up heartbeat (ping every 30 seconds)
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              id: requestId++,
              method: 'public/heartbeat',
            }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        if (isCleanedUp) return;

        try {
          const message = JSON.parse(event.data);

          // Handle heartbeat response
          if (message.method === 'public/heartbeat') {
            // Respond to heartbeat
            ws.send(JSON.stringify({
              id: message.id,
              method: 'public/respond-heartbeat',
            }));
            return;
          }

          // Handle candlestick updates
          if (message.result?.channel?.startsWith('candlestick.')) {
            const candleMsg = message as CryptoComCandlestickMessage;
            const candles = candleMsg.result?.data;

            if (candles && candles.length > 0) {
              const latestCandle = candles[candles.length - 1];
              const candleTime = Math.floor(latestCandle.t / 1000);
              const closePrice = Number(latestCandle.c); // Ensure number
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

          // Handle trade updates
          if (message.result?.channel?.startsWith('trade.')) {
            const tradeMsg = message as CryptoComTradeMessage;
            const trades = tradeMsg.result?.data;

            if (trades && trades.length > 0) {
              const latestTrade = trades[trades.length - 1];
              const tradePrice = parseFloat(latestTrade.p);
              const tradeTime = Math.floor(latestTrade.t / 1000);
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
          console.error('Crypto.com message parse error:', err);
        }
      };

      ws.onerror = () => {
        if (isCleanedUp) return;
        setConnected(false);
        setError('Crypto.com WebSocket error');
      };

      ws.onclose = () => {
        if (isCleanedUp) return;
        setConnected(false);

        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
        }

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
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
    };
  }, [symbol, interval, instrumentName, enabled, fetchHistory]);

  return {
    priceHistory,
    currentPrice,
    connected,
    error,
  };
}
