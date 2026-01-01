'use client';

/**
 * Abacus Candles API Hook
 *
 * Poll-based implementation that fetches composite candles from the ECS Indexer API.
 * This replaces browser-side WebSocket connections with server-side aggregation.
 *
 * API Endpoints (Production v0.1.7 contract):
 *   - GET /v0/latest?asset=BTC&market_type=spot - Returns array of price objects
 *   - GET /v0/telemetry - Venue connection health (snake_case)
 *   - GET /v0/candles?asset=BTC&market_type=spot&limit=60 - Historical bars
 *
 * Usage:
 *   Set NEXT_PUBLIC_ABACUS_PROVIDER=api to enable this implementation.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Candle } from '@/types';
import {
  AssetId,
  CompositeBar,
  DegradedReason,
  MarketType,
} from '../types';
import type { UseAbacusCandlesReturn, AbacusStatus, UseAbacusCandlesOptions } from './useAbacusCandles';

// =============================================================================
// Config
// =============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_ABACUS_API_BASE_URL || 'https://api.ciphex.io/indexer/v0';
const POLL_INTERVAL_MS = 5000; // 5 second polling for /latest
const TELEMETRY_POLL_INTERVAL_MS = 15000; // 15 second polling for /telemetry
const BACKFILL_LIMIT = 60; // Default candles to fetch on init

// =============================================================================
// Production API Response Types (v0.1.7 snake_case contract)
// =============================================================================

/**
 * /v0/latest returns an array of these objects
 */
interface ApiLatestItem {
  asset: string;
  market_type: string;  // snake_case
  price: number | null;
  time: number;         // unix seconds
  degraded: boolean;
  included_venues: string[];
  last_bar: {
    time: number;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number;
    degraded: boolean;
    is_gap: boolean;
  } | null;
}

/**
 * /v0/telemetry response
 */
interface ApiTelemetryResponse {
  venues: Array<{
    venue: string;
    asset: string;
    market_type: string;
    connection_state: string;
    last_message_time: number | null;
    message_count: number;
    trade_count: number;
    reconnect_count: number;
    uptime_percent: number;
  }>;
  system_health: string;
  connected_spot_venues: number;
  connected_perp_venues: number;
  timestamp: string;
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
    degraded: boolean;
    is_gap: boolean;
    is_backfilled: boolean;
    included_venues: string[];
  }>;
  count: number;
  start_time: number;
  end_time: number;
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

  // Refs for intervals
  const latestIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const telemetryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef(false);

  // Fetch /v0/latest (production contract: returns array)
  const fetchLatest = useCallback(async () => {
    if (!enabled) return;

    try {
      // Production API uses snake_case: market_type
      const response = await fetch(`${API_BASE_URL}/latest?asset=${asset}`);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Production returns array of LatestPriceResponse
      const data: ApiLatestItem[] = await response.json();

      // Find spot and perp entries
      const spotEntry = data.find(d => d.market_type === 'spot');
      const perpEntry = data.find(d => d.market_type === 'perp');

      if (spotEntry) {
        // Update price
        setCurrentPrice(spotEntry.price);
        setDegraded(spotEntry.degraded);
        setStreaming(true);

        // Determine degraded reason based on included_venues count
        // With PREFERRED_QUORUM=3, degraded=true when < 3 venues
        // But we should key off is_gap and included_venues.length for Type A soak
        let reason: DegradedReason = 'none';
        if (spotEntry.degraded) {
          if (spotEntry.included_venues.length === 1) {
            reason = 'single_source';
          } else if (spotEntry.included_venues.length < 3) {
            reason = 'below_preferred_quorum';
          }
        }
        setDegradedReason(reason);

        // Update candles with last completed bar
        if (spotEntry.last_bar && !spotEntry.last_bar.is_gap) {
          const bar = spotEntry.last_bar;
          setCandles(prev => {
            const newCandle: Candle = {
              time: bar.time,
              open: bar.open ?? 0,
              high: bar.high ?? 0,
              low: bar.low ?? 0,
              close: bar.close ?? 0,
              volume: bar.volume,
            };

            // Check if we already have this candle
            const existingIndex = prev.findIndex(c => c.time === bar.time);
            if (existingIndex >= 0) {
              // Update existing
              const updated = [...prev];
              updated[existingIndex] = newCandle;
              return updated;
            } else {
              // Append new
              return [...prev, newCandle].slice(-BACKFILL_LIMIT);
            }
          });
        }

        // Update status
        setStatus(prev => ({
          ...prev,
          spotDegraded: spotEntry.degraded,
          perpDegraded: perpEntry?.degraded ?? false,
          spotDegradedReason: reason,
          connectedSpotVenues: spotEntry.included_venues.length,
          connectedPerpVenues: perpEntry?.included_venues.length ?? 0,
          // Compute basis if both spot and perp have prices
          basisBps: (spotEntry.price && perpEntry?.price)
            ? ((perpEntry.price - spotEntry.price) / spotEntry.price) * 10000
            : null,
        }));
      }
    } catch (error) {
      console.error('[useAbacusCandlesApi] fetchLatest error:', error);
      setStreaming(false);
      setStatus(prev => ({ ...prev, health: 'unhealthy' }));
    }
  }, [asset, enabled]);

  // Fetch /v0/telemetry (production contract: snake_case)
  const fetchTelemetry = useCallback(async () => {
    if (!enabled) return;

    try {
      const response = await fetch(`${API_BASE_URL}/telemetry`);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: ApiTelemetryResponse = await response.json();

      // Filter venues by current asset
      const assetVenues = data.venues.filter(v => v.asset === asset);
      const spotVenues = assetVenues.filter(v => v.market_type === 'spot');
      const perpVenues = assetVenues.filter(v => v.market_type === 'perp');
      const connectedSpot = spotVenues.filter(v => v.connection_state === 'connected').length;
      const connectedPerp = perpVenues.filter(v => v.connection_state === 'connected').length;

      setStatus(prev => ({
        ...prev,
        connectedSpotVenues: connectedSpot,
        connectedPerpVenues: connectedPerp,
        totalSpotVenues: spotVenues.length,
        totalPerpVenues: perpVenues.length,
        health: data.system_health as 'healthy' | 'degraded' | 'unhealthy',
      }));
    } catch (error) {
      console.error('[useAbacusCandlesApi] fetchTelemetry error:', error);
    }
  }, [asset, enabled]);

  // Fetch /v0/candles for backfill (production contract: snake_case params, seconds)
  const fetchBackfill = useCallback(async () => {
    if (!enabled) return;

    try {
      // Production API uses snake_case and unix seconds (not ms)
      const response = await fetch(
        `${API_BASE_URL}/candles?asset=${asset}&market_type=spot&limit=${BACKFILL_LIMIT}`
      );

      if (!response.ok) {
        // 503 expected if no database configured - just log and continue
        if (response.status === 503) {
          console.warn('[useAbacusCandlesApi] Candles endpoint unavailable (no database)');
          return;
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data: ApiCandlesResponse = await response.json();

      // Convert to Candle[] (filter out gap candles)
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
    } catch (error) {
      console.error('[useAbacusCandlesApi] fetchBackfill error:', error);
    }
  }, [asset, enabled]);

  // Initialize on mount
  useEffect(() => {
    if (!enabled || initializedRef.current) return;
    initializedRef.current = true;

    // Fetch initial backfill
    fetchBackfill();

    // Start polling
    fetchLatest();
    fetchTelemetry();

    latestIntervalRef.current = setInterval(fetchLatest, POLL_INTERVAL_MS);
    telemetryIntervalRef.current = setInterval(fetchTelemetry, TELEMETRY_POLL_INTERVAL_MS);

    return () => {
      if (latestIntervalRef.current) clearInterval(latestIntervalRef.current);
      if (telemetryIntervalRef.current) clearInterval(telemetryIntervalRef.current);
      initializedRef.current = false;
    };
  }, [enabled, fetchLatest, fetchTelemetry, fetchBackfill]);

  // Reset when asset changes
  useEffect(() => {
    if (!enabled) return;

    setCandles([]);
    setCurrentPrice(null);
    initializedRef.current = false;

    // Re-fetch for new asset
    fetchBackfill();
    fetchLatest();
    fetchTelemetry();
  }, [asset, enabled, fetchBackfill, fetchLatest, fetchTelemetry]);

  return {
    candles,
    currentPrice,
    degraded,
    degradedReason,
    status,
    streaming,
  };
}
