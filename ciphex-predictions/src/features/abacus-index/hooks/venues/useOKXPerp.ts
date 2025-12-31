'use client';

/**
 * OKX Perpetual WebSocket Hook
 *
 * POC-1 venue hook for OKX USDT-margined perpetual swaps.
 * Uses the same WebSocket endpoint as spot with different instId format.
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

interface UseOKXPerpOptions {
  asset: AssetId;
  enabled?: boolean;
}

/**
 * OKX trade message structure (same for spot and perp)
 */
interface OKXTradeMessage {
  arg: {
    channel: string;
    instId: string;
  };
  data: Array<{
    instId: string;
    tradeId: string;
    px: string;
    sz: string;
    side: 'buy' | 'sell';
    ts: string;
  }>;
}

// =============================================================================
// Hook
// =============================================================================

export function useOKXPerp({
  asset,
  enabled = true,
}: UseOKXPerpOptions): VenueHookReturn {
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

  // Get symbol for this asset (e.g., "BTC-USDT-SWAP")
  const symbol = getSymbol('okx', asset, 'perp');

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

    // OKX uses same endpoint for spot and perp
    const wsUrl = VENUE_CONFIGS.okx.wsEndpoint.perp!;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Ignore if this WS is no longer current (stale callback)
      if (wsRef.current !== ws) return;

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
          console.log('[OKXPerp] Subscribed:', msg);
          return;
        }

        // Handle errors
        if (msg.event === 'error') {
          console.error('[OKXPerp] Error:', msg);
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

            const canonicalTrade: Trade = {
              timestamp: parseInt(trade.ts, 10),
              localTimestamp: localTime,
              price: parseFloat(trade.px),
              quantity: parseFloat(trade.sz),
              isBuyerMaker: trade.side === 'sell',
              venue: 'okx',
              asset,
              marketType: 'perp',
            };

            setBarState((prev) =>
              processTrade(prev, canonicalTrade, {
                venue: 'okx',
                asset,
                marketType: 'perp',
                maxBars: MAX_BARS_PER_VENUE,
              })
            );
          }
        }
      } catch (err) {
        console.error('[OKXPerp] Error parsing message:', err);
      }
    };

    ws.onerror = () => {
      // Ignore if this WS is no longer current (stale callback)
      if (wsRef.current !== ws) return;
      console.error('[OKXPerp] WebSocket error');
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
    venue: 'okx',
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
