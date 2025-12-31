'use client';

/**
 * Bybit Perpetual WebSocket Hook
 *
 * POC-1 venue hook for Bybit USDT perpetual futures.
 * Uses the v5 unified API.
 *
 * Reference: https://bybit-exchange.github.io/docs/v5/websocket/public/trade
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

interface UseBybitPerpOptions {
  asset: AssetId;
  enabled?: boolean;
}

/**
 * Bybit v5 trade message structure
 */
interface BybitTradeMessage {
  topic: string;
  ts: number;
  type: 'snapshot' | 'delta';
  data: Array<{
    T: number;    // Trade timestamp (ms)
    s: string;    // Symbol
    S: 'Buy' | 'Sell';  // Side (taker direction)
    v: string;    // Trade size
    p: string;    // Trade price
    L: string;    // Tick direction (PlusTick, MinusTick, etc.)
    i: string;    // Trade ID
    BT: boolean;  // Is block trade
  }>;
}

/**
 * Bybit subscription response
 */
interface BybitSubscribeResponse {
  success: boolean;
  ret_msg: string;
  conn_id: string;
  req_id?: string;
  op: string;
}

// =============================================================================
// Hook
// =============================================================================

export function useBybitPerp({
  asset,
  enabled = true,
}: UseBybitPerpOptions): VenueHookReturn {
  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [barState, setBarState] = useState<BarBuilderState>(createBarBuilderState);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageTimeRef = useRef<number | null>(null);
  const messageCountRef = useRef<number>(0);
  const tradeCountRef = useRef<number>(0);
  const reconnectCountRef = useRef<number>(0);
  const sessionStartRef = useRef<number>(Date.now());
  const lastConnectedAtRef = useRef<number | null>(null);
  const accumulatedUptimeMsRef = useRef<number>(0);

  // Get symbol for this asset
  const symbol = getSymbol('bybit', asset, 'perp');

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
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!enabled || !symbol) return;

    cleanup();
    setConnectionState('connecting');
    setError(null);

    const wsUrl = VENUE_CONFIGS.bybit.wsEndpoint.perp!;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Ignore if this WS is no longer current (stale callback)
      if (wsRef.current !== ws) return;

      // Subscribe to public trades
      const subscribeMsg = {
        op: 'subscribe',
        args: [`publicTrade.${symbol}`],
      };
      ws.send(JSON.stringify(subscribeMsg));
      setConnectionState('connected');
      lastConnectedAtRef.current = Date.now();

      // Bybit requires periodic pings to keep connection alive
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ op: 'ping' }));
        }
      }, 20000); // Ping every 20 seconds
    };

    ws.onmessage = (event) => {
      // Ignore if this WS is no longer current (stale callback)
      if (wsRef.current !== ws) return;

      try {
        const msg = JSON.parse(event.data);

        // Handle subscription confirmation
        if (msg.op === 'subscribe') {
          if (msg.success) {
            console.log('[BybitPerp] Subscribed:', msg);
          } else {
            console.error('[BybitPerp] Subscription failed:', msg);
            setError(msg.ret_msg || 'Subscription failed');
          }
          return;
        }

        // Handle pong
        if (msg.op === 'pong') {
          return;
        }

        // Handle trade messages
        if (msg.topic?.startsWith('publicTrade.') && msg.data) {
          const tradeMsg = msg as BybitTradeMessage;
          const localTime = nowMs();

          for (const trade of tradeMsg.data) {
            // Skip block trades (large OTC trades that shouldn't affect index)
            if (trade.BT) continue;

            lastMessageTimeRef.current = localTime;
            messageCountRef.current++;
            tradeCountRef.current++;

            const canonicalTrade: Trade = {
              timestamp: trade.T,
              localTimestamp: localTime,
              price: parseFloat(trade.p),
              quantity: parseFloat(trade.v),
              isBuyerMaker: trade.S === 'Sell', // If taker sold, buyer was maker
              venue: 'bybit',
              asset,
              marketType: 'perp',
            };

            setBarState((prev) =>
              processTrade(prev, canonicalTrade, {
                venue: 'bybit',
                asset,
                marketType: 'perp',
                maxBars: MAX_BARS_PER_VENUE,
              })
            );
          }
        }
      } catch (err) {
        console.error('[BybitPerp] Error parsing message:', err);
      }
    };

    ws.onerror = () => {
      // Ignore if this WS is no longer current (stale callback)
      if (wsRef.current !== ws) return;
      console.error('[BybitPerp] WebSocket error');
      setError('WebSocket error');
      setConnectionState('error');
    };

    ws.onclose = () => {
      // Ignore if this WS is no longer current (stale callback)
      if (wsRef.current !== ws) return;

      setConnectionState('disconnected');

      if (lastConnectedAtRef.current !== null) {
        accumulatedUptimeMsRef.current += Date.now() - lastConnectedAtRef.current;
        lastConnectedAtRef.current = null;
      }

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      setBarState((prev) => discardPartialBar(prev));

      if (enabled) {
        reconnectCountRef.current++;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      }
    };
  }, [enabled, symbol, asset, cleanup]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  useEffect(() => {
    sessionStartRef.current = Date.now();
    messageCountRef.current = 0;
    tradeCountRef.current = 0;
    reconnectCountRef.current = 0;
    lastConnectedAtRef.current = null;
    accumulatedUptimeMsRef.current = 0;
    setBarState(createBarBuilderState());
  }, [asset]);

  const telemetry: VenueTelemetry = {
    venue: 'bybit',
    marketType: 'perp',
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
