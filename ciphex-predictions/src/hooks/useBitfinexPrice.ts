'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ExchangePricePoint, Interval } from '@/types';

// Bitfinex WebSocket URL (public)
const BITFINEX_WS_URL = 'wss://api-pub.bitfinex.com/ws/2';

// Aggregation seconds for each interval
const INTERVAL_SECONDS: Record<Interval, number> = {
  '15s': 15,
  '1m': 60,
  '15m': 900,
  '1h': 3600,
};

interface UseBitfinexPriceOptions {
  symbol: string;       // Base symbol like 'BTC'
  interval: Interval;
  enabled?: boolean;
}

interface UseBitfinexPriceReturn {
  priceHistory: ExchangePricePoint[];
  currentPrice: number | null;
  connected: boolean;
  error: string | null;
}

export function useBitfinexPrice({
  symbol,
  interval,
  enabled = true,
}: UseBitfinexPriceOptions): UseBitfinexPriceReturn {
  const [priceHistory, setPriceHistory] = useState<ExchangePricePoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelIdRef = useRef<number | null>(null);
  const prevSymbolRef = useRef<string>(symbol);

  // Build Bitfinex symbol format (BTC -> tBTCUSD)
  const bitfinexSymbol = `t${symbol.toUpperCase()}USD`;

  // Clear state when symbol changes to prevent stale data
  useEffect(() => {
    if (prevSymbolRef.current !== symbol) {
      // Symbol changed - clear all state immediately
      setPriceHistory([]);
      setCurrentPrice(null);
      setError(null);
      prevSymbolRef.current = symbol;
    }
  }, [symbol]);

  // Fetch initial historical data via server-side proxy (bypasses CORS)
  const fetchHistory = useCallback(async () => {
    if (!symbol || !enabled) return;

    try {
      // Use server-side proxy to avoid CORS issues
      const response = await fetch(
        `/api/prices/bitfinex/${symbol}?interval=${interval}&limit=300`,
        {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Bitfinex API error: ${response.status}`);
      }

      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        setPriceHistory(data);
        setCurrentPrice(data[data.length - 1].price);
      }
    } catch (err) {
      console.error('Bitfinex history fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch Bitfinex data');
    }
  }, [symbol, interval, enabled]);

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

      ws = new WebSocket(BITFINEX_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isCleanedUp) return;
        setConnected(true);
        setError(null);

        // Subscribe to trades channel
        ws.send(JSON.stringify({
          event: 'subscribe',
          channel: 'trades',
          symbol: bitfinexSymbol,
        }));
      };

      ws.onmessage = (event) => {
        if (isCleanedUp) return;

        try {
          const message = JSON.parse(event.data);

          // Handle subscription confirmation
          if (message.event === 'subscribed' && message.channel === 'trades') {
            channelIdRef.current = message.chanId;
            return;
          }

          // Handle heartbeat
          if (message[1] === 'hb') {
            return;
          }

          // Handle trade updates
          // Format: [CHANNEL_ID, "te", [ID, MTS, AMOUNT, PRICE]] for trade executed
          // or: [CHANNEL_ID, [[ID, MTS, AMOUNT, PRICE], ...]] for snapshot
          if (Array.isArray(message) && message[0] === channelIdRef.current) {
            const payload = message[1];

            // Trade executed update
            if (payload === 'te' || payload === 'tu') {
              const trade = message[2];
              if (Array.isArray(trade) && trade.length >= 4) {
                const tradePrice = Number(Math.abs(trade[3])); // Price (use absolute)
                const tradeTime = Math.floor(trade[1] / 1000); // MTS to seconds
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

            // Snapshot (array of trades)
            if (Array.isArray(payload) && Array.isArray(payload[0])) {
              const trades = payload;
              if (trades.length > 0) {
                // Get the most recent trade from snapshot
                const latestTrade = trades[trades.length - 1];
                const tradePrice = Number(Math.abs(latestTrade[3]));
                setCurrentPrice(tradePrice);
              }
            }
          }
        } catch (err) {
          console.error('Bitfinex message parse error:', err);
        }
      };

      ws.onerror = () => {
        if (isCleanedUp) return;
        setConnected(false);
        setError('Bitfinex WebSocket error');
      };

      ws.onclose = () => {
        if (isCleanedUp) return;
        setConnected(false);
        channelIdRef.current = null;

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
      channelIdRef.current = null;
      setConnected(false);
    };
  }, [symbol, interval, bitfinexSymbol, enabled, fetchHistory]);

  return {
    priceHistory,
    currentPrice,
    connected,
    error,
  };
}
