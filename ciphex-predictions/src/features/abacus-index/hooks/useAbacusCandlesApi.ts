'use client';

/**
 * Abacus Candles API Hook
 *
 * SSE-based implementation that streams composite prices from the ECS Indexer API.
 * Uses Server-Sent Events for real-time updates (~500ms price cadence).
 *
 * API Endpoints (Production v0.1.22 contract):
 *   - GET /v0/stream?asset=BTC - SSE stream for price + telemetry events
 *   - GET /v0/latest?asset=BTC - Initial price fetch (fallback)
 *   - GET /v0/candles?asset=BTC&market_type=spot&limit=720 - Historical bars (12h)
 *
 * Usage:
 *   Set NEXT_PUBLIC_ABACUS_PROVIDER=api to enable this implementation.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Candle } from '@/types';
import { DegradedReason } from '../types';
import type { UseAbacusCandlesReturn, AbacusStatus, UseAbacusCandlesOptions } from './useAbacusCandles';

// =============================================================================
// Config
// =============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_ABACUS_API_BASE_URL || 'https://api.ciphex.io/indexer/v0';
const BACKFILL_LIMIT = 720; // 12 hours of 1-minute candles
const LATEST_POLL_FALLBACK_MS = 10000; // Fallback poll if SSE disconnects

// =============================================================================
// Production API Response Types (v0.1.22 snake_case contract)
// =============================================================================

/**
 * /v0/latest returns an array of these objects
 */
interface ApiLatestItem {
  asset: string;
  market_type: string;
  price: number | null;
  time: number;
  degraded: boolean;
  included_venues: string[];
  last_bar: {
    time: number;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number;
    buy_volume: number;
    sell_volume: number;
    buy_count: number;
    sell_count: number;
    degraded: boolean;
    is_gap: boolean;
  } | null;
}

/**
 * /v0/candles response
 */
interface ApiCandlesResponse {
  asset: string;
  market_type: string;
  candles: Array<{
    time: number;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number;
    buy_volume: number;
    sell_volume: number;
    buy_count: number;
    sell_count: number;
    degraded: boolean;
    is_gap: boolean;
    is_backfilled: boolean;
    included_venues: string[];
  }>;
  count: number;
  start_time: number;
  end_time: number;
}

/**
 * SSE price event data structure
 */
interface SSEPriceEvent {
  type: 'price';
  sequence: number;
  timestamp: number;
  data: {
    [asset: string]: {
      [marketType: string]: {
        [venue: string]: number;
      };
    };
  };
}

/**
 * SSE telemetry event data structure
 */
interface SSETelemetryEvent {
  type: 'telemetry';
  sequence: number;
  timestamp: number;
  data: Array<{
    venue: string;
    asset: string;
    market_type: string;
    connected: boolean;
    message_count: number;
  }>;
}

// =============================================================================
// Hook
// =============================================================================

export function useAbacusCandlesApi({
  asset,
  enabled = true,
}: UseAbacusCandlesOptions): UseAbacusCandlesReturn {
  // State
  const [candles, setCandles] = useState<Candle[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [degradedReason, setDegradedReason] = useState<DegradedReason>('none');
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<AbacusStatus>({
    connectedSpotVenues: 0,
    connectedPerpVenues: 0,
    totalSpotVenues: 4,
    totalPerpVenues: 3,
    spotDegraded: false,
    perpDegraded: false,
    spotDegradedReason: 'none',
    basisBps: null,
    health: 'unhealthy',
  });

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastBarTimeRef = useRef<number>(0);
  const initializedRef = useRef(false);

  // Fetch /v0/latest for initial state and bar updates
  const fetchLatest = useCallback(async () => {
    if (!enabled) return;

    try {
      const response = await fetch(`${API_BASE_URL}/latest?asset=${asset}`);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: ApiLatestItem[] = await response.json();
      const spotEntry = data.find(d => d.market_type === 'spot');
      const perpEntry = data.find(d => d.market_type === 'perp');

      if (spotEntry) {
        setCurrentPrice(spotEntry.price);
        setDegraded(spotEntry.degraded);

        let reason: DegradedReason = 'none';
        if (spotEntry.degraded) {
          if (spotEntry.included_venues.length === 1) {
            reason = 'single_source';
          } else if (spotEntry.included_venues.length < 3) {
            reason = 'below_preferred_quorum';
          }
        }
        setDegradedReason(reason);

        // Update candles with last completed bar if new
        if (spotEntry.last_bar && !spotEntry.last_bar.is_gap) {
          const bar = spotEntry.last_bar;
          if (bar.time > lastBarTimeRef.current) {
            lastBarTimeRef.current = bar.time;
            setCandles(prev => {
              const newCandle: Candle = {
                time: bar.time,
                open: bar.open ?? 0,
                high: bar.high ?? 0,
                low: bar.low ?? 0,
                close: bar.close ?? 0,
                volume: bar.volume,
              };

              const existingIndex = prev.findIndex(c => c.time === bar.time);
              if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = newCandle;
                return updated;
              } else {
                return [...prev, newCandle].slice(-BACKFILL_LIMIT);
              }
            });
          }
        }

        setStatus(prev => ({
          ...prev,
          spotDegraded: spotEntry.degraded,
          perpDegraded: perpEntry?.degraded ?? false,
          spotDegradedReason: reason,
          connectedSpotVenues: spotEntry.included_venues.length,
          connectedPerpVenues: perpEntry?.included_venues.length ?? 0,
          basisBps: (spotEntry.price && perpEntry?.price)
            ? ((perpEntry.price - spotEntry.price) / spotEntry.price) * 10000
            : null,
        }));
      }
    } catch (error) {
      console.error('[useAbacusCandlesApi] fetchLatest error:', error);
    }
  }, [asset, enabled]);

  // Fetch /v0/candles for historical backfill
  const fetchBackfill = useCallback(async () => {
    if (!enabled) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/candles?asset=${asset}&market_type=spot&limit=${BACKFILL_LIMIT}`
      );

      if (!response.ok) {
        if (response.status === 503) {
          console.warn('[useAbacusCandlesApi] Candles endpoint unavailable (no database)');
          return;
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data: ApiCandlesResponse = await response.json();

      const candleData: Candle[] = data.candles
        .filter(bar => !bar.is_gap && bar.open !== null)
        .map(bar => ({
          time: bar.time,
          open: bar.open ?? 0,
          high: bar.high ?? 0,
          low: bar.low ?? 0,
          close: bar.close ?? 0,
          volume: bar.volume,
        }));

      setCandles(candleData);

      // Track last bar time for deduplication
      if (candleData.length > 0) {
        lastBarTimeRef.current = candleData[candleData.length - 1].time;
      }
    } catch (error) {
      console.error('[useAbacusCandlesApi] fetchBackfill error:', error);
    }
  }, [asset, enabled]);

  // Setup SSE connection
  const setupSSE = useCallback(() => {
    if (!enabled) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `${API_BASE_URL}/stream?asset=${asset}`;
    console.log('[useAbacusCandlesApi] Connecting to SSE:', url);

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('price', (event) => {
      try {
        const parsed: SSEPriceEvent = JSON.parse(event.data);
        const assetData = parsed.data[asset];

        if (assetData?.spot) {
          // Calculate median price from all spot venues
          const venuePrices = Object.values(assetData.spot).filter(p => p > 0);
          if (venuePrices.length > 0) {
            venuePrices.sort((a, b) => a - b);
            const mid = Math.floor(venuePrices.length / 2);
            const medianPrice = venuePrices.length % 2 === 0
              ? (venuePrices[mid - 1] + venuePrices[mid]) / 2
              : venuePrices[mid];

            setCurrentPrice(medianPrice);
            setStreaming(true);

            // Update degraded status based on venue count
            const venueCount = venuePrices.length;
            const isDegraded = venueCount < 3;
            setDegraded(isDegraded);

            if (isDegraded) {
              setDegradedReason(venueCount === 1 ? 'single_source' : 'below_preferred_quorum');
            } else {
              setDegradedReason('none');
            }

            setStatus(prev => ({
              ...prev,
              connectedSpotVenues: venueCount,
              health: venueCount >= 2 ? 'healthy' : 'degraded',
            }));
          }
        }

        // Calculate basis from perp if available
        if (assetData?.spot && assetData?.perp) {
          const spotPrices = Object.values(assetData.spot).filter(p => p > 0);
          const perpPrices = Object.values(assetData.perp).filter(p => p > 0);

          if (spotPrices.length > 0 && perpPrices.length > 0) {
            spotPrices.sort((a, b) => a - b);
            perpPrices.sort((a, b) => a - b);

            const spotMid = Math.floor(spotPrices.length / 2);
            const perpMid = Math.floor(perpPrices.length / 2);

            const spotMedian = spotPrices.length % 2 === 0
              ? (spotPrices[spotMid - 1] + spotPrices[spotMid]) / 2
              : spotPrices[spotMid];
            const perpMedian = perpPrices.length % 2 === 0
              ? (perpPrices[perpMid - 1] + perpPrices[perpMid]) / 2
              : perpPrices[perpMid];

            setStatus(prev => ({
              ...prev,
              connectedPerpVenues: perpPrices.length,
              basisBps: ((perpMedian - spotMedian) / spotMedian) * 10000,
            }));
          }
        }
      } catch (error) {
        console.error('[useAbacusCandlesApi] SSE price parse error:', error);
      }
    });

    eventSource.addEventListener('telemetry', (event) => {
      try {
        const parsed: SSETelemetryEvent = JSON.parse(event.data);
        const assetVenues = parsed.data.filter(v => v.asset === asset);
        const spotConnected = assetVenues.filter(v => v.market_type === 'spot' && v.connected).length;
        const perpConnected = assetVenues.filter(v => v.market_type === 'perp' && v.connected).length;

        setStatus(prev => ({
          ...prev,
          connectedSpotVenues: spotConnected,
          connectedPerpVenues: perpConnected,
          health: spotConnected >= 2 ? 'healthy' : spotConnected >= 1 ? 'degraded' : 'unhealthy',
        }));
      } catch (error) {
        console.error('[useAbacusCandlesApi] SSE telemetry parse error:', error);
      }
    });

    eventSource.onopen = () => {
      console.log('[useAbacusCandlesApi] SSE connected');
      setStreaming(true);
      setStatus(prev => ({ ...prev, health: 'healthy' }));

      // Clear fallback polling when SSE is connected
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };

    eventSource.onerror = (error) => {
      console.error('[useAbacusCandlesApi] SSE error, will auto-reconnect:', error);
      setStreaming(false);

      // Start fallback polling while SSE reconnects
      if (!fallbackIntervalRef.current) {
        fallbackIntervalRef.current = setInterval(fetchLatest, LATEST_POLL_FALLBACK_MS);
      }
    };

    return eventSource;
  }, [asset, enabled, fetchLatest]);

  // Poll for new bars (SSE doesn't send bar completion events yet)
  useEffect(() => {
    if (!enabled) return;

    // Check for new bars every 5 seconds
    const barPollInterval = setInterval(() => {
      fetchLatest();
    }, 5000);

    return () => clearInterval(barPollInterval);
  }, [enabled, fetchLatest]);

  // Initialize on mount
  useEffect(() => {
    if (!enabled || initializedRef.current) return;
    initializedRef.current = true;

    // Fetch initial data
    fetchBackfill();
    fetchLatest();

    // Setup SSE connection
    const eventSource = setupSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
      }
      initializedRef.current = false;
    };
  }, [enabled, fetchBackfill, fetchLatest, setupSSE]);

  // Reset when asset changes
  useEffect(() => {
    if (!enabled) return;

    setCandles([]);
    setCurrentPrice(null);
    lastBarTimeRef.current = 0;
    initializedRef.current = false;

    // Close existing SSE and reconnect for new asset
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    fetchBackfill();
    fetchLatest();
    setupSSE();
  }, [asset, enabled, fetchBackfill, fetchLatest, setupSSE]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
      }
    };
  }, []);

  return {
    candles,
    currentPrice,
    degraded,
    degradedReason,
    status,
    streaming,
  };
}
