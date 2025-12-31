'use client';

/**
 * Soak Report Hook
 *
 * Manages the soak test lifecycle: start, sample, stop, export.
 * Used by the debug harness to generate POC evidence artifacts.
 *
 * Reference: plans/ABACUS_INDEX_SOAK_REPORT_SPEC.md
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AssetId,
  SoakReport,
  SoakSnapshot,
  SoakSummary,
  CompositeHookReturn,
  BasisHookReturn,
  VenueTelemetry,
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

const SAMPLE_INTERVAL_MS = 15_000; // 15 seconds
const AUTO_PERSIST_INTERVAL_MS = 60_000; // 60 seconds
const SNAPSHOT_WARNING_THRESHOLD = 1000;
const LOCAL_STORAGE_KEY = 'abacus:soak:lastReport';

// =============================================================================
// Types
// =============================================================================

export type SoakState = 'idle' | 'running' | 'stopped';

export interface SoakDataSources {
  asset: AssetId;
  spotComposite: CompositeHookReturn;
  perpComposite: CompositeHookReturn;
  basis: BasisHookReturn;
}

export interface UseSoakReportReturn {
  state: SoakState;
  report: SoakReport | null;
  snapshotCount: number;
  elapsedMs: number;
  pageWentBackground: boolean;
  showSnapshotWarning: boolean;

  start: () => void;
  stop: () => void;
  reset: () => void;
  addNote: (note: string) => void;
  downloadJson: () => void;
}

// =============================================================================
// Hook
// =============================================================================

export function useSoakReport(sources: SoakDataSources): UseSoakReportReturn {
  const { asset, spotComposite, perpComposite, basis } = sources;

  // State
  const [state, setState] = useState<SoakState>('idle');
  const [report, setReport] = useState<SoakReport | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [pageWentBackground, setPageWentBackground] = useState(false);

  // Refs (to avoid re-render storms and stale closures)
  const startTimeRef = useRef<number>(0);
  const snapshotsRef = useRef<SoakSnapshot[]>([]);
  const notesRef = useRef<string[]>([]);
  const sampleIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const persistIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const assetAtStartRef = useRef<AssetId>(asset);

  // Ref to store latest snapshot function (fixes stale closure in setInterval)
  const takeSnapshotRef = useRef<(() => SoakSnapshot) | null>(null);

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
  // Take a snapshot
  // -------------------------------------------------------------------------
  const takeSnapshot = useCallback((): SoakSnapshot => {
    const now = Date.now();
    const spotVenues = spotComposite.telemetry.venues;
    const perpVenues = perpComposite.telemetry.venues;

    // Combine venue telemetry
    const allVenues: SoakSnapshot['venues'] = [
      ...spotVenues.map((v) => ({
        venue: v.venue,
        marketType: v.marketType,
        connectionState: v.connectionState,
        lastMessageTime: v.lastMessageTime,
        messageCount: v.messageCount,
        tradeCount: v.tradeCount,
        reconnectCount: v.reconnectCount,
        gapCount: v.gapCount,
        uptimePercent: v.uptimePercent,
        avgMessageRate: v.avgMessageRate,
      })),
      ...perpVenues.map((v) => ({
        venue: v.venue,
        marketType: v.marketType,
        connectionState: v.connectionState,
        lastMessageTime: v.lastMessageTime,
        messageCount: v.messageCount,
        tradeCount: v.tradeCount,
        reconnectCount: v.reconnectCount,
        gapCount: v.gapCount,
        uptimePercent: v.uptimePercent,
        avgMessageRate: v.avgMessageRate,
      })),
    ];

    return {
      tMs: now,
      tIso: new Date(now).toISOString(),
      asset: assetAtStartRef.current,
      spot: {
        compositePrice: spotComposite.price,
        degraded: spotComposite.degraded,
        degradedReason: spotComposite.venues.find((v) => v.excludeReason)?.excludeReason || 'none',
        connectedVenues: spotComposite.telemetry.connectedSpotVenues,
        totalVenues: spotComposite.venues.length,
        outliersTotal: spotComposite.telemetry.totalOutlierExclusions,
        gapsTotal: spotComposite.telemetry.totalGaps,
      },
      perp: {
        compositePrice: perpComposite.price,
        degraded: perpComposite.degraded,
        connectedVenues: perpComposite.telemetry.connectedPerpVenues,
        totalVenues: perpComposite.venues.length,
      },
      basisBps: basis.current?.basisBps ?? null,
      venues: allVenues,
    };
  }, [spotComposite, perpComposite, basis]);

  // Keep takeSnapshotRef updated with latest function (fixes stale closure)
  useEffect(() => {
    takeSnapshotRef.current = takeSnapshot;
  }, [takeSnapshot]);

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

    // Count connected snapshots per venue
    const venueConnectedCounts: Record<string, number> = {};
    const venueReconnectsFirst: Record<string, number> = {};
    const venueReconnectsLast: Record<string, number> = {};
    const venueMaxGaps: Record<string, number> = {};
    let maxOutliers = 0;
    let spotDegradedCount = 0;
    let perpDegradedCount = 0;

    snapshots.forEach((snap, idx) => {
      // Track spot/perp degraded
      if (snap.spot.degraded) spotDegradedCount++;
      if (snap.perp.degraded) perpDegradedCount++;

      // Track max outliers
      if (snap.spot.outliersTotal > maxOutliers) {
        maxOutliers = snap.spot.outliersTotal;
      }

      // Per-venue stats
      snap.venues.forEach((v) => {
        const key = `${v.venue}_${v.marketType}`;

        // Connected count
        if (v.connectionState === 'connected') {
          venueConnectedCounts[key] = (venueConnectedCounts[key] || 0) + 1;
        } else {
          venueConnectedCounts[key] = venueConnectedCounts[key] || 0;
        }

        // Reconnects (first and last snapshot)
        if (idx === 0) {
          venueReconnectsFirst[key] = v.reconnectCount;
        }
        venueReconnectsLast[key] = v.reconnectCount;

        // Max gaps
        if (!venueMaxGaps[key] || v.gapCount > venueMaxGaps[key]) {
          venueMaxGaps[key] = v.gapCount;
        }
      });
    });

    // Compute percentages and deltas
    const connectedPctByVenue: Record<string, number> = {};
    const reconnectsByVenue: Record<string, number> = {};

    Object.keys(venueConnectedCounts).forEach((key) => {
      connectedPctByVenue[key] = (venueConnectedCounts[key] / snapshots.length) * 100;
      reconnectsByVenue[key] = (venueReconnectsLast[key] || 0) - (venueReconnectsFirst[key] || 0);
    });

    const notes = [...notesRef.current];

    // Auto-add note if snapshot warning threshold exceeded
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
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          pageVisibleApprox: typeof document !== 'undefined' ? document.visibilityState === 'visible' : true,
          pageWentBackground,
        },
        config: {
          pocPhase: CURRENT_POC_PHASE,
          venues: {
            spot: [...phaseConfig.spot],
            perp: [...phaseConfig.perp],
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
      console.warn('[SoakReport] Failed to persist to localStorage:', e);
    }
  }, [buildReport]);

  // -------------------------------------------------------------------------
  // Start soak
  // -------------------------------------------------------------------------
  const start = useCallback(() => {
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
    setState('running');

    // Take initial snapshot
    if (takeSnapshotRef.current) {
      snapshotsRef.current.push(takeSnapshotRef.current());
    }

    // Start sampling interval (uses ref to avoid stale closure)
    sampleIntervalRef.current = setInterval(() => {
      if (takeSnapshotRef.current) {
        snapshotsRef.current.push(takeSnapshotRef.current());
      }
    }, SAMPLE_INTERVAL_MS);

    // Start auto-persist interval
    persistIntervalRef.current = setInterval(() => {
      persistToLocalStorage();
    }, AUTO_PERSIST_INTERVAL_MS);

    // Start elapsed timer (updates every second)
    elapsedIntervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 1000);
  }, [state, asset, persistToLocalStorage]);

  // -------------------------------------------------------------------------
  // Stop soak
  // -------------------------------------------------------------------------
  const stop = useCallback(() => {
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
    if (takeSnapshotRef.current) {
      snapshotsRef.current.push(takeSnapshotRef.current());
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
      console.warn('[SoakReport] Failed to persist final report:', e);
    }

    setState('stopped');
  }, [state, buildReport]);

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------
  const reset = useCallback(() => {
    // Clear any running intervals
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

    // Reset all state
    startTimeRef.current = 0;
    snapshotsRef.current = [];
    notesRef.current = [];
    setPageWentBackground(false);
    setElapsedMs(0);
    setReport(null);
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
    const filename = `abacus_soak_report_${reportToDownload.run.asset}_${startIso}_${durationMin}min.json`;

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

    start,
    stop,
    reset,
    addNote,
    downloadJson,
  };
}
