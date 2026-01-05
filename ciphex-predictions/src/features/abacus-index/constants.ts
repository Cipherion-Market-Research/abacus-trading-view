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
// System Status Configuration
// =============================================================================

/**
 * System status for display in the debug harness
 */
export type SystemStatus = 'Alpha' | 'Beta' | 'Production';

/**
 * Current system status
 */
export const CURRENT_SYSTEM_STATUS: SystemStatus = 'Beta';

// =============================================================================
// Venue Phase Configuration
// =============================================================================

/**
 * Venues enabled for each phase
 */
export const VENUE_PHASES = {
  'alpha': {
    spot: ['binance', 'coinbase'] as VenueId[],
    perp: ['binance'] as VenueId[],
    assets: ['BTC'] as AssetId[],
  },
  'beta': {
    spot: ['binance', 'coinbase', 'okx', 'kraken'] as VenueId[],
    perp: ['binance', 'okx', 'bybit'] as VenueId[],
    assets: ['BTC', 'ETH'] as AssetId[],
  },
  'production': {
    spot: ['binance', 'coinbase', 'okx', 'kraken'] as VenueId[],
    perp: ['binance', 'okx', 'bybit'] as VenueId[],
    assets: ['BTC', 'ETH'] as AssetId[],
  },
} as const;

/**
 * Current venue phase
 * @deprecated Use CURRENT_SYSTEM_STATUS instead
 */
export const CURRENT_POC_PHASE = 'beta';

/**
 * @deprecated Use VENUE_PHASES instead
 */
export const POC_PHASES = VENUE_PHASES;

/**
 * Get enabled venues for current phase
 */
export function getEnabledVenues() {
  const phase = CURRENT_SYSTEM_STATUS.toLowerCase() as keyof typeof VENUE_PHASES;
  return VENUE_PHASES[phase];
}

// =============================================================================
// Display Colors
// =============================================================================

/**
 * Debug Harness UI Color Palette
 *
 * Background: #030719 (dark navy)
 * Card backgrounds: #0b1120 (navy)
 * Text primary: #dbdce0 | Text secondary: #959cab
 * Positive: #68c58d | Secondary positive: #133f33
 * Neutral: #92713c
 * Negative: #c65962 | Secondary negative: #9e5159
 * Tertiary/accent: #5fa5f9 | #6092cc
 */
export const UI_COLORS = {
  // Backgrounds
  background: '#030719',
  cardBackground: '#0b1120',
  cardBackgroundHover: '#111827',

  // Text
  textPrimary: '#dbdce0',
  textSecondary: '#959cab',
  textMuted: '#6b7280',

  // Positive (green)
  positive: '#68c58d',
  positiveSecondary: '#133f33',
  positiveMuted: '#2d5a40',

  // Neutral (amber/gold)
  neutral: '#92713c',
  neutralSecondary: '#5c4a2a',

  // Negative (red)
  negative: '#c65962',
  negativeSecondary: '#9e5159',
  negativeMuted: '#4a2a2d',

  // Tertiary/accent (blue)
  accent: '#5fa5f9',
  accentSecondary: '#6092cc',
  accentMuted: '#1e3a5f',

  // Borders
  border: '#1e293b',
  borderAccent: '#334155',
} as const;

/**
 * Colors for composite price display (vibrant for prominence)
 */
export const COMPOSITE_COLORS = {
  // Primary colors (vibrant)
  spot: '#4ADE80',       // Vibrant green
  spotGlow: '#22c55e',   // Green glow
  spotMuted: '#166534',  // Dark green for backgrounds

  perp: '#60A5FA',       // Vibrant blue
  perpGlow: '#3b82f6',   // Blue glow
  perpMuted: '#1e3a8a',  // Dark blue for backgrounds

  basis: '#FBBF24',      // Vibrant amber
  basisGlow: '#f59e0b',  // Amber glow
  basisMuted: '#78350f', // Dark amber for backgrounds
} as const;

/**
 * Colors for telemetry status
 */
export const STATUS_COLORS = {
  healthy: '#68c58d',
  degraded: '#92713c',
  unhealthy: '#c65962',
} as const;
