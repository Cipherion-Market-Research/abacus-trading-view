'use client';

/**
 * Abacus Candles Hook
 *
 * Provides Abacus:INDEX spot composite candles in the standard Candle[] format
 * for integration with PriceChart. This is the bridge between the Abacus
 * feature module and the main chart.
 *
 * Provider Configuration:
 *   Set NEXT_PUBLIC_ABACUS_PROVIDER to control data source:
 *   - 'browser' (default): Direct WebSocket connections to exchanges (POC mode)
 *   - 'api': Poll ECS Indexer API (production mode)
 *
 * Usage:
 *   const { candles, currentPrice, degraded, status } = useAbacusCandles({ asset: 'BTC' });
 *   // Pass candles to PriceChart when Abacus source is selected
 */

import { useMemo } from 'react';
import { Candle } from '@/types';
import { AssetId, CompositeBar, DegradedReason } from '../types';
import {
  useBinanceSpot,
  useBinancePerp,
  useCoinbaseSpot,
  useOKXSpot,
  useOKXPerp,
  useBybitPerp,
  useKrakenSpot,
} from './venues';
import { useSpotComposite } from './composites/useSpotComposite';
import { usePerpComposite } from './composites/usePerpComposite';
import { useBasisFeatures } from './features/useBasisFeatures';
import { useAbacusCandlesApi } from './useAbacusCandlesApi';

// =============================================================================
// Provider Config
// =============================================================================

export type AbacusProvider = 'browser' | 'api';

/**
 * Get the configured Abacus provider from environment
 */
export function getAbacusProvider(): AbacusProvider {
  const provider = process.env.NEXT_PUBLIC_ABACUS_PROVIDER;
  if (provider === 'api') return 'api';
  return 'browser'; // default
}

// =============================================================================
// Types
// =============================================================================

export interface UseAbacusCandlesOptions {
  asset: AssetId;
  /** Market type: 'spot' (default) or 'perp' */
  marketType?: 'spot' | 'perp';
  enabled?: boolean;
  /** Override provider for this instance (useful for testing/debug) */
  providerOverride?: AbacusProvider;
}

export interface AbacusStatus {
  /** Number of connected spot venues */
  connectedSpotVenues: number;
  /** Number of connected perp venues */
  connectedPerpVenues: number;
  /** Total configured spot venues */
  totalSpotVenues: number;
  /** Total configured perp venues */
  totalPerpVenues: number;
  /** Is spot composite degraded? */
  spotDegraded: boolean;
  /** Is perp composite degraded? */
  perpDegraded: boolean;
  /** Reason for spot degradation */
  spotDegradedReason: DegradedReason;
  /** Current basis in bps (perp - spot) */
  basisBps: number | null;
  /** System health */
  health: 'healthy' | 'degraded' | 'unhealthy';
}

export interface UseAbacusCandlesReturn {
  /** Candles in standard format for PriceChart (for selected marketType) */
  candles: Candle[];
  /** Current spot composite price (always tracked via SSE) */
  currentPrice: number | null;
  /** Current perp composite price (always tracked via SSE) */
  perpPrice?: number | null;
  /** Is the composite degraded? */
  degraded: boolean;
  /** Degraded reason for UI display */
  degradedReason: DegradedReason;
  /** Detailed status for status badge */
  status: AbacusStatus;
  /** Is data streaming (at least one venue connected)? */
  streaming: boolean;
  /** Active provider */
  provider?: AbacusProvider;
}

// =============================================================================
// Main Hook (Dispatcher)
// =============================================================================

/**
 * Main Abacus Candles hook - dispatches to browser or API implementation
 * based on NEXT_PUBLIC_ABACUS_PROVIDER environment variable.
 */
export function useAbacusCandles({
  asset,
  marketType = 'spot',
  enabled = true,
  providerOverride,
}: UseAbacusCandlesOptions): UseAbacusCandlesReturn {
  const provider = providerOverride ?? getAbacusProvider();
  const useBrowser = provider === 'browser';
  const useApi = provider === 'api';

  // Call both hooks (React rules), but only enable the active one
  // Note: Browser implementation doesn't support marketType yet (always spot)
  const browserResult = useAbacusCandlesBrowser({
    asset,
    enabled: enabled && useBrowser,
  });

  const apiResult = useAbacusCandlesApi({
    asset,
    marketType,
    enabled: enabled && useApi,
  });

  // Return result from active provider
  if (useApi) {
    return { ...apiResult, provider: 'api' };
  }

  return { ...browserResult, provider: 'browser' };
}

// =============================================================================
// Browser Implementation (POC - Direct WebSocket)
// =============================================================================

/**
 * Browser-based implementation using direct WebSocket connections.
 * This is the POC mode that connects directly to exchange WebSockets.
 */
export function useAbacusCandlesBrowser({
  asset,
  enabled = true,
}: Omit<UseAbacusCandlesOptions, 'providerOverride'>): UseAbacusCandlesReturn {
  // Venue hooks (POC-2: 4 spot + 3 perp)
  const binanceSpot = useBinanceSpot({ asset, enabled });
  const coinbaseSpot = useCoinbaseSpot({ asset, enabled });
  const okxSpot = useOKXSpot({ asset, enabled });
  const krakenSpot = useKrakenSpot({ asset, enabled });
  const binancePerp = useBinancePerp({ asset, enabled });
  const okxPerp = useOKXPerp({ asset, enabled });
  const bybitPerp = useBybitPerp({ asset, enabled });

  // Composites
  const spotComposite = useSpotComposite({
    venues: { binance: binanceSpot, coinbase: coinbaseSpot, okx: okxSpot, kraken: krakenSpot },
    asset,
    enabled,
  });

  const perpComposite = usePerpComposite({
    venues: { binance: binancePerp, okx: okxPerp, bybit: bybitPerp },
    asset,
    enabled,
  });

  // Basis features
  const basis = useBasisFeatures({
    spot: spotComposite,
    perp: perpComposite,
    enabled,
  });

  // Convert CompositeBar[] to Candle[]
  const candles = useMemo((): Candle[] => {
    return spotComposite.bars.map((bar: CompositeBar) => ({
      time: bar.time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
    }));
  }, [spotComposite.bars]);

  // Compute status
  const status = useMemo((): AbacusStatus => {
    const connectedSpot = spotComposite.telemetry.connectedSpotVenues;
    const connectedPerp = perpComposite.telemetry.connectedPerpVenues;
    const totalSpot = spotComposite.venues.length;
    const totalPerp = perpComposite.venues.length;

    let health: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (connectedSpot === 0 && connectedPerp === 0) {
      health = 'unhealthy';
    } else if (spotComposite.degraded || perpComposite.degraded) {
      health = 'degraded';
    }

    // Find the degraded reason from venues
    const spotExcluded = spotComposite.venues.find(v => !v.included);
    let spotDegradedReason: DegradedReason = 'none';
    if (spotComposite.degraded) {
      if (spotComposite.venues.length === 1) {
        spotDegradedReason = 'single_source';
      } else if (spotExcluded?.excludeReason === 'outlier') {
        spotDegradedReason = 'venue_outlier';
      } else if (spotExcluded?.excludeReason === 'stale') {
        spotDegradedReason = 'venue_stale';
      } else if (spotExcluded?.excludeReason === 'disconnected') {
        spotDegradedReason = 'venue_disconnected';
      }
    }

    return {
      connectedSpotVenues: connectedSpot,
      connectedPerpVenues: connectedPerp,
      totalSpotVenues: totalSpot,
      totalPerpVenues: totalPerp,
      spotDegraded: spotComposite.degraded,
      perpDegraded: perpComposite.degraded,
      spotDegradedReason,
      basisBps: basis.current?.basisBps ?? null,
      health,
    };
  }, [spotComposite, perpComposite, basis.current]);

  // Determine if streaming (at least one spot venue connected)
  const streaming = status.connectedSpotVenues > 0;

  // Determine degraded reason for display
  const degradedReason = useMemo((): DegradedReason => {
    if (!spotComposite.degraded) return 'none';

    const includedCount = spotComposite.venues.filter(v => v.included).length;
    if (includedCount === 1) return 'single_source';
    if (includedCount < 3) return 'below_preferred_quorum';

    const excluded = spotComposite.venues.find(v => !v.included);
    if (excluded?.excludeReason === 'outlier') return 'venue_outlier';
    if (excluded?.excludeReason === 'stale') return 'venue_stale';
    if (excluded?.excludeReason === 'disconnected') return 'venue_disconnected';

    return 'none';
  }, [spotComposite.degraded, spotComposite.venues]);

  return {
    candles,
    currentPrice: spotComposite.price,
    degraded: spotComposite.degraded,
    degradedReason,
    status,
    streaming,
  };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Format degraded reason for UI display
 */
export function formatDegradedReason(reason: DegradedReason): string {
  switch (reason) {
    case 'none':
      return '';
    case 'single_source':
      return 'Single venue';
    case 'below_preferred_quorum':
      return 'Below quorum';
    case 'venue_disconnected':
      return 'Venue offline';
    case 'venue_stale':
      return 'Stale data';
    case 'venue_outlier':
      return 'Outlier excluded';
    default:
      return 'Degraded';
  }
}
