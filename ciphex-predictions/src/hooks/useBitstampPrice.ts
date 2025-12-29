'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ExchangePricePoint, Interval } from '@/types';

// Bitstamp WebSocket URL
const BITSTAMP_WS_URL = 'wss://ws.bitstamp.net';

// Bitstamp REST API for historical OHLC
const BITSTAMP_API_URL = 'https://www.bitstamp.net/api/v2';

// Bitstamp step mapping (seconds)
const BITSTAMP_STEP: Record<Interval, number> = {
  '15s': 60,     // Bitstamp minimum is 60 seconds
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

interface BitstampTradeData {
  id: number;
  timestamp: string;
  amount: number;
  amount_str: string;
  price: number;
  price_str: string;
  type: number; // 0 = buy, 1 = sell
  buy_order_id: number;
  sell_order_id: number;
}

interface BitstampMessage {
  event: string;
  channel: string;
  data: BitstampTradeData | Record<string, unknown>;
}

interface UseBitstampPriceOptions {
  symbol: string;       // Base symbol like 'BTC'
  interval: Interval;
  enabled?: boolean;
}

interface UseBitstampPriceReturn {
  priceHistory: ExchangePricePoint[];
  currentPrice: number | null;
  connected: boolean;
  error: string | null;
}

export function useBitstampPrice({
  symbol,
  interval,
  enabled = true,
}: UseBitstampPriceOptions): UseBitstampPriceReturn {
  const [priceHistory, setPriceHistory] = useState<ExchangePricePoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevSymbolRef = useRef<string>(symbol);

  // Build Bitstamp pair format (BTC -> btcusd)
  const bitstampPair = `${symbol.toLowerCase()}usd`;

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
      const step = BITSTAMP_STEP[interval];
      const limit = 300;

      // Bitstamp OHLC endpoint
      const response = await fetch(
        `${BITSTAMP_API_URL}/ohlc/${bitstampPair}/?step=${step}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`Bitstamp API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.data && data.data.ohlc && Array.isArray(data.data.ohlc)) {
        // Bitstamp OHLC format: {timestamp, open, high, low, close, volume}
        const history: ExchangePricePoint[] = data.data.ohlc.map((candle: { timestamp: string; close: string }) => ({
          time: Number(candle.timestamp), // Unix timestamp in seconds
          price: Number(candle.close),    // Close price
        }));

        setPriceHistory(history);

        if (history.length > 0) {
          setCurrentPrice(history[history.length - 1].price);
        }
      }
    } catch (err) {
      console.error('Bitstamp history fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch Bitstamp data');
    }
  }, [symbol, interval, bitstampPair, enabled]);

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

      ws = new WebSocket(BITSTAMP_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isCleanedUp) return;
        setConnected(true);
        setError(null);

        // Subscribe to live trades channel
        ws.send(JSON.stringify({
          event: 'bts:subscribe',
          data: {
            channel: `live_trades_${bitstampPair}`,
          },
        }));
      };

      ws.onmessage = (event) => {
        if (isCleanedUp) return;

        try {
          const message = JSON.parse(event.data) as BitstampMessage;

          // Handle trade events
          if (message.event === 'trade' && message.channel === `live_trades_${bitstampPair}`) {
            const trade = message.data as BitstampTradeData;
            const tradePrice = Number(trade.price);
            const tradeTime = Number(trade.timestamp);
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

          // Handle subscription confirmation
          if (message.event === 'bts:subscription_succeeded') {
            console.log('Bitstamp subscription succeeded:', message.channel);
          }
        } catch (err) {
          console.error('Bitstamp message parse error:', err);
        }
      };

      ws.onerror = () => {
        if (isCleanedUp) return;
        setConnected(false);
        setError('Bitstamp WebSocket error');
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
  }, [symbol, interval, bitstampPair, enabled, fetchHistory]);

  return {
    priceHistory,
    currentPrice,
    connected,
    error,
  };
}
