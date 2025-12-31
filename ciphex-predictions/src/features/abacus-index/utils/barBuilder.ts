/**
 * Bar Builder Utility
 *
 * Constructs 1-minute OHLCV bars from trade streams.
 * Handles partial bars, bar completion, and gap detection.
 */

import { Trade, Bar, VenueId, AssetId, MarketType } from '../types';
import { BAR_INTERVAL_SECONDS, MAX_TRADE_BUFFER_SIZE } from '../constants';

// =============================================================================
// Types
// =============================================================================

export interface BarBuilderState {
  /** Current partial bar being built */
  currentBar: Bar | null;
  /** Completed bars (most recent last) */
  completedBars: Bar[];
  /** Trades buffered for current bar */
  tradeBuffer: Trade[];
  /** Last bar close time (for gap detection) */
  lastBarTime: number | null;
  /** Detected gaps (missing bar times) */
  gaps: number[];
}

export interface BarBuilderConfig {
  venue: VenueId;
  asset: AssetId;
  marketType: MarketType;
  /** Maximum completed bars to retain */
  maxBars?: number;
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Create initial bar builder state
 */
export function createBarBuilderState(): BarBuilderState {
  return {
    currentBar: null,
    completedBars: [],
    tradeBuffer: [],
    lastBarTime: null,
    gaps: [],
  };
}

/**
 * Get the bar start time for a given timestamp
 * Floors to the nearest minute boundary
 */
export function getBarTime(timestampMs: number): number {
  const seconds = Math.floor(timestampMs / 1000);
  return Math.floor(seconds / BAR_INTERVAL_SECONDS) * BAR_INTERVAL_SECONDS;
}

/**
 * Process a trade and update bar state
 *
 * @param state - Current bar builder state
 * @param trade - Incoming trade
 * @param config - Bar builder configuration
 * @returns Updated state
 */
export function processTrade(
  state: BarBuilderState,
  trade: Trade,
  config: BarBuilderConfig
): BarBuilderState {
  const barTime = getBarTime(trade.timestamp);
  const { venue, asset, marketType, maxBars = 1000 } = config;

  // Clone state for immutability
  let newState: BarBuilderState = {
    ...state,
    tradeBuffer: [...state.tradeBuffer],
    completedBars: [...state.completedBars],
    gaps: [...state.gaps],
  };

  // Check if this trade belongs to a new bar
  if (newState.currentBar && barTime > newState.currentBar.time) {
    // Complete the current bar
    const completedBar: Bar = {
      ...newState.currentBar,
      isPartial: false,
    };
    newState.completedBars.push(completedBar);

    // Detect gaps (missing bars)
    if (newState.lastBarTime !== null) {
      const expectedBars = (barTime - newState.lastBarTime) / BAR_INTERVAL_SECONDS;
      if (expectedBars > 1) {
        // There are missing bars
        for (let i = 1; i < expectedBars; i++) {
          const missingTime = newState.lastBarTime + i * BAR_INTERVAL_SECONDS;
          newState.gaps.push(missingTime);
        }
      }
    }

    newState.lastBarTime = completedBar.time;
    newState.currentBar = null;
    newState.tradeBuffer = [];

    // Trim old bars if needed
    if (newState.completedBars.length > maxBars) {
      newState.completedBars = newState.completedBars.slice(-maxBars);
    }
  }

  // Initialize new bar if needed
  if (!newState.currentBar || barTime > newState.currentBar.time) {
    newState.currentBar = {
      time: barTime,
      open: trade.price,
      high: trade.price,
      low: trade.price,
      close: trade.price,
      volume: trade.quantity,
      tradeCount: 1,
      venue,
      asset,
      marketType,
      isPartial: true,
    };
    newState.tradeBuffer = [trade];
  } else {
    // Update existing bar
    newState.currentBar = {
      ...newState.currentBar,
      high: Math.max(newState.currentBar.high, trade.price),
      low: Math.min(newState.currentBar.low, trade.price),
      close: trade.price,
      volume: newState.currentBar.volume + trade.quantity,
      tradeCount: newState.currentBar.tradeCount + 1,
    };

    // Buffer trade (with size limit)
    if (newState.tradeBuffer.length < MAX_TRADE_BUFFER_SIZE) {
      newState.tradeBuffer.push(trade);
    }
  }

  return newState;
}

/**
 * Force-complete the current bar (e.g., on reconnect)
 * Marks the bar as potentially incomplete
 */
export function forceCompleteBar(state: BarBuilderState): BarBuilderState {
  if (!state.currentBar) {
    return state;
  }

  const completedBar: Bar = {
    ...state.currentBar,
    isPartial: false, // Mark as complete even though it may be incomplete
  };

  return {
    ...state,
    currentBar: null,
    completedBars: [...state.completedBars, completedBar],
    tradeBuffer: [],
    lastBarTime: completedBar.time,
  };
}

/**
 * Discard the current partial bar (e.g., on reconnect when we can't trust it)
 *
 * Gap recording logic:
 * - Only record a gap if we've completed at least one bar (lastBarTime !== null)
 * - This prevents spurious gap counts from cold-start scenarios:
 *   - React strict mode double-mount
 *   - Initial WebSocket connection before first bar completes
 * - The gap detection in processTrade() will catch any missed bars on reconnect
 */
export function discardPartialBar(state: BarBuilderState): BarBuilderState {
  if (!state.currentBar) {
    return state;
  }

  // Only record gap if we have established continuity (completed at least one bar)
  // Cold-start discards should not count as gaps
  const newGaps = [...state.gaps];
  if (state.lastBarTime !== null) {
    newGaps.push(state.currentBar.time);
  }

  return {
    ...state,
    currentBar: null,
    tradeBuffer: [],
    gaps: newGaps,
  };
}

/**
 * Get all bars (completed + current partial)
 */
export function getAllBars(state: BarBuilderState): Bar[] {
  if (state.currentBar) {
    return [...state.completedBars, state.currentBar];
  }
  return state.completedBars;
}

/**
 * Get the current close price
 */
export function getCurrentPrice(state: BarBuilderState): number | null {
  return state.currentBar?.close ?? state.completedBars[state.completedBars.length - 1]?.close ?? null;
}

// =============================================================================
// Batch Processing
// =============================================================================

/**
 * Process multiple trades at once (for initial data load)
 */
export function processTradesBatch(
  state: BarBuilderState,
  trades: Trade[],
  config: BarBuilderConfig
): BarBuilderState {
  let currentState = state;
  for (const trade of trades) {
    currentState = processTrade(currentState, trade, config);
  }
  return currentState;
}

// =============================================================================
// Bar Merging (for composites)
// =============================================================================

/**
 * Align bars from multiple sources by time
 * Returns bars that exist in all sources at each time
 *
 * Optimized to O(N) using Map lookups instead of O(N²) with .find()
 */
export function alignBars(barSets: Bar[][]): Map<number, Bar[]> {
  const aligned = new Map<number, Bar[]>();

  // Build a lookup Map for each bar set: time -> Bar
  // This gives O(1) lookup per time instead of O(N) with .find()
  const barMaps: Map<number, Bar>[] = barSets.map((bars) => {
    const map = new Map<number, Bar>();
    for (const bar of bars) {
      map.set(bar.time, bar);
    }
    return map;
  });

  // Collect all unique times
  const allTimes = new Set<number>();
  for (const bars of barSets) {
    for (const bar of bars) {
      allTimes.add(bar.time);
    }
  }

  // For each time, collect bars from each source using O(1) Map lookup
  for (const time of allTimes) {
    const barsAtTime: Bar[] = [];
    for (const barMap of barMaps) {
      const bar = barMap.get(time);
      if (bar) {
        barsAtTime.push(bar);
      }
    }
    aligned.set(time, barsAtTime);
  }

  return aligned;
}
