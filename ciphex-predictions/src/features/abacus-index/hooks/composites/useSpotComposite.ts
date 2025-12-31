'use client';

/**
 * Spot Composite Hook
 *
 * Aggregates spot venue data into a single composite price using median.
 * Implements quorum policies and degraded mode handling.
 *
 * Reference: EXCHANGE_INDEX_ANALYSIS.md Sections A9, A13, A17
 */

import React, { useMemo, useRef } from 'react';
import {
  CompositePrice,
  CompositeBar,
  VenueContribution,
  DegradedReason,
  AssetId,
  VenueHookReturn,
  AggregateTelemetry,
  CompositeHookReturn,
} from '../../types';
import { getQuorumConfig, getStaleThreshold } from '../../constants';
import {
  filterOutliers,
  computeCompositePrice,
  VenuePrice,
} from '../../utils/outlierFilter';
import { alignBars } from '../../utils/barBuilder';
import { nowMs } from '../../utils/timestamps';

// =============================================================================
// Types
// =============================================================================

interface UseSpotCompositeOptions {
  /** Venue hook returns to aggregate */
  venues: {
    binance?: VenueHookReturn;
    coinbase?: VenueHookReturn;
    kraken?: VenueHookReturn;
    okx?: VenueHookReturn;
  };
  asset: AssetId;
  enabled?: boolean;
}

// =============================================================================
// Hook
// =============================================================================

export function useSpotComposite({
  venues,
  asset,
  enabled = true,
}: UseSpotCompositeOptions): CompositeHookReturn {
  const quorumConfig = getQuorumConfig();

  // Convert venue hooks to VenuePrice format for filtering
  // CRITICAL: Include per-venue stale thresholds (fixes stale detection bug)
  const venuePrices = useMemo((): VenuePrice[] => {
    const prices: VenuePrice[] = [];

    if (venues.binance) {
      prices.push({
        venue: 'binance',
        price: venues.binance.currentPrice,
        connected: venues.binance.connectionState === 'connected',
        lastUpdate: venues.binance.telemetry.lastMessageTime,
        staleThresholdMs: getStaleThreshold('binance', 'spot'),
      });
    }

    if (venues.coinbase) {
      prices.push({
        venue: 'coinbase',
        price: venues.coinbase.currentPrice,
        connected: venues.coinbase.connectionState === 'connected',
        lastUpdate: venues.coinbase.telemetry.lastMessageTime,
        staleThresholdMs: getStaleThreshold('coinbase', 'spot'),
      });
    }

    if (venues.kraken) {
      prices.push({
        venue: 'kraken',
        price: venues.kraken.currentPrice,
        connected: venues.kraken.connectionState === 'connected',
        lastUpdate: venues.kraken.telemetry.lastMessageTime,
        staleThresholdMs: getStaleThreshold('kraken', 'spot'),
      });
    }

    if (venues.okx) {
      prices.push({
        venue: 'okx',
        price: venues.okx.currentPrice,
        connected: venues.okx.connectionState === 'connected',
        lastUpdate: venues.okx.telemetry.lastMessageTime,
        staleThresholdMs: getStaleThreshold('okx', 'spot'),
      });
    }

    return prices;
  }, [venues]);

  // Track outlier counts at composite level (for telemetry)
  const outlierCountRef = useRef(0);
  const staleCountRef = useRef(0);

  // Filter outliers and compute composite
  const { price, venueContributions, degraded, degradedReason } = useMemo(() => {
    if (!enabled || venuePrices.length === 0) {
      return {
        price: null,
        venueContributions: [] as VenueContribution[],
        degraded: true,
        degradedReason: 'venue_disconnected' as DegradedReason,
      };
    }

    const now = nowMs();

    // Per-venue stale thresholds are now embedded in venuePrices
    // No need for max threshold - filterOutliers uses per-venue thresholds
    const filterResult = filterOutliers(venuePrices, undefined, now);
    const compositePrice = computeCompositePrice(filterResult);

    // Track counts for telemetry (accumulate, don't reset)
    outlierCountRef.current += filterResult.outlierCount;
    staleCountRef.current += filterResult.staleCount;

    // Combine included and excluded into contributions
    const contributions: VenueContribution[] = [
      ...filterResult.included,
      ...filterResult.excluded,
    ];

    // Determine degradation status
    const includedCount = filterResult.included.length;
    const totalVenues = venuePrices.length;

    let isDegraded = false;
    let reason: DegradedReason = 'none';

    // Check quorum
    if (includedCount < quorumConfig.minQuorum) {
      // Below minimum quorum - no composite (unless POC policy allows single source)
      if (!quorumConfig.allowSingleSource || includedCount === 0) {
        return {
          price: null,
          venueContributions: contributions,
          degraded: true,
          degradedReason: 'venue_disconnected' as DegradedReason,
        };
      }
    }

    // Determine reason for degradation
    if (includedCount === 1 && quorumConfig.allowSingleSource) {
      isDegraded = true;
      reason = 'single_source';
    } else if (includedCount < quorumConfig.preferredQuorum) {
      isDegraded = true;
      reason = 'below_preferred_quorum';
    } else if (includedCount < totalVenues) {
      isDegraded = true;
      // Find the reason for exclusion
      const hasDisconnected = filterResult.excluded.some(
        (v) => v.excludeReason === 'disconnected'
      );
      const hasStale = filterResult.excluded.some(
        (v) => v.excludeReason === 'stale'
      );
      const hasOutlier = filterResult.excluded.some(
        (v) => v.excludeReason === 'outlier'
      );

      if (hasOutlier) reason = 'venue_outlier';
      else if (hasStale) reason = 'venue_stale';
      else if (hasDisconnected) reason = 'venue_disconnected';
    }

    return {
      price: compositePrice,
      venueContributions: contributions,
      degraded: isDegraded,
      degradedReason: reason,
    };
  }, [enabled, venuePrices, quorumConfig]);

  // Compute composite bars from aligned venue bars
  const compositeBars = useMemo((): CompositeBar[] => {
    if (!enabled) return [];

    const venueBarSets = Object.values(venues)
      .filter((v): v is VenueHookReturn => v !== undefined)
      .map((v) => v.bars);

    if (venueBarSets.length === 0) return [];

    const aligned = alignBars(venueBarSets);
    const result: CompositeBar[] = [];

    for (const [time, barsAtTime] of aligned) {
      if (barsAtTime.length < quorumConfig.minQuorum) {
        // Skip if below quorum (unless single source allowed)
        if (!quorumConfig.allowSingleSource || barsAtTime.length === 0) {
          continue;
        }
      }

      // Compute median close
      const closes = barsAtTime.map((b) => b.close).sort((a, b) => a - b);
      const medianClose =
        closes.length % 2 === 0
          ? (closes[closes.length / 2 - 1] + closes[closes.length / 2]) / 2
          : closes[Math.floor(closes.length / 2)];

      // Compute aggregated OHLCV
      const opens = barsAtTime.map((b) => b.open);
      const highs = barsAtTime.map((b) => b.high);
      const lows = barsAtTime.map((b) => b.low);
      const volumes = barsAtTime.map((b) => b.volume);

      result.push({
        time,
        open: opens.sort((a, b) => a - b)[Math.floor(opens.length / 2)],
        high: Math.max(...highs),
        low: Math.min(...lows),
        close: medianClose,
        volume: volumes.reduce((a, b) => a + b, 0),
        degraded: barsAtTime.length < Object.keys(venues).length,
        asset,
        marketType: 'spot',
      });
    }

    return result.sort((a, b) => a.time - b.time);
  }, [enabled, venues, quorumConfig, asset]);

  // Aggregate telemetry
  // CRITICAL: Use composite-level outlier counts, not venue-level (which are always 0)
  const telemetry = useMemo((): AggregateTelemetry => {
    const venueTelemetry = Object.values(venues)
      .filter((v): v is VenueHookReturn => v !== undefined)
      .map((v) => v.telemetry);

    const connectedSpot = venueTelemetry.filter(
      (t) => t.connectionState === 'connected' && t.marketType === 'spot'
    ).length;

    const totalGaps = venueTelemetry.reduce((sum, t) => sum + t.gapCount, 0);

    // Use composite-level outlier count (tracked in outlierCountRef)
    const totalOutliers = outlierCountRef.current;

    let health: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (connectedSpot === 0) health = 'unhealthy';
    else if (connectedSpot < venueTelemetry.length) health = 'degraded';

    return {
      venues: venueTelemetry,
      systemHealth: health,
      connectedSpotVenues: connectedSpot,
      connectedPerpVenues: 0, // Spot composite doesn't track perps
      totalGaps,
      totalOutlierExclusions: totalOutliers,
    };
  }, [venues]);

  return {
    price,
    currentBar: compositeBars[compositeBars.length - 1] ?? null,
    bars: compositeBars,
    venues: venueContributions,
    degraded,
    telemetry,
  };
}
