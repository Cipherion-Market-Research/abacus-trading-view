'use client';

/**
 * Kraken Spot WebSocket Hook
 *
 * POC-2 venue hook for Kraken spot market data.
 * Kraken is a USD anchor venue with strong regulatory standing.
 *
 * Quirks:
 * - Uses XBT instead of BTC (XBT/USD, not BTC/USD)
 * - Trade messages are arrays, not objects
 * - Subscription confirmation uses different message format
 *
 * Reference: https://docs.kraken.com/websockets/
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trade,
  VenueTelemetry,
  ConnectionState,
  AssetId,
  VenueHookReturn,
} from '../../types';
import { getSymbol } from '../../symbolMapping';
import { VENUE_CONFIGS, MAX_BARS_PER_VENUE } from '../../constants';
import {
  createBarBuilderState,
  processTrade,
  discardPartialBar,
  getAllBars,
  getCurrentPrice,
  BarBuilderState,
} from '../../utils/barBuilder';
import { nowMs } from '../../utils/timestamps';

// =============================================================================
// Types
// =============================================================================

interface UseKrakenSpotOptions {
  asset: AssetId;
  enabled?: boolean;
}

/**
 * Kraken trade message format
 * Trades come as arrays: [channelID, [[price, volume, time, side, orderType, misc], ...], channelName, pair]
 */
type KrakenTradeMessage = [
  number,                          // channelID
  Array<[string, string, string, string, string, string]>,  // trades array
  string,                          // channelName: "trade"
  string,                          // pair: "XBT/USD"
];

/**
 * Kraken subscription status message
 */
interface KrakenSubscriptionStatus {
  channelID?: number;
  channelName?: string;
  event: string;
  pair?: string;
  status?: string;
  subscription?: {
    name: string;
  };
}

/**
 * Kraken system status message
 */
interface KrakenSystemStatus {
  connectionID: number;
  event: 'systemStatus';
  status: string;
  version: string;
}

/**
 * Kraken heartbeat message
 */
interface KrakenHeartbeat {
  event: 'heartbeat';
}

// =============================================================================
// Hook
// =============================================================================

export function useKrakenSpot({
  asset,
  enabled = true,
}: UseKrakenSpotOptions): VenueHookReturn {
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
  // Uptime tracking
  const lastConnectedAtRef = useRef<number | null>(null);
  const accumulatedUptimeMsRef = useRef<number>(0);

  // Get symbol for this asset (XBT/USD for BTC, ETH/USD for ETH)
  const symbol = getSymbol('kraken', asset, 'spot');

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
    if (!enabled || !symbol) return;

    cleanup();
    setConnectionState('connecting');
    setError(null);

    const wsUrl = VENUE_CONFIGS.kraken.wsEndpoint.spot!;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Ignore if this WS is no longer current (stale callback)
      if (wsRef.current !== ws) return;

      // Subscribe to trade channel for the symbol
      const subscribeMsg = {
        event: 'subscribe',
        pair: [symbol],
        subscription: {
          name: 'trade',
        },
      };
      ws.send(JSON.stringify(subscribeMsg));
      setConnectionState('connected');
      lastConnectedAtRef.current = Date.now();
    };

    ws.onmessage = (event) => {
      // Ignore if this WS is no longer current (stale callback)
      if (wsRef.current !== ws) return;

      try {
        const data = JSON.parse(event.data);

        // Handle system status
        if (data.event === 'systemStatus') {
          const status = data as KrakenSystemStatus;
          console.log('[KrakenSpot] System status:', status.status);
          return;
        }

        // Handle heartbeat
        if (data.event === 'heartbeat') {
          return;
        }

        // Handle subscription status
        if (data.event === 'subscriptionStatus') {
          const status = data as KrakenSubscriptionStatus;
          if (status.status === 'subscribed') {
            console.log('[KrakenSpot] Subscribed to', status.pair);
          } else if (status.status === 'error') {
            console.error('[KrakenSpot] Subscription error:', data);
            setError('Subscription failed');
          }
          return;
        }

        // Handle trade messages (arrays)
        if (Array.isArray(data) && data.length === 4 && data[2] === 'trade') {
          const tradeMsg = data as KrakenTradeMessage;
          const trades = tradeMsg[1];
          const pair = tradeMsg[3];

          // Verify this is for our symbol
          if (pair !== symbol) return;

          const localTime = nowMs();
          lastMessageTimeRef.current = localTime;
          messageCountRef.current++;

          // Process each trade in the batch
          for (const tradeData of trades) {
            const [price, volume, time, side] = tradeData;
            tradeCountRef.current++;

            // Kraken time is in seconds with decimal precision
            const tradeTimeMs = parseFloat(time) * 1000;

            // Convert to canonical trade
            const trade: Trade = {
              timestamp: tradeTimeMs,
              localTimestamp: localTime,
              price: parseFloat(price),
              quantity: parseFloat(volume),
              // Kraken side: 'b' = buy, 's' = sell (taker side)
              // isBuyerMaker = true when taker sold (seller took), meaning buyer was maker
              isBuyerMaker: side === 's',
              venue: 'kraken',
              asset,
              marketType: 'spot',
            };

            // Update bar state
            setBarState((prev) =>
              processTrade(prev, trade, {
                venue: 'kraken',
                asset,
                marketType: 'spot',
                maxBars: MAX_BARS_PER_VENUE,
              })
            );
          }
        }
      } catch (err) {
        console.error('[KrakenSpot] Error parsing message:', err);
      }
    };

    ws.onerror = () => {
      // Ignore if this WS is no longer current (stale callback)
      if (wsRef.current !== ws) return;
      console.error('[KrakenSpot] WebSocket error');
      setError('WebSocket error');
      setConnectionState('error');
    };

    ws.onclose = () => {
      // Ignore if this WS is no longer current (stale callback)
      if (wsRef.current !== ws) return;

      setConnectionState('disconnected');

      // Accumulate uptime
      if (lastConnectedAtRef.current !== null) {
        accumulatedUptimeMsRef.current += Date.now() - lastConnectedAtRef.current;
        lastConnectedAtRef.current = null;
      }

      // Discard partial bar on disconnect
      setBarState((prev) => discardPartialBar(prev));

      // Reconnect after delay
      if (enabled) {
        reconnectCountRef.current++;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      }
    };
  }, [enabled, symbol, asset, cleanup]);

  // Connect on mount
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
    venue: 'kraken',
    marketType: 'spot',
    asset,
    connectionState,
    lastMessageTime: lastMessageTimeRef.current,
    messageCount: messageCountRef.current,
    tradeCount: tradeCountRef.current,
    reconnectCount: reconnectCountRef.current,
    gapCount: barState.gaps.length,
    outlierExclusionCount: 0,
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

function calculateUptime(
  sessionStart: number,
  lastConnectedAt: number | null,
  accumulatedUptimeMs: number
): number {
  const now = Date.now();
  const sessionDuration = now - sessionStart;
  if (sessionDuration === 0) return 0;

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
