/**
 * Timestamp Utilities
 *
 * Handles exchange timestamp normalization and validation.
 * Critical for accurate lead/lag measurement.
 *
 * Reference: EXCHANGE_INDEX_ANALYSIS.md Section A16
 */

import { VenueId } from '../types';

// =============================================================================
// Types
// =============================================================================

export interface TimestampPair {
  /** Exchange-reported timestamp (ms since epoch) */
  exchangeTime: number;
  /** Local receipt timestamp (ms since epoch) */
  localTime: number;
}

export interface LatencyStats {
  /** Minimum observed latency (ms) */
  min: number;
  /** Maximum observed latency (ms) */
  max: number;
  /** Average latency (ms) */
  avg: number;
  /** Sample count */
  count: number;
}

// =============================================================================
// Timestamp Normalization
// =============================================================================

/**
 * Normalize a timestamp to milliseconds
 * Different exchanges use different units (ms, s, or even mixed)
 */
export function normalizeTimestamp(timestamp: number, venue: VenueId): number {
  // If timestamp is in seconds (< year 2001 in ms), convert to ms
  if (timestamp < 1_000_000_000_000) {
    return timestamp * 1000;
  }
  return timestamp;
}

/**
 * Get current time in milliseconds
 */
export function nowMs(): number {
  return Date.now();
}

/**
 * Get current time in seconds (Unix timestamp)
 */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Floor timestamp to minute boundary (for bar alignment)
 */
export function floorToMinute(timestampMs: number): number {
  return Math.floor(timestampMs / 60000) * 60000;
}

/**
 * Floor timestamp to second boundary
 */
export function floorToSecond(timestampMs: number): number {
  return Math.floor(timestampMs / 1000) * 1000;
}

// =============================================================================
// Latency Tracking
// =============================================================================

/**
 * Calculate latency from exchange time to local receipt
 * Positive value means exchange time is in the past (normal)
 * Negative value means exchange time is in the future (clock skew)
 */
export function calculateLatency(exchangeTimeMs: number, localTimeMs: number): number {
  return localTimeMs - exchangeTimeMs;
}

/**
 * Create a latency tracker for a venue
 */
export function createLatencyTracker() {
  const samples: number[] = [];
  const maxSamples = 1000;

  return {
    /**
     * Record a latency sample
     */
    record(exchangeTimeMs: number, localTimeMs: number = Date.now()) {
      const latency = calculateLatency(exchangeTimeMs, localTimeMs);
      samples.push(latency);
      if (samples.length > maxSamples) {
        samples.shift();
      }
    },

    /**
     * Get latency statistics
     */
    getStats(): LatencyStats | null {
      if (samples.length === 0) return null;

      const min = Math.min(...samples);
      const max = Math.max(...samples);
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;

      return { min, max, avg, count: samples.length };
    },

    /**
     * Clear all samples
     */
    clear() {
      samples.length = 0;
    },

    /**
     * Get raw samples
     */
    getSamples(): number[] {
      return [...samples];
    },
  };
}

// =============================================================================
// Clock Skew Detection
// =============================================================================

/**
 * Expected latency bounds per venue (ms)
 * Based on typical network conditions
 *
 * Note: These are rough estimates. Actual latency depends on:
 * - Geographic location
 * - Network conditions
 * - Exchange server location
 */
export const EXPECTED_LATENCY_BOUNDS: Record<VenueId, { min: number; max: number }> = {
  binance: { min: 50, max: 500 },
  coinbase: { min: 30, max: 300 },
  kraken: { min: 50, max: 400 },
  okx: { min: 100, max: 600 },
  bybit: { min: 100, max: 600 },
};

/**
 * Check if observed latency is within expected bounds
 * Returns warning if outside bounds (possible clock skew)
 */
export function checkLatencyBounds(
  venue: VenueId,
  latencyMs: number
): { ok: boolean; warning?: string } {
  const bounds = EXPECTED_LATENCY_BOUNDS[venue];

  if (latencyMs < bounds.min - 100) {
    return {
      ok: false,
      warning: `Latency too low (${latencyMs}ms) - possible clock skew or future timestamp`,
    };
  }

  if (latencyMs > bounds.max + 500) {
    return {
      ok: false,
      warning: `Latency too high (${latencyMs}ms) - possible network issues or stale data`,
    };
  }

  return { ok: true };
}

// =============================================================================
// Timestamp Validation
// =============================================================================

/**
 * Validate that a timestamp is reasonable (not too old, not in future)
 */
export function isReasonableTimestamp(
  timestampMs: number,
  maxAgeMs: number = 60000,
  maxFutureMs: number = 5000
): boolean {
  const now = Date.now();
  const age = now - timestampMs;

  // Too old
  if (age > maxAgeMs) return false;

  // Too far in future
  if (age < -maxFutureMs) return false;

  return true;
}

/**
 * Validate timestamp and return diagnostic info
 */
export function validateTimestamp(
  timestampMs: number,
  venue: VenueId
): { valid: boolean; issue?: string; latencyMs: number } {
  const now = Date.now();
  const latencyMs = now - timestampMs;

  // Future timestamp (clock skew)
  if (latencyMs < -1000) {
    return {
      valid: false,
      issue: `Future timestamp detected (${-latencyMs}ms ahead)`,
      latencyMs,
    };
  }

  // Very old timestamp (stale)
  if (latencyMs > 60000) {
    return {
      valid: false,
      issue: `Stale timestamp (${Math.floor(latencyMs / 1000)}s old)`,
      latencyMs,
    };
  }

  // Check venue-specific bounds
  const boundsCheck = checkLatencyBounds(venue, latencyMs);
  if (!boundsCheck.ok) {
    return {
      valid: true, // Still usable, but with warning
      issue: boundsCheck.warning,
      latencyMs,
    };
  }

  return { valid: true, latencyMs };
}

// =============================================================================
// Time Formatting
// =============================================================================

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestampMs: number): string {
  return new Date(timestampMs).toISOString();
}

/**
 * Format latency for display
 */
export function formatLatency(latencyMs: number): string {
  if (latencyMs < 0) {
    return `${-latencyMs}ms ahead`;
  }
  return `${latencyMs}ms`;
}

/**
 * Format duration in human-readable form
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}
