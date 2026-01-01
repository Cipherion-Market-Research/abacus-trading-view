'use client';

/**
 * Soak Report API Hook
 *
 * API-backed soak test for ECS Indexer validation.
 * Polls /v0/latest and /v0/telemetry to generate the same JSON artifact
 * format as the browser-based soak.
 *
 * Production API Contract (v0.1.7):
 * - /v0/latest returns array of {asset, market_type, price, degraded, included_venues, last_bar}
 * - /v0/telemetry returns {venues[], system_health, connected_spot_venues, connected_perp_venues}
 * - All fields use snake_case
 *
 * Type A Go/No-go Criteria:
 * - Focus on is_gap=false and included_venues.length >= 2 (NOT degraded flag)
 * - With PREFERRED_QUORUM=3 and only 2 spot venues, degraded will always be true
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AssetId,
  SoakReport,
  SoakSnapshot,
  SoakSummary,
  MarketType,
} from '../types';
import {
  CURRENT_POC_PHASE,
  POC_PHASES,
  STALE_THRESHOLDS_MS,
  OUTLIER_THRESHOLD_BPS,
  MAX_BARS_PER_VENUE,
} from '../constants';

// =============================================================================
// Constants
// =============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_ABACUS_API_BASE_URL || 'https://api.ciphex.io/indexer/v0';
const SAMPLE_INTERVAL_MS = 15_000; // 15 seconds (same as browser soak)
const AUTO_PERSIST_INTERVAL_MS = 60_000;
const SNAPSHOT_WARNING_THRESHOLD = 1000;
const LOCAL_STORAGE_KEY = 'abacus:soak:lastReport:api';

// =============================================================================
// Production API Response Types (v0.1.7 snake_case contract)
// =============================================================================

/**
 * /v0/latest returns array of these
 */
interface ApiLatestItem {
  asset: string;
  market_type: string;
  price: number | null;
  time: number;
  degraded: boolean;
  included_venues: string[];
  last_bar: {
    time: number;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number;
    degraded: boolean;
    is_gap: boolean;
  } | null;
}

/**
 * /v0/telemetry response
 */
interface ApiTelemetryResponse {
  venues: Array<{
    venue: string;
    asset: string;
    market_type: string;
    connection_state: string;
    last_message_time: number | null;
    message_count: number;
    trade_count: number;
    reconnect_count: number;
    uptime_percent: number;
  }>;
  system_health: string;
  connected_spot_venues: number;
  connected_perp_venues: number;
  timestamp: string;
}

// =============================================================================
// Types
// =============================================================================

export type SoakState = 'idle' | 'running' | 'stopped';

export interface UseSoakReportApiOptions {
  asset: AssetId;
}

export interface UseSoakReportApiReturn {
  state: SoakState;
  report: SoakReport | null;
  snapshotCount: number;
  elapsedMs: number;
  pageWentBackground: boolean;
  showSnapshotWarning: boolean;
  apiError: string | null;

  start: () => void;
  stop: () => void;
  reset: () => void;
  addNote: (note: string) => void;
  downloadJson: () => void;
}

// =============================================================================
// Hook
// =============================================================================

export function useSoakReportApi({ asset }: UseSoakReportApiOptions): UseSoakReportApiReturn {
  // State
  const [state, setState] = useState<SoakState>('idle');
  const [report, setReport] = useState<SoakReport | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [pageWentBackground, setPageWentBackground] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Refs
  const startTimeRef = useRef<number>(0);
  const snapshotsRef = useRef<SoakSnapshot[]>([]);
  const notesRef = useRef<string[]>([]);
  const sampleIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const persistIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const assetAtStartRef = useRef<AssetId>(asset);

  // Derived
  const snapshotCount = snapshotsRef.current.length;
  const showSnapshotWarning = snapshotCount >= SNAPSHOT_WARNING_THRESHOLD;

  // -------------------------------------------------------------------------
  // Visibility tracking
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (state !== 'running') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        setPageWentBackground(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state]);

  // -------------------------------------------------------------------------
  // Fetch and take snapshot from API (production contract)
  // -------------------------------------------------------------------------
  const takeSnapshotFromApi = useCallback(async (): Promise<SoakSnapshot | null> => {
    const currentAsset = assetAtStartRef.current;

    try {
      // Fetch latest and telemetry in parallel
      const [latestRes, telemetryRes] = await Promise.all([
        fetch(`${API_BASE_URL}/latest?asset=${currentAsset}`),
        fetch(`${API_BASE_URL}/telemetry`),
      ]);

      if (!latestRes.ok || !telemetryRes.ok) {
        throw new Error(`API error: latest=${latestRes.status}, telemetry=${telemetryRes.status}`);
      }

      // Production /latest returns array
      const latestData: ApiLatestItem[] = await latestRes.json();
      const telemetryData: ApiTelemetryResponse = await telemetryRes.json();

      // Find spot and perp entries for this asset
      const spotEntry = latestData.find(d => d.market_type === 'spot');
      const perpEntry = latestData.find(d => d.market_type === 'perp');

      const now = Date.now();

      // Filter telemetry venues by current asset
      const assetVenues = telemetryData.venues.filter(v => v.asset === currentAsset);
      const spotVenues = assetVenues.filter(v => v.market_type === 'spot');
      const perpVenues = assetVenues.filter(v => v.market_type === 'perp');

      // Convert telemetry venues to snapshot format
      const allVenues: SoakSnapshot['venues'] = assetVenues.map(v => ({
        venue: v.venue,
        marketType: v.market_type as MarketType,
        connectionState: v.connection_state,
        lastMessageTime: v.last_message_time,
        messageCount: v.message_count,
        tradeCount: v.trade_count,
        reconnectCount: v.reconnect_count,
        gapCount: 0, // Not available from production telemetry endpoint
        uptimePercent: v.uptime_percent,
        avgMessageRate: v.message_count / Math.max(1, (now - startTimeRef.current) / 1000),
      }));

      // Count connected venues
      const connectedSpot = spotVenues.filter(v => v.connection_state === 'connected').length;
      const connectedPerp = perpVenues.filter(v => v.connection_state === 'connected').length;

      // For Type A soak, key metric is is_gap=false and included_venues >= 2
      // NOT the degraded flag (which will always be true with 2 venues and PREFERRED_QUORUM=3)
      const spotIsGap = spotEntry?.last_bar?.is_gap ?? true;
      const spotIncludedCount = spotEntry?.included_venues.length ?? 0;

      // Compute degraded for snapshot compatibility (but Type A ignores this)
      // Use our own criteria: gap or < 2 venues
      const spotDegraded = spotIsGap || spotIncludedCount < 2;
      const perpDegraded = perpEntry?.last_bar?.is_gap ?? true;

      // Compute basis
      const basisBps = (spotEntry?.price && perpEntry?.price)
        ? ((perpEntry.price - spotEntry.price) / spotEntry.price) * 10000
        : null;

      setApiError(null);

      return {
        tMs: now,
        tIso: new Date(now).toISOString(),
        asset: currentAsset,
        spot: {
          compositePrice: spotEntry?.price ?? null,
          degraded: spotDegraded,
          // Type A criteria: use is_gap status
          degradedReason: spotIsGap ? 'gap' : (spotIncludedCount < 2 ? 'below_quorum' : 'none'),
          connectedVenues: connectedSpot,
          totalVenues: spotVenues.length || 2, // Production has 2 spot venues
          outliersTotal: 0, // Not tracked in production telemetry
          gapsTotal: spotIsGap ? 1 : 0, // Track gap status from last_bar
        },
        perp: {
          compositePrice: perpEntry?.price ?? null,
          degraded: perpDegraded,
          connectedVenues: connectedPerp,
          totalVenues: perpVenues.length || 1, // Production has 1 perp venue
        },
        basisBps,
        venues: allVenues,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown API error';
      console.error('[useSoakReportApi] Error taking snapshot:', errorMsg);
      setApiError(errorMsg);
      return null;
    }
  }, []);

  // -------------------------------------------------------------------------
  // Compute summary from snapshots
  // -------------------------------------------------------------------------
  const computeSummary = useCallback((snapshots: SoakSnapshot[]): SoakSummary => {
    if (snapshots.length === 0) {
      return {
        connectedPctByVenue: {},
        reconnectsByVenue: {},
        gapsByVenue: {},
        outliersTotal: 0,
        degradedPctSpot: 0,
        degradedPctPerp: 0,
        notes: [...notesRef.current],
      };
    }

    const venueConnectedCounts: Record<string, number> = {};
    const venueReconnectsFirst: Record<string, number> = {};
    const venueReconnectsLast: Record<string, number> = {};
    const venueMaxGaps: Record<string, number> = {};
    let maxOutliers = 0;
    let spotDegradedCount = 0;
    let perpDegradedCount = 0;
    let spotGapCount = 0; // Track gap snapshots for Type A

    snapshots.forEach((snap, idx) => {
      if (snap.spot.degraded) spotDegradedCount++;
      if (snap.perp.degraded) perpDegradedCount++;

      // Type A metric: count snapshots where spot was a gap
      if (snap.spot.gapsTotal > 0) spotGapCount++;

      if (snap.spot.outliersTotal > maxOutliers) {
        maxOutliers = snap.spot.outliersTotal;
      }

      snap.venues.forEach((v) => {
        const key = `${v.venue}_${v.marketType}`;

        if (v.connectionState === 'connected') {
          venueConnectedCounts[key] = (venueConnectedCounts[key] || 0) + 1;
        } else {
          venueConnectedCounts[key] = venueConnectedCounts[key] || 0;
        }

        if (idx === 0) {
          venueReconnectsFirst[key] = v.reconnectCount;
        }
        venueReconnectsLast[key] = v.reconnectCount;

        if (!venueMaxGaps[key] || v.gapCount > venueMaxGaps[key]) {
          venueMaxGaps[key] = v.gapCount;
        }
      });
    });

    const connectedPctByVenue: Record<string, number> = {};
    const reconnectsByVenue: Record<string, number> = {};

    Object.keys(venueConnectedCounts).forEach((key) => {
      connectedPctByVenue[key] = (venueConnectedCounts[key] / snapshots.length) * 100;
      reconnectsByVenue[key] = (venueReconnectsLast[key] || 0) - (venueReconnectsFirst[key] || 0);
    });

    const notes = [...notesRef.current];
    notes.unshift(`[API] Soak against ECS Indexer ${API_BASE_URL}`);

    // Add Type A metrics to notes
    const nonGapPct = ((snapshots.length - spotGapCount) / snapshots.length) * 100;
    notes.push(`[Type A] Spot non-gap rate: ${nonGapPct.toFixed(1)}% (target: >=95%)`);

    if (snapshots.length >= SNAPSHOT_WARNING_THRESHOLD) {
      const warningNote = `[auto] Snapshot count exceeded ${SNAPSHOT_WARNING_THRESHOLD}`;
      if (!notes.includes(warningNote)) {
        notes.push(warningNote);
      }
    }

    return {
      connectedPctByVenue,
      reconnectsByVenue,
      gapsByVenue: venueMaxGaps,
      outliersTotal: maxOutliers,
      degradedPctSpot: (spotDegradedCount / snapshots.length) * 100,
      degradedPctPerp: (perpDegradedCount / snapshots.length) * 100,
      notes,
    };
  }, []);

  // -------------------------------------------------------------------------
  // Build report object
  // -------------------------------------------------------------------------
  const buildReport = useCallback(
    (endTime: number): SoakReport => {
      const snapshots = snapshotsRef.current;
      const summary = computeSummary(snapshots);
      const phaseConfig = POC_PHASES[CURRENT_POC_PHASE];

      return {
        version: 'v0',
        createdAtIso: new Date(endTime).toISOString(),
        run: {
          asset: assetAtStartRef.current,
          startedAtMs: startTimeRef.current,
          endedAtMs: endTime,
          durationMs: endTime - startTimeRef.current,
          userAgent: `ECS-API/${API_BASE_URL}`,
          pageVisibleApprox: true, // API mode doesn't have browser throttling
          pageWentBackground,
        },
        config: {
          pocPhase: `${CURRENT_POC_PHASE}-API`,
          venues: {
            // Production config from task definition
            spot: ['binance', 'coinbase'],
            perp: ['binance'],
          },
          staleThresholdsMs: { ...STALE_THRESHOLDS_MS },
          outlierThresholdBps: OUTLIER_THRESHOLD_BPS,
          maxBarsPerVenue: MAX_BARS_PER_VENUE,
        },
        snapshots,
        summary,
      };
    },
    [computeSummary, pageWentBackground]
  );

  // -------------------------------------------------------------------------
  // Persist to localStorage
  // -------------------------------------------------------------------------
  const persistToLocalStorage = useCallback(() => {
    if (snapshotsRef.current.length === 0) return;

    try {
      const partialReport = buildReport(Date.now());
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(partialReport));
    } catch (e) {
      console.warn('[SoakReportApi] Failed to persist to localStorage:', e);
    }
  }, [buildReport]);

  // -------------------------------------------------------------------------
  // Start soak
  // -------------------------------------------------------------------------
  const start = useCallback(async () => {
    if (state === 'running') return;

    // Reset state
    const now = Date.now();
    startTimeRef.current = now;
    snapshotsRef.current = [];
    notesRef.current = [];
    assetAtStartRef.current = asset;
    setPageWentBackground(false);
    setElapsedMs(0);
    setReport(null);
    setApiError(null);
    setState('running');

    // Take initial snapshot
    const initialSnapshot = await takeSnapshotFromApi();
    if (initialSnapshot) {
      snapshotsRef.current.push(initialSnapshot);
    }

    // Start sampling interval
    sampleIntervalRef.current = setInterval(async () => {
      const snapshot = await takeSnapshotFromApi();
      if (snapshot) {
        snapshotsRef.current.push(snapshot);
      }
    }, SAMPLE_INTERVAL_MS);

    // Start auto-persist interval
    persistIntervalRef.current = setInterval(() => {
      persistToLocalStorage();
    }, AUTO_PERSIST_INTERVAL_MS);

    // Start elapsed timer
    elapsedIntervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 1000);
  }, [state, asset, takeSnapshotFromApi, persistToLocalStorage]);

  // -------------------------------------------------------------------------
  // Stop soak
  // -------------------------------------------------------------------------
  const stop = useCallback(async () => {
    if (state !== 'running') return;

    // Clear intervals
    if (sampleIntervalRef.current) {
      clearInterval(sampleIntervalRef.current);
      sampleIntervalRef.current = null;
    }
    if (persistIntervalRef.current) {
      clearInterval(persistIntervalRef.current);
      persistIntervalRef.current = null;
    }
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }

    // Take final snapshot
    const finalSnapshot = await takeSnapshotFromApi();
    if (finalSnapshot) {
      snapshotsRef.current.push(finalSnapshot);
    }

    // Build and save report
    const endTime = Date.now();
    const finalReport = buildReport(endTime);
    setReport(finalReport);
    setElapsedMs(endTime - startTimeRef.current);

    // Persist to localStorage
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(finalReport));
    } catch (e) {
      console.warn('[SoakReportApi] Failed to persist final report:', e);
    }

    setState('stopped');
  }, [state, takeSnapshotFromApi, buildReport]);

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------
  const reset = useCallback(() => {
    if (sampleIntervalRef.current) {
      clearInterval(sampleIntervalRef.current);
      sampleIntervalRef.current = null;
    }
    if (persistIntervalRef.current) {
      clearInterval(persistIntervalRef.current);
      persistIntervalRef.current = null;
    }
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }

    startTimeRef.current = 0;
    snapshotsRef.current = [];
    notesRef.current = [];
    setPageWentBackground(false);
    setElapsedMs(0);
    setReport(null);
    setApiError(null);
    setState('idle');
  }, []);

  // -------------------------------------------------------------------------
  // Add note
  // -------------------------------------------------------------------------
  const addNote = useCallback((note: string) => {
    const timestampedNote = `[${new Date().toISOString()}] ${note}`;
    notesRef.current.push(timestampedNote);
  }, []);

  // -------------------------------------------------------------------------
  // Download JSON
  // -------------------------------------------------------------------------
  const downloadJson = useCallback(() => {
    const reportToDownload = report || (state === 'running' ? buildReport(Date.now()) : null);
    if (!reportToDownload) return;

    const blob = new Blob([JSON.stringify(reportToDownload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);

    const durationMin = Math.round(reportToDownload.run.durationMs / 60000);
    const startIso = new Date(reportToDownload.run.startedAtMs).toISOString().replace(/[:.]/g, '-');
    const filename = `abacus_soak_report_API_${reportToDownload.run.asset}_${startIso}_${durationMin}min.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  }, [report, state, buildReport]);

  // -------------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (sampleIntervalRef.current) clearInterval(sampleIntervalRef.current);
      if (persistIntervalRef.current) clearInterval(persistIntervalRef.current);
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    };
  }, []);

  return {
    state,
    report,
    snapshotCount: snapshotsRef.current.length,
    elapsedMs,
    pageWentBackground,
    showSnapshotWarning,
    apiError,

    start,
    stop,
    reset,
    addNote,
    downloadJson,
  };
}
