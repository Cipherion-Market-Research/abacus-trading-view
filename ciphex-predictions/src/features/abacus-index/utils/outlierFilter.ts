/**
 * Outlier Filter Utility
 *
 * Implements median-based outlier detection for cross-venue price comparison.
 * Venues deviating more than the threshold from the median are excluded.
 *
 * Reference: EXCHANGE_INDEX_ANALYSIS.md Section A9.1
 */

import { VenueContribution, VenueId } from '../types';
import { OUTLIER_THRESHOLD_BPS, OUTLIER_THRESHOLD_DECIMAL } from '../constants';

// =============================================================================
// Types
// =============================================================================

export interface VenuePrice {
  venue: VenueId;
  price: number | null;
  connected: boolean;
  lastUpdate: number | null;
  /** Per-venue stale threshold in ms (optional, uses default if not provided) */
  staleThresholdMs?: number;
}

export interface FilterResult {
  /** Venues included in composite */
  included: VenueContribution[];
  /** Venues excluded from composite */
  excluded: VenueContribution[];
  /** Median price of included venues */
  medianPrice: number | null;
  /** Was any venue excluded as outlier? */
  hadOutliers: boolean;
  /** Count of venues excluded as outliers (for telemetry) */
  outlierCount: number;
  /** Count of venues excluded as stale (for telemetry) */
  staleCount: number;
  /** Count of venues excluded as disconnected (for telemetry) */
  disconnectedCount: number;
}

export interface OutlierEvent {
  time: number;
  venue: VenueId;
  price: number;
  medianPrice: number;
  deviationBps: number;
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Calculate the median of an array of numbers
 */
export function calculateMedian(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Calculate deviation in basis points
 */
export function calculateDeviationBps(price: number, reference: number): number {
  if (reference === 0) return 0;
  return Math.abs((price - reference) / reference) * 10000;
}

/**
 * Filter venue prices, excluding outliers based on median deviation
 *
 * Algorithm:
 * 1. Collect all connected venues with valid prices
 * 2. Apply per-venue staleness check
 * 3. Calculate median of all prices
 * 4. Exclude any venue deviating > threshold from median
 * 5. Return included/excluded breakdown with counts
 *
 * @param venues - Array of venue prices (with optional per-venue stale thresholds)
 * @param defaultStaleThresholdMs - Fallback stale threshold if not specified per-venue
 * @param currentTime - Current time for staleness check (optional)
 * @returns Filter result with included/excluded venues and counts
 */
export function filterOutliers(
  venues: VenuePrice[],
  defaultStaleThresholdMs?: number,
  currentTime?: number
): FilterResult {
  const now = currentTime ?? Date.now();
  const included: VenueContribution[] = [];
  const excluded: VenueContribution[] = [];

  // Track counts for telemetry
  let disconnectedCount = 0;
  let staleCount = 0;
  let outlierCount = 0;

  // First pass: identify valid prices (connected, not null, not stale)
  const validPrices: { venue: VenueId; price: number }[] = [];

  for (const v of venues) {
    // Check connection
    if (!v.connected) {
      excluded.push({
        venue: v.venue,
        price: v.price,
        included: false,
        excludeReason: 'disconnected',
      });
      disconnectedCount++;
      continue;
    }

    // Check null price
    if (v.price === null) {
      excluded.push({
        venue: v.venue,
        price: null,
        included: false,
        excludeReason: 'no_data',
      });
      continue;
    }

    // Check staleness using PER-VENUE threshold (critical fix)
    const staleThreshold = v.staleThresholdMs ?? defaultStaleThresholdMs;
    if (staleThreshold && v.lastUpdate !== null) {
      const age = now - v.lastUpdate;
      if (age > staleThreshold) {
        excluded.push({
          venue: v.venue,
          price: v.price,
          included: false,
          excludeReason: 'stale',
        });
        staleCount++;
        continue;
      }
    }

    validPrices.push({ venue: v.venue, price: v.price });
  }

  // Calculate median of valid prices
  const medianPrice = calculateMedian(validPrices.map((vp) => vp.price));

  // If no valid prices or no median, all remaining are excluded
  if (medianPrice === null) {
    return {
      included: [],
      excluded: [
        ...excluded,
        ...validPrices.map((vp) => ({
          venue: vp.venue,
          price: vp.price,
          included: false,
          excludeReason: 'no_data' as const,
        })),
      ],
      medianPrice: null,
      hadOutliers: false,
      outlierCount: 0,
      staleCount,
      disconnectedCount,
    };
  }

  // Second pass: filter outliers based on median deviation
  for (const vp of validPrices) {
    const deviationBps = calculateDeviationBps(vp.price, medianPrice);

    if (deviationBps > OUTLIER_THRESHOLD_BPS) {
      // Outlier - exclude
      excluded.push({
        venue: vp.venue,
        price: vp.price,
        included: false,
        excludeReason: 'outlier',
        deviationBps,
      });
      outlierCount++;
    } else {
      // Within threshold - include
      included.push({
        venue: vp.venue,
        price: vp.price,
        included: true,
        deviationBps,
      });
    }
  }

  return {
    included,
    excluded,
    medianPrice,
    hadOutliers: outlierCount > 0,
    outlierCount,
    staleCount,
    disconnectedCount,
  };
}

/**
 * Compute composite price from filter result
 * Uses median of included venues (not the initial median, in case outliers shifted it)
 */
export function computeCompositePrice(filterResult: FilterResult): number | null {
  const includedPrices = filterResult.included
    .map((v) => v.price)
    .filter((p): p is number => p !== null);

  return calculateMedian(includedPrices);
}

// =============================================================================
// Logging / Telemetry Helpers
// =============================================================================

/**
 * Create an outlier event for logging
 */
export function createOutlierEvent(
  venue: VenueId,
  price: number,
  medianPrice: number,
  time: number = Date.now()
): OutlierEvent {
  return {
    time,
    venue,
    price,
    medianPrice,
    deviationBps: calculateDeviationBps(price, medianPrice),
  };
}

/**
 * Format outlier event for logging
 */
export function formatOutlierEvent(event: OutlierEvent): string {
  return `[OUTLIER] ${event.venue}: ${event.price.toFixed(2)} vs median ${event.medianPrice.toFixed(2)} (${event.deviationBps.toFixed(1)} bps)`;
}

// =============================================================================
// Threshold Configuration
// =============================================================================

/**
 * Get current outlier threshold in basis points
 */
export function getOutlierThresholdBps(): number {
  return OUTLIER_THRESHOLD_BPS;
}

/**
 * Get current outlier threshold as decimal
 */
export function getOutlierThresholdDecimal(): number {
  return OUTLIER_THRESHOLD_DECIMAL;
}

/**
 * Check if a price would be considered an outlier given a reference
 */
export function isOutlier(price: number, reference: number): boolean {
  const deviation = Math.abs((price - reference) / reference);
  return deviation > OUTLIER_THRESHOLD_DECIMAL;
}
