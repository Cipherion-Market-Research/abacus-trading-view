'use client';

/**
 * Coinbase Spot WebSocket Hook
 *
 * POC-0 venue hook for Coinbase (Exchange) spot market data.
 * Coinbase uses a different subscription model than Binance.
 *
 * Reference: https://docs.cloud.coinbase.com/exchange/docs/websocket-overview
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
import { normalizeTimestamp, nowMs } from '../../utils/timestamps';

// =============================================================================
// Types
// =============================================================================

interface UseCoinbaseSpotOptions {
  asset: AssetId;
  enabled?: boolean;
}

/**
 * Coinbase WebSocket match (trade) message
 */
interface CoinbaseMatchMessage {
  type: 'match' | 'last_match';
  trade_id: number;
  sequence: number;
  maker_order_id: string;
  taker_order_id: string;
  time: string;       // ISO timestamp
  product_id: string; // e.g., "BTC-USD"
  size: string;       // Quantity
  price: string;      // Price
  side: 'buy' | 'sell'; // Taker side
}

/**
 * Coinbase subscription confirmation
 */
interface CoinbaseSubscriptionsMessage {
  type: 'subscriptions';
  channels: Array<{
    name: string;
    product_ids: string[];
  }>;
}

// =============================================================================
// Hook
// =============================================================================

export function useCoinbaseSpot({
  asset,
  enabled = true,
}: UseCoinbaseSpotOptions): VenueHookReturn {
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
  const symbol = getSymbol('coinbase', asset, 'spot');

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

    const wsUrl = VENUE_CONFIGS.coinbase.wsEndpoint.spot!;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Ignore if this WS is no longer current (stale callback)
      if (wsRef.current !== ws) return;

      // Coinbase requires sending a subscription message after connect
      const subscribeMsg = {
        type: 'subscribe',
        product_ids: [symbol],
        channels: ['matches'], // 'matches' channel for trades
      };
      ws.send(JSON.stringify(subscribeMsg));
      setConnectionState('connected');
      lastConnectedAtRef.current = Date.now();
    };

    ws.onmessage = (event) => {
      // Ignore if this WS is no longer current (stale callback)
      if (wsRef.current !== ws) return;

      try {
        const msg = JSON.parse(event.data);

        // Handle subscription confirmation
        if (msg.type === 'subscriptions') {
          console.log('[CoinbaseSpot] Subscribed:', msg);
          return;
        }

        // Handle trade messages
        if (msg.type === 'match' || msg.type === 'last_match') {
          const matchMsg = msg as CoinbaseMatchMessage;
          const localTime = nowMs();
          lastMessageTimeRef.current = localTime;
          messageCountRef.current++;
          tradeCountRef.current++;

          // Parse ISO timestamp to ms
          const tradeTime = new Date(matchMsg.time).getTime();

          // Convert to canonical trade
          const trade: Trade = {
            timestamp: tradeTime,
            localTimestamp: localTime,
            price: parseFloat(matchMsg.price),
            quantity: parseFloat(matchMsg.size),
            isBuyerMaker: matchMsg.side === 'sell', // If taker sold, buyer was maker
            venue: 'coinbase',
            asset,
            marketType: 'spot',
          };

          // Update bar state
          setBarState((prev) =>
            processTrade(prev, trade, {
              venue: 'coinbase',
              asset,
              marketType: 'spot',
              maxBars: MAX_BARS_PER_VENUE,
            })
          );
        }

        // Handle errors
        if (msg.type === 'error') {
          console.error('[CoinbaseSpot] Error message:', msg);
          setError(msg.message || 'Unknown error');
        }
      } catch (err) {
        console.error('[CoinbaseSpot] Error parsing message:', err);
      }
    };

    ws.onerror = () => {
      // Ignore if this WS is no longer current (stale callback)
      if (wsRef.current !== ws) return;
      console.error('[CoinbaseSpot] WebSocket error');
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
  }, [enabled, symbol, asset, cleanup]);

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
    venue: 'coinbase',
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

/**
 * Calculate cumulative uptime percentage across reconnects
 */
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
