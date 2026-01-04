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
const BACKFILL_LIMIT = 1440; // 24 hours of 1-minute candles (matches Binance ~25h limit)
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
  const [perpPrice, setPerpPrice] = useState<number | null>(null);
  const [perpPriceHistory, setPerpPriceHistory] = useState<Array<{ time: number; value: number }>>([]);
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

  // Forming bar state (synthetic bar built from SSE prices)
  const formingBarRef = useRef<Candle | null>(null);
  const completedCandlesRef = useRef<Candle[]>([]);

  // Helper to update candles state with completed + forming bar
  const updateCandlesState = useCallback(() => {
    const completed = completedCandlesRef.current;
    const forming = formingBarRef.current;

    if (forming) {
      // Check if forming bar time is after last completed bar
      const lastCompleted = completed[completed.length - 1];
      if (!lastCompleted || forming.time > lastCompleted.time) {
        setCandles([...completed, forming]);
      } else {
        setCandles(completed);
      }
    } else {
      setCandles(completed);
    }
  }, []);

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
        if (spotEntry.last_bar) {
          const bar = spotEntry.last_bar;
          if (bar.time > lastBarTimeRef.current) {
            lastBarTimeRef.current = bar.time;

            let newCandle: Candle;
            if (bar.is_gap || bar.open === null) {
              // Fill gap with flat candle using last valid close
              const lastCandle = completedCandlesRef.current[completedCandlesRef.current.length - 1];
              const lastClose = lastCandle?.close ?? 0;
              newCandle = {
                time: bar.time,
                open: lastClose,
                high: lastClose,
                low: lastClose,
                close: lastClose,
                volume: 0,
              };
            } else {
              newCandle = {
                time: bar.time,
                open: bar.open,
                high: bar.high ?? bar.open,
                low: bar.low ?? bar.open,
                close: bar.close ?? bar.open,
                volume: bar.volume,
              };
            }

            // Update completed candles ref
            const existingIndex = completedCandlesRef.current.findIndex(c => c.time === bar.time);
            if (existingIndex >= 0) {
              completedCandlesRef.current[existingIndex] = newCandle;
            } else {
              completedCandlesRef.current = [...completedCandlesRef.current, newCandle].slice(-BACKFILL_LIMIT);
            }

            // Reset forming bar if it matches the completed bar time
            if (formingBarRef.current && formingBarRef.current.time === bar.time) {
              formingBarRef.current = null;
            }

            // Update state with completed + forming bar
            updateCandlesState();
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

      // Convert API candles, filling gaps with flat bars for chart continuity
      // Gap candles have is_gap=true and null OHLC - fill them using previous close
      const rawCandles = data.candles;
      const candleData: Candle[] = [];
      let lastValidClose = 0;

      for (const bar of rawCandles) {
        if (bar.is_gap || bar.open === null) {
          // Fill gap with flat candle using last valid close
          if (lastValidClose > 0) {
            candleData.push({
              time: bar.time,
              open: lastValidClose,
              high: lastValidClose,
              low: lastValidClose,
              close: lastValidClose,
              volume: 0, // No volume during gaps
            });
          }
        } else {
          // Valid candle
          candleData.push({
            time: bar.time,
            open: bar.open,
            high: bar.high ?? bar.open,
            low: bar.low ?? bar.open,
            close: bar.close ?? bar.open,
            volume: bar.volume,
          });
          lastValidClose = bar.close ?? bar.open;
        }
      }

      // Store in ref and update state
      completedCandlesRef.current = candleData;
      formingBarRef.current = null;
      updateCandlesState();

      // Track last bar time for deduplication
      if (candleData.length > 0) {
        lastBarTimeRef.current = candleData[candleData.length - 1].time;
      }
    } catch (error) {
      console.error('[useAbacusCandlesApi] fetchBackfill error:', error);
    }
  }, [asset, enabled, updateCandlesState]);

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

            // Update forming bar with this price
            const currentMinute = Math.floor(parsed.timestamp / 60000) * 60; // Floor to minute in seconds
            const existing = formingBarRef.current;

            if (existing && existing.time === currentMinute) {
              // Update existing forming bar
              formingBarRef.current = {
                time: currentMinute,
                open: existing.open,
                high: Math.max(existing.high, medianPrice),
                low: Math.min(existing.low, medianPrice),
                close: medianPrice,
                volume: existing.volume, // Volume not available from SSE
              };
            } else {
              // Start new forming bar
              formingBarRef.current = {
                time: currentMinute,
                open: medianPrice,
                high: medianPrice,
                low: medianPrice,
                close: medianPrice,
                volume: 0,
              };
            }

            // Update candles state with forming bar
            updateCandlesState();

            // Update venue count for display (but don't derive degraded from it)
            // Degraded status is authoritative from /latest API, not SSE venue count
            // SSE may show venues that backend excludes due to stale/outlier
            const venueCount = venuePrices.length;
            setStatus(prev => ({
              ...prev,
              connectedSpotVenues: venueCount,
              // Don't override health/degraded here - let /latest be authoritative
            }));
          }
        }

        // Calculate basis from perp if available and track perp price history
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

            // Update perp price state
            setPerpPrice(perpMedian);

            // Add to perp price history (floor to seconds for chart alignment)
            const priceTimeSeconds = Math.floor(parsed.timestamp / 1000);
            setPerpPriceHistory(prev => {
              // Dedupe by timestamp - update existing or append new
              const existing = prev.findIndex(p => p.time === priceTimeSeconds);
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = { time: priceTimeSeconds, value: perpMedian };
                return updated;
              }
              // Append and keep last 1440 entries (24h of ~1/sec updates)
              const newHistory = [...prev, { time: priceTimeSeconds, value: perpMedian }];
              return newHistory.slice(-1440);
            });

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

        // Update venue counts for display only
        // Degraded/health status is authoritative from /latest API
        setStatus(prev => ({
          ...prev,
          connectedSpotVenues: spotConnected,
          connectedPerpVenues: perpConnected,
          totalSpotVenues: assetVenues.filter(v => v.market_type === 'spot').length,
          totalPerpVenues: assetVenues.filter(v => v.market_type === 'perp').length,
          // Don't override health here - let /latest be authoritative
        }));
      } catch (error) {
        console.error('[useAbacusCandlesApi] SSE telemetry parse error:', error);
      }
    });

    eventSource.onopen = () => {
      console.log('[useAbacusCandlesApi] SSE connected');
      setStreaming(true);
      // Don't set health here - let /latest be authoritative

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
  }, [asset, enabled, fetchLatest, updateCandlesState]);

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
    setPerpPrice(null);
    setPerpPriceHistory([]);
    lastBarTimeRef.current = 0;
    completedCandlesRef.current = [];
    formingBarRef.current = null;
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
    perpPrice,
    perpPriceHistory,
    degraded,
    degradedReason,
    status,
    streaming,
  };
}
