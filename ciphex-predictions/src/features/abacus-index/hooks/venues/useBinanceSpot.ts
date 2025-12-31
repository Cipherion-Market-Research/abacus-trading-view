'use client';

/**
 * Binance Spot WebSocket Hook
 *
 * POC-0 venue hook for Binance spot market data.
 * Connects to Binance WebSocket and builds 1m bars from trade stream.
 *
 * Reference: https://binance-docs.github.io/apidocs/spot/en/#aggregate-trade-streams
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trade,
  Bar,
  VenueTelemetry,
  ConnectionState,
  AssetId,
  VenueHookReturn,
} from '../../types';
import { getSymbol, getStreamName } from '../../symbolMapping';
import { VENUE_CONFIGS, getStaleThreshold, MAX_BARS_PER_VENUE } from '../../constants';
import {
  createBarBuilderState,
  processTrade,
  discardPartialBar,
  getAllBars,
  getCurrentPrice,
  BarBuilderState,
} from '../../utils/barBuilder';
import { normalizeTimestamp, nowMs } from '../../utils/timestamps';

// =============================================================================
// Types
// =============================================================================

interface UseBinanceSpotOptions {
  asset: AssetId;
  enabled?: boolean;
}

/**
 * Binance aggregate trade WebSocket message
 */
interface BinanceAggTradeMessage {
  e: string;  // Event type: "aggTrade"
  E: number;  // Event time
  s: string;  // Symbol
  a: number;  // Aggregate trade ID
  p: string;  // Price
  q: string;  // Quantity
  f: number;  // First trade ID
  l: number;  // Last trade ID
  T: number;  // Trade time
  m: boolean; // Is buyer the maker?
}

// =============================================================================
// Hook
// =============================================================================

export function useBinanceSpot({
  asset,
  enabled = true,
}: UseBinanceSpotOptions): VenueHookReturn {
  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [barState, setBarState] = useState<BarBuilderState>(createBarBuilderState);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageTimeRef = useRef<number | null>(null);
  const messageCountRef = useRef<number>(0);
  const tradeCountRef = useRef<number>(0);
  const reconnectCountRef = useRef<number>(0);
  const sessionStartRef = useRef<number>(Date.now());
  // Uptime tracking: accumulate connected duration across reconnects
  const lastConnectedAtRef = useRef<number | null>(null);
  const accumulatedUptimeMsRef = useRef<number>(0);

  // Get symbol for this asset
  const symbol = getSymbol('binance', asset, 'spot');
  const streamName = getStreamName('binance', asset, 'spot');

  // Cleanup function
  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!enabled || !symbol || !streamName) return;

    cleanup();
    setConnectionState('connecting');
    setError(null);

    const wsUrl = `${VENUE_CONFIGS.binance.wsEndpoint.spot}/${streamName}@aggTrade`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Ignore if this WS is no longer current (stale callback)
      if (wsRef.current !== ws) return;
      setConnectionState('connected');
      lastConnectedAtRef.current = Date.now();
    };

    ws.onmessage = (event) => {
      // Ignore if this WS is no longer current (stale callback)
      if (wsRef.current !== ws) return;

      try {
        const msg: BinanceAggTradeMessage = JSON.parse(event.data);

        if (msg.e !== 'aggTrade') return;

        const localTime = nowMs();
        lastMessageTimeRef.current = localTime;
        messageCountRef.current++;
        tradeCountRef.current++;

        // Convert to canonical trade
        const trade: Trade = {
          timestamp: normalizeTimestamp(msg.T, 'binance'),
          localTimestamp: localTime,
          price: parseFloat(msg.p),
          quantity: parseFloat(msg.q),
          isBuyerMaker: msg.m,
          venue: 'binance',
          asset,
          marketType: 'spot',
        };

        // Update bar state
        setBarState((prev) =>
          processTrade(prev, trade, {
            venue: 'binance',
            asset,
            marketType: 'spot',
            maxBars: MAX_BARS_PER_VENUE,
          })
        );
      } catch (err) {
        console.error('[BinanceSpot] Error parsing message:', err);
      }
    };

    ws.onerror = () => {
      // Ignore if this WS is no longer current (stale callback)
      if (wsRef.current !== ws) return;
      console.error('[BinanceSpot] WebSocket error');
      setError('WebSocket error');
      setConnectionState('error');
    };

    ws.onclose = () => {
      // Ignore if this WS is no longer current (stale callback)
      if (wsRef.current !== ws) return;

      setConnectionState('disconnected');

      // Accumulate uptime before resetting lastConnectedAt
      if (lastConnectedAtRef.current !== null) {
        accumulatedUptimeMsRef.current += Date.now() - lastConnectedAtRef.current;
        lastConnectedAtRef.current = null;
      }

      // Discard partial bar on disconnect
      setBarState((prev) => discardPartialBar(prev));

      // Reconnect after delay (if still enabled)
      if (enabled) {
        reconnectCountRef.current++;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      }
    };
  }, [enabled, symbol, streamName, asset, cleanup]);

  // Connect on mount / reconnect on dependency change
  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  // Reset session stats when asset changes
  useEffect(() => {
    sessionStartRef.current = Date.now();
    messageCountRef.current = 0;
    tradeCountRef.current = 0;
    reconnectCountRef.current = 0;
    lastConnectedAtRef.current = null;
    accumulatedUptimeMsRef.current = 0;
    setBarState(createBarBuilderState());
  }, [asset]);

  // Compute telemetry
  const telemetry: VenueTelemetry = {
    venue: 'binance',
    marketType: 'spot',
    asset,
    connectionState,
    lastMessageTime: lastMessageTimeRef.current,
    messageCount: messageCountRef.current,
    tradeCount: tradeCountRef.current,
    reconnectCount: reconnectCountRef.current,
    gapCount: barState.gaps.length,
    outlierExclusionCount: 0, // Tracked at composite level
    sessionStartTime: sessionStartRef.current,
    uptimePercent: calculateUptime(
      sessionStartRef.current,
      lastConnectedAtRef.current,
      accumulatedUptimeMsRef.current
    ),
    avgMessageRate: calculateMessageRate(
      messageCountRef.current,
      sessionStartRef.current
    ),
  };

  // Return
  const allBars = getAllBars(barState);

  return {
    currentPrice: getCurrentPrice(barState),
    currentBar: barState.currentBar,
    bars: allBars,
    connectionState,
    telemetry,
    error,
  };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Calculate cumulative uptime percentage across reconnects
 *
 * @param sessionStart - Session start timestamp (ms)
 * @param lastConnectedAt - Last connection start time (null if currently disconnected)
 * @param accumulatedUptimeMs - Total uptime accumulated from previous connections
 */
function calculateUptime(
  sessionStart: number,
  lastConnectedAt: number | null,
  accumulatedUptimeMs: number
): number {
  const now = Date.now();
  const sessionDuration = now - sessionStart;
  if (sessionDuration === 0) return 0;

  // Total uptime = accumulated from past connections + current connection duration
  let totalUptimeMs = accumulatedUptimeMs;
  if (lastConnectedAt !== null) {
    totalUptimeMs += now - lastConnectedAt;
  }

  return Math.min(100, (totalUptimeMs / sessionDuration) * 100);
}

function calculateMessageRate(messageCount: number, sessionStart: number): number {
  const sessionDurationSec = (Date.now() - sessionStart) / 1000;
  if (sessionDurationSec === 0) return 0;
  return messageCount / sessionDurationSec;
}
