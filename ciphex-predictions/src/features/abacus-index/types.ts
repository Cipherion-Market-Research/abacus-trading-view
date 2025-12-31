/**
 * Abacus:INDEX Canonical Types
 *
 * These types define the API contract for the POC and should be
 * preserved when migrating to the ECS production service.
 */

// =============================================================================
// Core Enums
// =============================================================================

/**
 * Supported venues for the Abacus:INDEX POC
 */
export type VenueId =
  | 'binance'
  | 'coinbase'
  | 'kraken'
  | 'okx'
  | 'bybit';

/**
 * Market type: spot or perpetual
 */
export type MarketType = 'spot' | 'perp';

/**
 * Supported assets
 */
export type AssetId = 'BTC' | 'ETH';

/**
 * Quote currency
 */
export type QuoteCurrency = 'USD' | 'USDT' | 'USDC';

// =============================================================================
// Trade & Bar Types
// =============================================================================

/**
 * Canonical trade representation (normalized from venue-specific formats)
 */
export interface Trade {
  /** Exchange-reported timestamp (ms since epoch) */
  timestamp: number;
  /** Local receipt timestamp (ms since epoch) - for telemetry only */
  localTimestamp: number;
  /** Trade price */
  price: number;
  /** Trade quantity (base asset) */
  quantity: number;
  /** True if buyer was the maker (passive); false if buyer was taker (aggressor) */
  isBuyerMaker: boolean;
  /** Source venue */
  venue: VenueId;
  /** Asset */
  asset: AssetId;
  /** Market type */
  marketType: MarketType;
}

/**
 * 1-minute OHLCV bar
 */
export interface Bar {
  /** Bar start time (unix seconds, floored to minute) */
  time: number;
  /** Open price */
  open: number;
  /** High price */
  high: number;
  /** Low price */
  low: number;
  /** Close price */
  close: number;
  /** Volume (base asset) */
  volume: number;
  /** Number of trades in this bar */
  tradeCount: number;
  /** Source venue */
  venue: VenueId;
  /** Asset */
  asset: AssetId;
  /** Market type */
  marketType: MarketType;
  /** True if bar is still forming (not closed) */
  isPartial: boolean;
}

// =============================================================================
// Composite Types
// =============================================================================

/**
 * Per-venue contribution to a composite
 */
export interface VenueContribution {
  venue: VenueId;
  price: number | null;
  included: boolean;
  excludeReason?: 'disconnected' | 'stale' | 'outlier' | 'no_data';
  deviationBps?: number;
}

/**
 * Reason for degraded mode
 * Used to distinguish between different quality levels of degradation
 */
export type DegradedReason =
  | 'none'                    // Not degraded
  | 'single_source'           // Only one venue available (POC allows this, production doesn't)
  | 'below_preferred_quorum'  // Below preferred but above minimum quorum
  | 'venue_disconnected'      // One or more venues disconnected
  | 'venue_stale'             // One or more venues have stale data
  | 'venue_outlier';          // One or more venues excluded as outliers

/**
 * Composite price output (spot or perp)
 */
export interface CompositePrice {
  /** Composite price (median of included venues) */
  price: number | null;
  /** Bar start time (unix seconds) */
  time: number;
  /** Per-venue breakdown */
  venues: VenueContribution[];
  /** Number of venues included in composite */
  includedCount: number;
  /** Total configured venues */
  totalVenues: number;
  /** True if operating in degraded mode (< all venues available) */
  degraded: boolean;
  /** Reason for degradation (if degraded) */
  degradedReason: DegradedReason;
  /** Asset */
  asset: AssetId;
  /** Market type */
  marketType: MarketType;
}

/**
 * Composite bar (1m OHLCV computed from venue medians)
 */
export interface CompositeBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Aggregated volume across venues */
  volume: number;
  /** Was any minute in this bar degraded? */
  degraded: boolean;
  asset: AssetId;
  marketType: MarketType;
}

// =============================================================================
// Derived Features
// =============================================================================

/**
 * Basis features (perp - spot relationship)
 */
export interface BasisFeatures {
  /** Raw basis: perp_price - spot_price */
  basis: number | null;
  /** Basis in basis points: 10000 * basis / spot_price */
  basisBps: number | null;
  /** Timestamp */
  time: number;
  /** True if either spot or perp is degraded */
  degraded: boolean;
}

/**
 * Funding rate data point
 */
export interface FundingRate {
  /** Funding timestamp (usually 8h intervals) */
  time: number;
  /** Funding rate (e.g., 0.0001 = 0.01%) */
  rate: number;
  /** Source venue */
  venue: VenueId;
  /** Asset */
  asset: AssetId;
}

// =============================================================================
// Telemetry Types
// =============================================================================

/**
 * Connection state for a venue
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Per-venue telemetry snapshot
 */
export interface VenueTelemetry {
  venue: VenueId;
  marketType: MarketType;
  asset: AssetId;

  /** Current connection state */
  connectionState: ConnectionState;

  /** Time of last successful message (ms since epoch) */
  lastMessageTime: number | null;

  /** Messages received in current session */
  messageCount: number;

  /** Trades received in current session */
  tradeCount: number;

  /** Reconnect count in current session */
  reconnectCount: number;

  /** Number of 1m bars with gaps (missing data) */
  gapCount: number;

  /** Number of times this venue was excluded as outlier */
  outlierExclusionCount: number;

  /** Session start time (ms since epoch) */
  sessionStartTime: number;

  /** Computed uptime percentage for current session */
  uptimePercent: number;

  /** Average messages per second */
  avgMessageRate: number;
}

/**
 * Aggregated telemetry across all venues
 */
export interface AggregateTelemetry {
  /** Per-venue telemetry */
  venues: VenueTelemetry[];

  /** Overall system health */
  systemHealth: 'healthy' | 'degraded' | 'unhealthy';

  /** Number of connected spot venues */
  connectedSpotVenues: number;

  /** Number of connected perp venues */
  connectedPerpVenues: number;

  /** Total gaps across all venues */
  totalGaps: number;

  /** Total outlier exclusions */
  totalOutlierExclusions: number;
}

// =============================================================================
// Venue Configuration
// =============================================================================

/**
 * Static configuration for a venue
 */
export interface VenueConfig {
  id: VenueId;
  name: string;
  color: string;
  quoteCurrency: QuoteCurrency;
  supportsSpot: boolean;
  supportsPerp: boolean;
  wsEndpoint: {
    spot?: string;
    perp?: string;
  };
}

// =============================================================================
// Hook Return Types
// =============================================================================

/**
 * Return type for venue hooks
 */
export interface VenueHookReturn {
  /** Current price */
  currentPrice: number | null;
  /** Current bar (partial or complete) */
  currentBar: Bar | null;
  /** Historical bars (most recent last) */
  bars: Bar[];
  /** Connection state */
  connectionState: ConnectionState;
  /** Telemetry data */
  telemetry: VenueTelemetry;
  /** Error message if any */
  error: string | null;
}

/**
 * Return type for composite hooks
 */
export interface CompositeHookReturn {
  /** Current composite price */
  price: number | null;
  /** Current composite bar */
  currentBar: CompositeBar | null;
  /** Historical composite bars */
  bars: CompositeBar[];
  /** Per-venue breakdown */
  venues: VenueContribution[];
  /** Degraded mode flag */
  degraded: boolean;
  /** Aggregate telemetry */
  telemetry: AggregateTelemetry;
}

/**
 * Return type for basis features hook
 */
export interface BasisHookReturn {
  /** Current basis features */
  current: BasisFeatures | null;
  /** Historical basis (aligned with bars) */
  history: BasisFeatures[];
  /** True if data is degraded */
  degraded: boolean;
}

// =============================================================================
// Soak Report Types (POC Evidence Artifact)
// =============================================================================

/**
 * Soak report snapshot - sampled periodically during a soak run
 */
export interface SoakSnapshot {
  tMs: number;
  tIso: string;
  asset: AssetId;
  spot: {
    compositePrice: number | null;
    degraded: boolean;
    degradedReason: string;
    connectedVenues: number;
    totalVenues: number;
    outliersTotal: number;
    gapsTotal: number;
  };
  perp: {
    compositePrice: number | null;
    degraded: boolean;
    connectedVenues: number;
    totalVenues: number;
  };
  basisBps: number | null;
  venues: Array<{
    venue: string;
    marketType: MarketType;
    connectionState: string;
    lastMessageTime: number | null;
    messageCount: number;
    tradeCount: number;
    reconnectCount: number;
    gapCount: number;
    uptimePercent: number;
    avgMessageRate: number;
  }>;
}

/**
 * Soak report summary - derived from snapshots on completion
 */
export interface SoakSummary {
  connectedPctByVenue: Record<string, number>;
  reconnectsByVenue: Record<string, number>;
  gapsByVenue: Record<string, number>;
  outliersTotal: number;
  degradedPctSpot: number;
  degradedPctPerp: number;
  notes: string[];
}

/**
 * Complete soak report - exported as JSON artifact
 */
export interface SoakReport {
  version: 'v0';
  createdAtIso: string;

  run: {
    asset: AssetId;
    startedAtMs: number;
    endedAtMs: number;
    durationMs: number;
    userAgent: string;
    pageVisibleApprox: boolean;
    pageWentBackground: boolean;
  };

  config: {
    pocPhase: string;
    venues: {
      spot: string[];
      perp: string[];
    };
    staleThresholdsMs: Record<string, { spot: number; perp: number }>;
    outlierThresholdBps: number;
    maxBarsPerVenue: number;
  };

  snapshots: SoakSnapshot[];
  summary: SoakSummary;
}
