'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Candle, Interval } from '@/types';

// Binance WebSocket URL for kline streams
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws';

// Binance kline WebSocket message type
interface BinanceKlineMessage {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  k: {
    t: number; // Kline start time
    T: number; // Kline close time
    s: string; // Symbol
    i: string; // Interval
    o: string; // Open price
    c: string; // Close price
    h: string; // High price
    l: string; // Low price
    v: string; // Base asset volume
    n: number; // Number of trades
    x: boolean; // Is this kline closed?
    q: string; // Quote asset volume
  };
}

// Binance aggregate trade WebSocket message type
interface BinanceAggTradeMessage {
  e: string;  // Event type: "aggTrade"
  E: number;  // Event time
  s: string;  // Symbol
  a: number;  // Aggregate trade ID
  p: string;  // Price
  q: string;  // Quantity
  f: number;  // First trade ID
  l: number;  // Last trade ID
  T: number;  // Trade time
  m: boolean; // Is buyer the maker?
}

// Combined stream wrapper message
interface BinanceCombinedMessage {
  stream: string;
  data: BinanceKlineMessage | BinanceAggTradeMessage;
}

interface UsePriceDataOptions {
  symbol: string;
  interval: Interval;
  assetType: 'crypto' | 'stock' | 'dex';
  limit?: number;
  enableStreaming?: boolean;
}

interface UsePriceDataReturn {
  candles: Candle[];
  dailyCandles: Candle[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  streaming: boolean;
}

export function usePriceData({
  symbol,
  interval,
  assetType,
  limit,
  enableStreaming = false,
}: UsePriceDataOptions): UsePriceDataReturn {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [dailyCandles, setDailyCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchPrices = useCallback(async () => {
    if (!symbol) return;

    try {
      setLoading(true);
      setError(null);

      let url: string;
      if (assetType === 'crypto' || assetType === 'dex') {
        url = `/api/prices/crypto/${symbol}?interval=${interval}`;
        if (limit) url += `&limit=${limit}`;
      } else {
        url = `/api/prices/stock/${symbol}?interval=${interval}`;
        if (limit) url += `&limit=${limit}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `Failed to fetch prices: ${response.status}`);
      }

      const data = await response.json();
      setCandles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [symbol, interval, assetType, limit]);

  // Fetch prices on mount and when interval/symbol changes
  // Clear existing candles first to avoid mixing different interval data
  useEffect(() => {
    setCandles([]); // Clear old data immediately
    fetchPrices();
  }, [fetchPrices]);

  // Fetch daily candles for 200-day EMA (only for crypto, independent of interval)
  useEffect(() => {
    if (!symbol || (assetType !== 'crypto' && assetType !== 'dex')) {
      setDailyCandles([]);
      return;
    }

    const fetchDailyPrices = async () => {
      try {
        const response = await fetch(`/api/prices/crypto/${symbol}/daily`);
        if (response.ok) {
          const data = await response.json();
          setDailyCandles(data);
        }
      } catch (err) {
        console.error('Error fetching daily candles:', err);
        // Non-critical error, don't block the main data
      }
    };

    fetchDailyPrices();
  }, [symbol, assetType]);

  // SSE streaming for stocks
  useEffect(() => {
    if (!enableStreaming || assetType !== 'stock' || !symbol) {
      return;
    }

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/prices/stock/${symbol}/stream`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setStreaming(true);
    };

    eventSource.addEventListener('candle', (event) => {
      try {
        const candle: Candle = JSON.parse(event.data);
        setCandles((prev) => {
          // Check if we should update existing candle or add new one
          const lastCandle = prev[prev.length - 1];
          if (lastCandle && lastCandle.time === candle.time) {
            // Update existing candle
            return [...prev.slice(0, -1), candle];
          } else {
            // Add new candle
            return [...prev, candle];
          }
        });
      } catch (err) {
        console.error('Error parsing candle event:', err);
      }
    });

    eventSource.addEventListener('error', (event) => {
      console.error('SSE error:', event);
      setStreaming(false);
    });

    eventSource.onerror = () => {
      setStreaming(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      setStreaming(false);
    };
  }, [enableStreaming, assetType, symbol]);

  // WebSocket streaming for crypto (Binance)
  useEffect(() => {
    if (!enableStreaming || (assetType !== 'crypto' && assetType !== 'dex') || !symbol) {
      return;
    }

    // Clean up existing connection (don't set streaming to false here -
    // we're reconnecting immediately, so keep showing "Live" during transition)
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Convert symbol format: "BTCUSDT" -> "btcusdt"
    const wsSymbol = symbol.toLowerCase();

    // All intervals use hybrid stream with kline + aggTrade for real-time updates
    const useHybridStream = true;

    // Aggregation settings per interval
    const aggregationConfig: Record<string, { seconds: number; klineInterval: string }> = {
      '15s': { seconds: 15, klineInterval: '1s' },
      '1m': { seconds: 60, klineInterval: '1m' },
      '15m': { seconds: 900, klineInterval: '15m' },
      '1h': { seconds: 3600, klineInterval: '1h' },
    };
    const config = aggregationConfig[interval] || { seconds: 60, klineInterval: interval };
    const aggregationSeconds = config.seconds;

    // Combined stream: kline for candle structure/volume, aggTrade for real-time price updates
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${wsSymbol}@kline_${config.klineInterval}/${wsSymbol}@aggTrade`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // Track if this effect has been cleaned up
    let isCleanedUp = false;

    ws.onopen = () => {
      if (!isCleanedUp) {
        setStreaming(true);
      }
    };

    ws.onmessage = (event) => {
      if (isCleanedUp) return;

      try {
        const rawMessage = JSON.parse(event.data);

        // Handle combined stream format vs single stream format
        if (useHybridStream) {
          // Combined stream wraps messages in { stream, data }
          const combined = rawMessage as BinanceCombinedMessage;
          const streamType = combined.stream;

          if (streamType.includes('@aggTrade')) {
            // Real-time trade update - update current candle's close/high/low instantly
            const trade = combined.data as BinanceAggTradeMessage;
            const tradePrice = parseFloat(trade.p);
            const tradeTime = Math.floor(trade.T / 1000);
            const candleTime = Math.floor(tradeTime / aggregationSeconds) * aggregationSeconds;

            setCandles((prev) => {
              if (prev.length === 0) return prev;

              const lastCandle = prev[prev.length - 1];

              if (lastCandle.time === candleTime) {
                // Update current candle with trade price
                const needsUpdate =
                  tradePrice !== lastCandle.close ||
                  tradePrice > lastCandle.high ||
                  tradePrice < lastCandle.low;

                if (needsUpdate) {
                  return [...prev.slice(0, -1), {
                    ...lastCandle,
                    high: Math.max(lastCandle.high, tradePrice),
                    low: Math.min(lastCandle.low, tradePrice),
                    close: tradePrice,
                  }];
                }
              } else if (candleTime > lastCandle.time) {
                // New candle started from trade
                return [...prev, {
                  time: candleTime,
                  open: tradePrice,
                  high: tradePrice,
                  low: tradePrice,
                  close: tradePrice,
                  volume: 0,
                }];
              }

              return prev;
            });
          } else if (streamType.includes('@kline')) {
            // Kline update - use for volume and to finalize candle structure
            const klineMsg = combined.data as BinanceKlineMessage;
            if (klineMsg.e !== 'kline') return;

            const kline = klineMsg.k;
            const rawTime = Math.floor(kline.t / 1000);
            const candleTime = Math.floor(rawTime / aggregationSeconds) * aggregationSeconds;

            setCandles((prev) => {
              if (prev.length === 0) return prev;

              const lastCandle = prev[prev.length - 1];

              if (lastCandle.time === candleTime) {
                // Update volume from kline data (more accurate than trade-by-trade)
                return [...prev.slice(0, -1), {
                  ...lastCandle,
                  volume: parseFloat(kline.v),
                }];
              }

              return prev;
            });
          }
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      if (!isCleanedUp) {
        setStreaming(false);
      }
    };

    ws.onclose = () => {
      // Only set offline if this wasn't an intentional cleanup (e.g., interval change)
      if (!isCleanedUp) {
        setStreaming(false);
      }
    };

    return () => {
      isCleanedUp = true;
      ws.close();
      wsRef.current = null;
      // Don't set streaming to false here - the new effect will set it to true on connect
    };
  }, [enableStreaming, assetType, symbol, interval]);

  return {
    candles,
    dailyCandles,
    loading,
    error,
    refresh: fetchPrices,
    streaming,
  };
}
