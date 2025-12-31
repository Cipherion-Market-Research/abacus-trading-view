'use client';

/**
 * OKX Spot WebSocket Hook
 *
 * POC-1 venue hook for OKX spot market data.
 * OKX uses a unified WebSocket API for both spot and derivatives.
 *
 * Reference: https://www.okx.com/docs-v5/en/#order-book-trading-market-data-ws-trades-channel
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

interface UseOKXSpotOptions {
  asset: AssetId;
  enabled?: boolean;
}

/**
 * OKX trade message structure
 */
interface OKXTradeMessage {
  arg: {
    channel: string;
    instId: string;
  };
  data: Array<{
    instId: string;
    tradeId: string;
    px: string;      // Price
    sz: string;      // Size/quantity
    side: 'buy' | 'sell';  // Taker side
    ts: string;      // Timestamp in ms
  }>;
}

/**
 * OKX subscription response
 */
interface OKXSubscribeResponse {
  event: 'subscribe' | 'unsubscribe' | 'error';
  arg?: {
    channel: string;
    instId: string;
  };
  code?: string;
  msg?: string;
}

// =============================================================================
// Hook
// =============================================================================

export function useOKXSpot({
  asset,
  enabled = true,
}: UseOKXSpotOptions): VenueHookReturn {
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
  const lastConnectedAtRef = useRef<number | null>(null);
  const accumulatedUptimeMsRef = useRef<number>(0);

  // Get symbol for this asset
  const symbol = getSymbol('okx', asset, 'spot');

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

    const wsUrl = VENUE_CONFIGS.okx.wsEndpoint.spot!;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Ignore if this WS is no longer current (stale callback)
      if (wsRef.current !== ws) return;

      // OKX requires sending a subscription message after connect
      const subscribeMsg = {
        op: 'subscribe',
        args: [{
          channel: 'trades',
          instId: symbol,
        }],
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
        if (msg.event === 'subscribe') {
          console.log('[OKXSpot] Subscribed:', msg);
          return;
        }

        // Handle errors
        if (msg.event === 'error') {
          console.error('[OKXSpot] Error:', msg);
          setError(msg.msg || 'Unknown error');
          return;
        }

        // Handle trade messages
        if (msg.arg?.channel === 'trades' && msg.data) {
          const tradeMsg = msg as OKXTradeMessage;
          const localTime = nowMs();

          for (const trade of tradeMsg.data) {
            lastMessageTimeRef.current = localTime;
            messageCountRef.current++;
            tradeCountRef.current++;

            // Convert to canonical trade
            const canonicalTrade: Trade = {
              timestamp: parseInt(trade.ts, 10),
              localTimestamp: localTime,
              price: parseFloat(trade.px),
              quantity: parseFloat(trade.sz),
              isBuyerMaker: trade.side === 'sell', // If taker sold, buyer was maker
              venue: 'okx',
              asset,
              marketType: 'spot',
            };

            // Update bar state
            setBarState((prev) =>
              processTrade(prev, canonicalTrade, {
                venue: 'okx',
                asset,
                marketType: 'spot',
                maxBars: MAX_BARS_PER_VENUE,
              })
            );
          }
        }
      } catch (err) {
        console.error('[OKXSpot] Error parsing message:', err);
      }
    };

    ws.onerror = () => {
      // Ignore if this WS is no longer current (stale callback)
      if (wsRef.current !== ws) return;
      console.error('[OKXSpot] WebSocket error');
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
    venue: 'okx',
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
