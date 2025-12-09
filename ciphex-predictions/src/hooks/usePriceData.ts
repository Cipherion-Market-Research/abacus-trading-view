'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Candle, Interval } from '@/types';

interface UsePriceDataOptions {
  symbol: string;
  interval: Interval;
  assetType: 'crypto' | 'stock' | 'dex';
  limit?: number;
  enableStreaming?: boolean;
}

interface UsePriceDataReturn {
  candles: Candle[];
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

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

  // Initial fetch
  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

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

  return {
    candles,
    loading,
    error,
    refresh: fetchPrices,
    streaming,
  };
}
