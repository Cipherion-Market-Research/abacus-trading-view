'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ExchangePricePoint, Interval } from '@/types';
import pako from 'pako';

// HTX WebSocket URL
const HTX_WS_URL = 'wss://api.huobi.pro/ws';

// HTX interval mapping (our intervals -> HTX kline periods)
const HTX_INTERVAL_MAP: Record<Interval, string> = {
  '15s': '1min',  // HTX doesn't have 15s, use 1min and track trades
  '1m': '1min',
  '15m': '15min',
  '1h': '60min',
};

// Aggregation seconds for each interval
const INTERVAL_SECONDS: Record<Interval, number> = {
  '15s': 15,
  '1m': 60,
  '15m': 900,
  '1h': 3600,
};

interface HTXKlineMessage {
  ch: string;
  ts: number;
  tick: {
    id: number;
    open: number;
    close: number;
    low: number;
    high: number;
    amount: number;
    vol: number;
    count: number;
  };
}

interface HTXTradeMessage {
  ch: string;
  ts: number;
  tick: {
    id: number;
    ts: number;
    data: Array<{
      id: number;
      ts: number;
      tradeId: number;
      amount: number;
      price: number;
      direction: 'buy' | 'sell';
    }>;
  };
}

interface HTXPingMessage {
  ping: number;
}

interface UseHTXPriceOptions {
  symbol: string;       // Base symbol like 'BTC' (not 'BTCUSDT')
  interval: Interval;
  enabled?: boolean;
}

interface UseHTXPriceReturn {
  priceHistory: ExchangePricePoint[];
  currentPrice: number | null;
  connected: boolean;
  error: string | null;
}

export function useHTXPrice({
  symbol,
  interval,
  enabled = true,
}: UseHTXPriceOptions): UseHTXPriceReturn {
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
      const htxSymbol = `${symbol.toLowerCase()}usdt`;
      const htxInterval = HTX_INTERVAL_MAP[interval];
      const size = 300; // Get 300 candles of history

      const response = await fetch(
        `https://api.huobi.pro/market/history/kline?symbol=${htxSymbol}&period=${htxInterval}&size=${size}`
      );

      if (!response.ok) {
        throw new Error(`HTX API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'ok' && Array.isArray(data.data)) {
        // HTX returns data newest first, reverse for chronological order
        const history: ExchangePricePoint[] = data.data
          .reverse()
          .map((k: { id: number; close: number }) => ({
            time: k.id, // Unix timestamp in seconds
            price: k.close,
          }));

        setPriceHistory(history);

        if (history.length > 0) {
          setCurrentPrice(history[history.length - 1].price);
        }
      }
    } catch (err) {
      console.error('HTX history fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch HTX data');
    }
  }, [symbol, interval, enabled]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!symbol || !enabled) {
      return;
    }

    // Fetch historical data first
    fetchHistory();

    const htxSymbol = `${symbol.toLowerCase()}usdt`;
    const htxInterval = HTX_INTERVAL_MAP[interval];
    const aggregationSeconds = INTERVAL_SECONDS[interval];

    let ws: WebSocket;
    let isCleanedUp = false;

    const connect = () => {
      if (isCleanedUp) return;

      ws = new WebSocket(HTX_WS_URL);
      wsRef.current = ws;

      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        if (isCleanedUp) return;
        setConnected(true);
        setError(null);

        // Subscribe to kline channel
        ws.send(JSON.stringify({
          sub: `market.${htxSymbol}.kline.${htxInterval}`,
          id: `kline_${htxSymbol}_${htxInterval}`,
        }));

        // Also subscribe to trade channel for real-time updates (especially for 15s)
        ws.send(JSON.stringify({
          sub: `market.${htxSymbol}.trade.detail`,
          id: `trade_${htxSymbol}`,
        }));
      };

      ws.onmessage = (event) => {
        if (isCleanedUp) return;

        try {
          // HTX sends gzip compressed messages
          const data = event.data as ArrayBuffer;
          const decompressed = pako.ungzip(new Uint8Array(data), { to: 'string' });
          const message = JSON.parse(decompressed);

          // Handle ping/pong keepalive
          if ('ping' in message) {
            const pingMsg = message as HTXPingMessage;
            ws.send(JSON.stringify({ pong: pingMsg.ping }));
            return;
          }

          // Handle kline updates
          if (message.ch && message.ch.includes('.kline.')) {
            const klineMsg = message as HTXKlineMessage;
            const closePrice = klineMsg.tick.close;
            const candleTime = klineMsg.tick.id;

            // Snap to our interval grid
            const snappedTime = Math.floor(candleTime / aggregationSeconds) * aggregationSeconds;

            setCurrentPrice(closePrice);

            setPriceHistory((prev) => {
              if (prev.length === 0) {
                return [{ time: snappedTime, price: closePrice }];
              }

              const last = prev[prev.length - 1];

              if (last.time === snappedTime) {
                // Update existing candle
                return [...prev.slice(0, -1), { time: snappedTime, price: closePrice }];
              } else if (snappedTime > last.time) {
                // New candle
                return [...prev, { time: snappedTime, price: closePrice }];
              }

              return prev;
            });
          }

          // Handle trade updates for more real-time price (especially useful for 15s)
          if (message.ch && message.ch.includes('.trade.detail')) {
            const tradeMsg = message as HTXTradeMessage;
            const trades = tradeMsg.tick?.data;

            if (trades && trades.length > 0) {
              const latestTrade = trades[trades.length - 1];
              const tradePrice = latestTrade.price;
              const tradeTime = Math.floor(latestTrade.ts / 1000);
              const snappedTime = Math.floor(tradeTime / aggregationSeconds) * aggregationSeconds;

              setCurrentPrice(tradePrice);

              setPriceHistory((prev) => {
                if (prev.length === 0) {
                  return [{ time: snappedTime, price: tradePrice }];
                }

                const last = prev[prev.length - 1];

                if (last.time === snappedTime) {
                  // Update existing point
                  return [...prev.slice(0, -1), { time: snappedTime, price: tradePrice }];
                } else if (snappedTime > last.time) {
                  // New point
                  return [...prev, { time: snappedTime, price: tradePrice }];
                }

                return prev;
              });
            }
          }
        } catch (err) {
          console.error('HTX message parse error:', err);
        }
      };

      ws.onerror = () => {
        if (isCleanedUp) return;
        setConnected(false);
        setError('HTX WebSocket error');
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
