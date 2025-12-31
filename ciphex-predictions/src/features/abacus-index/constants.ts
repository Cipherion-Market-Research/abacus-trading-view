/**
 * Abacus:INDEX Constants
 *
 * Central configuration for thresholds, intervals, and venue settings.
 */

import { VenueConfig, VenueId, AssetId, MarketType } from './types';

// =============================================================================
// Outlier Detection
// =============================================================================

/**
 * Maximum deviation from median before a venue is excluded (in basis points)
 * 100 bps = 1.0%
 *
 * This is intentionally conservative for BTC/ETH where normal spreads are 5-50 bps.
 * It acts as a stale/bad-feed guardrail, not a microstructure filter.
 */
export const OUTLIER_THRESHOLD_BPS = 100;

/**
 * Convert bps threshold to decimal for calculations
 */
export const OUTLIER_THRESHOLD_DECIMAL = OUTLIER_THRESHOLD_BPS / 10000; // 0.01

// =============================================================================
// Composite Configuration
// =============================================================================

/**
 * Quorum policies for composite calculation
 *
 * POC/UI policy: Allow single-source fallback for observability during development
 * Production policy: Require proper quorum for signal quality
 *
 * Reference: Stakeholder feedback on quorum semantics when N is small
 */
export const QUORUM_POLICIES = {
  /**
   * POC/UI policy: allow 1-of-N fallback but mark as degraded with reason
   * This keeps the harness observable even during single-venue operation
   */
  poc: {
    minQuorum: 1,
    preferredQuorum: 2,
    allowSingleSource: true,
  },
  /**
   * Production/model policy: require proper quorum, output null when below
   * This ensures signal quality for forecasting models
   */
  production: {
    minQuorum: 2,
    preferredQuorum: 3,
    allowSingleSource: false,
  },
} as const;

/**
 * Current quorum policy (switch to 'production' for model integration)
 */
export const CURRENT_QUORUM_POLICY: keyof typeof QUORUM_POLICIES = 'poc';

/**
 * Get the active quorum configuration
 */
export function getQuorumConfig() {
  return QUORUM_POLICIES[CURRENT_QUORUM_POLICY];
}

// =============================================================================
// Stale Detection Configuration
// =============================================================================

/**
 * Per-venue stale thresholds (ms)
 *
 * A venue is considered stale if no trade/update has been received for this duration.
 * Stale venues are excluded from composite calculation same as disconnected venues.
 *
 * Note: These values are tuned per venue based on expected message frequency:
 * - High-frequency venues (Binance): shorter threshold
 * - Lower-frequency venues (Coinbase, Kraken): longer threshold
 */
export const STALE_THRESHOLDS_MS: Record<VenueId, { spot: number; perp: number }> = {
  binance: { spot: 10_000, perp: 10_000 },    // 10s - very high frequency
  coinbase: { spot: 30_000, perp: 30_000 },   // 30s - lower frequency
  kraken: { spot: 30_000, perp: 30_000 },     // 30s - lower frequency
  okx: { spot: 15_000, perp: 15_000 },        // 15s - moderate frequency
  bybit: { spot: 15_000, perp: 10_000 },      // 15s spot, 10s perp
};

/**
 * Default stale threshold for unknown venue/market combinations
 */
export const DEFAULT_STALE_THRESHOLD_MS = 30_000;

/**
 * Get stale threshold for a specific venue and market type
 */
export function getStaleThreshold(venue: VenueId, marketType: 'spot' | 'perp'): number {
  return STALE_THRESHOLDS_MS[venue]?.[marketType] ?? DEFAULT_STALE_THRESHOLD_MS;
}

// =============================================================================
// Bar Building
// =============================================================================

/**
 * Bar interval in seconds (1 minute)
 */
export const BAR_INTERVAL_SECONDS = 60;

/**
 * Maximum trades to buffer per venue for current minute
 * Prevents memory issues with high-frequency feeds
 *
 * Note: We only keep current minute accumulator + small ring buffer for telemetry
 * Raw trades are NOT stored unbounded - this is a memory safety rule
 */
export const MAX_TRADE_BUFFER_SIZE = 5_000;

/**
 * Maximum completed bars to retain per venue
 * Older bars are discarded to prevent memory growth
 */
export const MAX_BARS_PER_VENUE = 1_000; // ~16 hours at 1m resolution

/**
 * Ring buffer size for telemetry (message rate calculation)
 */
export const TELEMETRY_RING_BUFFER_SIZE = 100;

// =============================================================================
// Telemetry
// =============================================================================

/**
 * How often to compute telemetry metrics (ms)
 */
export const TELEMETRY_UPDATE_INTERVAL_MS = 5_000;

/**
 * Sliding window for message rate calculation (ms)
 */
export const MESSAGE_RATE_WINDOW_MS = 60_000;

// =============================================================================
// Venue Configurations
// =============================================================================

export const VENUE_CONFIGS: Record<VenueId, VenueConfig> = {
  binance: {
    id: 'binance',
    name: 'Binance',
    color: '#F0B90B',
    quoteCurrency: 'USDT',
    supportsSpot: true,
    supportsPerp: true,
    wsEndpoint: {
      spot: 'wss://stream.binance.com:9443/ws',
      perp: 'wss://fstream.binance.com/ws',
    },
  },
  coinbase: {
    id: 'coinbase',
    name: 'Coinbase',
    color: '#0052FF',
    quoteCurrency: 'USD',
    supportsSpot: true,
    supportsPerp: false,
    wsEndpoint: {
      spot: 'wss://ws-feed.exchange.coinbase.com',
    },
  },
  kraken: {
    id: 'kraken',
    name: 'Kraken',
    color: '#5741D9',
    quoteCurrency: 'USD',
    supportsSpot: true,
    supportsPerp: false,
    wsEndpoint: {
      spot: 'wss://ws.kraken.com',
    },
  },
  okx: {
    id: 'okx',
    name: 'OKX',
    color: '#FFFFFF',
    quoteCurrency: 'USDT',
    supportsSpot: true,
    supportsPerp: true,
    wsEndpoint: {
      spot: 'wss://ws.okx.com:8443/ws/v5/public',
      perp: 'wss://ws.okx.com:8443/ws/v5/public',
    },
  },
  bybit: {
    id: 'bybit',
    name: 'Bybit',
    color: '#F7A600',
    quoteCurrency: 'USDT',
    supportsSpot: false,
    supportsPerp: true,
    wsEndpoint: {
      perp: 'wss://stream.bybit.com/v5/public/linear',
    },
  },
};

// =============================================================================
// Funding Rate Configuration
// =============================================================================

/**
 * Funding rate ingestion is REST-based (not WebSocket)
 *
 * Rationale: Funding rates update slowly (typically every 8 hours on most exchanges)
 * so REST polling is simpler and doesn't complicate the WS connection management.
 */
export const FUNDING_POLL_INTERVAL_MS = 60_000; // Poll every minute, rates change every 8h

/**
 * Funding rate REST endpoints per venue
 */
export const FUNDING_ENDPOINTS = {
  binance: 'https://fapi.binance.com/fapi/v1/premiumIndex',
  okx: 'https://www.okx.com/api/v5/public/funding-rate',
  bybit: 'https://api.bybit.com/v5/market/tickers?category=linear',
} as const;

// =============================================================================
// POC Phase Configuration
// =============================================================================

/**
 * Venues enabled for each POC phase
 */
export const POC_PHASES = {
  'POC-0': {
    spot: ['binance', 'coinbase'] as VenueId[],
    perp: ['binance'] as VenueId[],
    assets: ['BTC'] as AssetId[],
  },
  'POC-1': {
    spot: ['binance', 'coinbase', 'okx'] as VenueId[],
    perp: ['binance', 'okx', 'bybit'] as VenueId[],
    assets: ['BTC'] as AssetId[],
  },
  'POC-2': {
    spot: ['binance', 'coinbase', 'okx', 'kraken'] as VenueId[],
    perp: ['binance', 'okx', 'bybit'] as VenueId[],
    assets: ['BTC', 'ETH'] as AssetId[],
  },
} as const;

/**
 * Current POC phase
 * Change this to enable more venues/assets
 */
export const CURRENT_POC_PHASE: keyof typeof POC_PHASES = 'POC-2';

/**
 * Get enabled venues for current phase
 */
export function getEnabledVenues() {
  return POC_PHASES[CURRENT_POC_PHASE];
}

// =============================================================================
// Display Colors
// =============================================================================

/**
 * Colors for composite lines
 */
export const COMPOSITE_COLORS = {
  spot: '#22C55E',    // Green
  perp: '#3B82F6',    // Blue
  basis: '#F59E0B',   // Amber
} as const;

/**
 * Colors for telemetry status
 */
export const STATUS_COLORS = {
  healthy: '#22C55E',
  degraded: '#F59E0B',
  unhealthy: '#EF4444',
} as const;
