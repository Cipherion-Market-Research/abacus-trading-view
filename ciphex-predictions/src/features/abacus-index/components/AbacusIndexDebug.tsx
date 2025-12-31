'use client';

/**
 * Abacus:INDEX Debug Harness
 *
 * POC-2 validation UI for monitoring venue connections, composite calculation,
 * and data quality metrics.
 *
 * WARNING: This is a POC harness. Keep this tab foregrounded during testing
 * or browser throttling will affect reliability measurements.
 *
 * SOAK TESTING: Use the Soak Controls panel to run extended stability tests.
 * The soak will sample every 15s and export a JSON report for ECS handoff.
 */

import React, { useState } from 'react';
import {
  useBinanceSpot,
  useBinancePerp,
  useCoinbaseSpot,
  useOKXSpot,
  useOKXPerp,
  useBybitPerp,
  useKrakenSpot,
} from '../hooks/venues';
import { useSpotComposite } from '../hooks/composites/useSpotComposite';
import { usePerpComposite } from '../hooks/composites/usePerpComposite';
import { useBasisFeatures, interpretBasis } from '../hooks/features/useBasisFeatures';
import { useSoakReport } from '../hooks/useSoakReport';
import {
  VenueTelemetry,
  ConnectionState,
  AssetId,
} from '../types';
import {
  CURRENT_POC_PHASE,
  OUTLIER_THRESHOLD_BPS,
  CURRENT_QUORUM_POLICY,
  STATUS_COLORS,
  COMPOSITE_COLORS,
} from '../constants';

// =============================================================================
// Component
// =============================================================================

export function AbacusIndexDebug() {
  // POC-2: Support BTC and ETH
  const [asset, setAsset] = useState<AssetId>('BTC');
  const [noteInput, setNoteInput] = useState('');

  // POC-2 venue hooks (4 spot + 3 perp)
  const binanceSpot = useBinanceSpot({ asset });
  const coinbaseSpot = useCoinbaseSpot({ asset });
  const okxSpot = useOKXSpot({ asset });
  const krakenSpot = useKrakenSpot({ asset });
  const binancePerp = useBinancePerp({ asset });
  const okxPerp = useOKXPerp({ asset });
  const bybitPerp = useBybitPerp({ asset });

  // Composites (POC-2: 4 spot venues, 3 perp venues)
  const spotComposite = useSpotComposite({
    venues: { binance: binanceSpot, coinbase: coinbaseSpot, okx: okxSpot, kraken: krakenSpot },
    asset,
  });

  const perpComposite = usePerpComposite({
    venues: { binance: binancePerp, okx: okxPerp, bybit: bybitPerp },
    asset,
  });

  // Basis features
  const basis = useBasisFeatures({
    spot: spotComposite,
    perp: perpComposite,
  });

  const basisInterpretation = basis.current?.basisBps
    ? interpretBasis(basis.current.basisBps)
    : null;

  // Soak report
  const soak = useSoakReport({
    asset,
    spotComposite,
    perpComposite,
    basis,
  });

  // Lock asset toggle during soak
  const isAssetLocked = soak.state === 'running';

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen font-mono text-sm">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Abacus:INDEX Debug Harness</h1>
        <div className="flex gap-4 items-center text-gray-400">
          <span>Phase: {CURRENT_POC_PHASE}</span>
          <div className="flex items-center gap-2">
            <span>Asset:</span>
            <div className={`flex bg-gray-800 rounded overflow-hidden ${isAssetLocked ? 'opacity-50' : ''}`}>
              <button
                onClick={() => !isAssetLocked && setAsset('BTC')}
                disabled={isAssetLocked}
                className={`px-3 py-1 text-sm ${
                  asset === 'BTC' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'
                } ${isAssetLocked ? 'cursor-not-allowed' : ''}`}
              >
                BTC
              </button>
              <button
                onClick={() => !isAssetLocked && setAsset('ETH')}
                disabled={isAssetLocked}
                className={`px-3 py-1 text-sm ${
                  asset === 'ETH' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'
                } ${isAssetLocked ? 'cursor-not-allowed' : ''}`}
              >
                ETH
              </button>
            </div>
            {isAssetLocked && (
              <span className="text-xs text-yellow-500">(locked during soak)</span>
            )}
          </div>
          <span>Quorum Policy: {CURRENT_QUORUM_POLICY}</span>
          <span>Outlier Threshold: {OUTLIER_THRESHOLD_BPS} bps</span>
        </div>
        <div className="mt-2 p-2 bg-yellow-900/30 border border-yellow-600 rounded text-yellow-400 text-xs">
          POC Limitation: Keep this tab foregrounded. Browser throttling affects reliability metrics.
        </div>
      </div>

      {/* Soak Controls */}
      <SoakControlsPanel
        soak={soak}
        noteInput={noteInput}
        setNoteInput={setNoteInput}
      />

      {/* Composite Prices */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <PriceCard
          label="SPOT COMPOSITE"
          price={spotComposite.price}
          degraded={spotComposite.degraded}
          color={COMPOSITE_COLORS.spot}
        />
        <PriceCard
          label="PERP COMPOSITE"
          price={perpComposite.price}
          degraded={perpComposite.degraded}
          color={COMPOSITE_COLORS.perp}
        />
        <div className="p-4 bg-gray-800 rounded-lg">
          <div className="text-xs text-gray-400 mb-1">BASIS</div>
          <div
            className="text-2xl font-bold"
            style={{ color: COMPOSITE_COLORS.basis }}
          >
            {basis.current?.basisBps?.toFixed(2) ?? '—'} bps
          </div>
          {basisInterpretation && (
            <div className="text-xs text-gray-400 mt-1">
              {basisInterpretation.description}
            </div>
          )}
          {basis.degraded && (
            <div className="text-xs text-yellow-500 mt-1">DEGRADED</div>
          )}
        </div>
      </div>

      {/* Venue Status Grid */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Spot Venues (4)</h2>
        <div className="grid grid-cols-4 gap-4 mb-4">
          <VenueCard
            name="Binance Spot"
            telemetry={binanceSpot.telemetry}
            price={binanceSpot.currentPrice}
            error={binanceSpot.error}
          />
          <VenueCard
            name="Coinbase Spot"
            telemetry={coinbaseSpot.telemetry}
            price={coinbaseSpot.currentPrice}
            error={coinbaseSpot.error}
          />
          <VenueCard
            name="OKX Spot"
            telemetry={okxSpot.telemetry}
            price={okxSpot.currentPrice}
            error={okxSpot.error}
          />
          <VenueCard
            name="Kraken Spot"
            telemetry={krakenSpot.telemetry}
            price={krakenSpot.currentPrice}
            error={krakenSpot.error}
          />
        </div>
        <h2 className="text-lg font-semibold mb-3">Perp Venues</h2>
        <div className="grid grid-cols-3 gap-4">
          <VenueCard
            name="Binance Perp"
            telemetry={binancePerp.telemetry}
            price={binancePerp.currentPrice}
            error={binancePerp.error}
          />
          <VenueCard
            name="OKX Perp"
            telemetry={okxPerp.telemetry}
            price={okxPerp.currentPrice}
            error={okxPerp.error}
          />
          <VenueCard
            name="Bybit Perp"
            telemetry={bybitPerp.telemetry}
            price={bybitPerp.currentPrice}
            error={bybitPerp.error}
          />
        </div>
      </div>

      {/* Composite Breakdown */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <CompositeBreakdown
          label="Spot Composite"
          venues={spotComposite.venues}
          health={spotComposite.telemetry.systemHealth}
        />
        <CompositeBreakdown
          label="Perp Composite"
          venues={perpComposite.venues}
          health={perpComposite.telemetry.systemHealth}
        />
      </div>

      {/* Telemetry Summary */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Telemetry Summary</h2>
        <div className="grid grid-cols-4 gap-4">
          <MetricCard
            label="Connected Spot"
            value={`${spotComposite.telemetry.connectedSpotVenues}/${spotComposite.venues.length}`}
          />
          <MetricCard
            label="Connected Perp"
            value={`${perpComposite.telemetry.connectedPerpVenues}/${perpComposite.venues.length}`}
          />
          <MetricCard
            label="Total Gaps"
            value={String(
              spotComposite.telemetry.totalGaps + perpComposite.telemetry.totalGaps
            )}
          />
          <MetricCard
            label="Outlier Exclusions"
            value={String(
              spotComposite.telemetry.totalOutlierExclusions +
                perpComposite.telemetry.totalOutlierExclusions
            )}
          />
        </div>
      </div>

      {/* Bar Counts */}
      <div className="text-gray-400 text-xs">
        <span className="mr-4">
          Spot Bars: {spotComposite.bars.length}
        </span>
        <span className="mr-4">
          Perp Bars: {perpComposite.bars.length}
        </span>
        <span>
          Basis History: {basis.history.length}
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function PriceCard({
  label,
  price,
  degraded,
  color,
}: {
  label: string;
  price: number | null;
  degraded: boolean;
  color: string;
}) {
  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>
        {price?.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) ?? '—'}
      </div>
      {degraded && (
        <div className="text-xs text-yellow-500 mt-1">DEGRADED</div>
      )}
    </div>
  );
}

function VenueCard({
  name,
  telemetry,
  price,
  error,
}: {
  name: string;
  telemetry: VenueTelemetry;
  price: number | null;
  error: string | null;
}) {
  const statusColor = getStatusColor(telemetry.connectionState);

  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold">{name}</span>
        <span
          className="px-2 py-0.5 rounded text-xs"
          style={{ backgroundColor: statusColor, color: '#000' }}
        >
          {telemetry.connectionState}
        </span>
      </div>

      <div className="text-xl font-bold mb-2">
        {price?.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) ?? '—'}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
        <div>Messages: {telemetry.messageCount}</div>
        <div>Trades: {telemetry.tradeCount}</div>
        <div>Reconnects: {telemetry.reconnectCount}</div>
        <div>Gaps: {telemetry.gapCount}</div>
        <div>Rate: {telemetry.avgMessageRate.toFixed(1)}/s</div>
        <div>Uptime: {telemetry.uptimePercent.toFixed(1)}%</div>
      </div>

      {error && (
        <div className="mt-2 text-xs text-red-400">{error}</div>
      )}
    </div>
  );
}

function CompositeBreakdown({
  label,
  venues,
  health,
}: {
  label: string;
  venues: Array<{
    venue: string;
    price: number | null;
    included: boolean;
    excludeReason?: string;
    deviationBps?: number;
  }>;
  health: 'healthy' | 'degraded' | 'unhealthy';
}) {
  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <div className="flex justify-between items-center mb-3">
        <span className="font-semibold">{label}</span>
        <span
          className="px-2 py-0.5 rounded text-xs"
          style={{ backgroundColor: STATUS_COLORS[health], color: '#000' }}
        >
          {health}
        </span>
      </div>

      <div className="space-y-2">
        {venues.map((v) => (
          <div
            key={v.venue}
            className={`flex justify-between items-center text-sm ${
              v.included ? 'text-white' : 'text-gray-500'
            }`}
          >
            <span>{v.venue}</span>
            <span className="flex items-center gap-2">
              {v.price?.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }) ?? '—'}
              {v.deviationBps !== undefined && (
                <span className="text-xs text-gray-400">
                  ({v.deviationBps.toFixed(1)} bps)
                </span>
              )}
              {!v.included && v.excludeReason && (
                <span className="text-xs text-red-400">
                  [{v.excludeReason}]
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-gray-800 rounded-lg text-center">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function getStatusColor(state: ConnectionState): string {
  switch (state) {
    case 'connected':
      return STATUS_COLORS.healthy;
    case 'connecting':
      return STATUS_COLORS.degraded;
    case 'disconnected':
    case 'error':
      return STATUS_COLORS.unhealthy;
  }
}

// =============================================================================
// Soak Controls Panel
// =============================================================================

interface SoakControlsPanelProps {
  soak: ReturnType<typeof useSoakReport>;
  noteInput: string;
  setNoteInput: (value: string) => void;
}

function SoakControlsPanel({ soak, noteInput, setNoteInput }: SoakControlsPanelProps) {
  const handleAddNote = () => {
    if (noteInput.trim()) {
      soak.addNote(noteInput.trim());
      setNoteInput('');
    }
  };

  return (
    <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">Soak Test Controls</h2>
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <span
            className={`px-2 py-1 rounded text-xs font-bold ${
              soak.state === 'idle'
                ? 'bg-gray-600 text-gray-300'
                : soak.state === 'running'
                ? 'bg-green-600 text-white animate-pulse'
                : 'bg-blue-600 text-white'
            }`}
          >
            {soak.state.toUpperCase()}
          </span>

          {/* Elapsed time */}
          {(soak.state === 'running' || soak.state === 'stopped') && (
            <span className="text-gray-400 text-sm">
              {formatElapsed(soak.elapsedMs)}
            </span>
          )}
        </div>
      </div>

      {/* Warnings */}
      {soak.pageWentBackground && (
        <div className="mb-3 p-2 bg-yellow-900/30 border border-yellow-600 rounded text-yellow-400 text-xs">
          ⚠️ Page went to background during soak — results may be compromised by browser throttling.
        </div>
      )}
      {soak.showSnapshotWarning && (
        <div className="mb-3 p-2 bg-orange-900/30 border border-orange-600 rounded text-orange-400 text-xs">
          ⚠️ Snapshot count exceeded 1000 — consider stopping the soak to avoid memory issues.
        </div>
      )}

      {/* Stats row */}
      <div className="flex gap-6 mb-4 text-sm">
        <div>
          <span className="text-gray-400">Snapshots: </span>
          <span className="font-bold">{soak.snapshotCount}</span>
        </div>
        {soak.report && (
          <>
            <div>
              <span className="text-gray-400">Spot Connected: </span>
              <span className="font-bold">
                {soak.report.summary.degradedPctSpot !== undefined
                  ? `${(100 - soak.report.summary.degradedPctSpot).toFixed(1)}%`
                  : '—'}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Perp Connected: </span>
              <span className="font-bold">
                {soak.report.summary.degradedPctPerp !== undefined
                  ? `${(100 - soak.report.summary.degradedPctPerp).toFixed(1)}%`
                  : '—'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Control buttons */}
      <div className="flex gap-2 mb-4">
        {soak.state === 'idle' && (
          <button
            onClick={soak.start}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold"
          >
            Start Soak
          </button>
        )}
        {soak.state === 'running' && (
          <button
            onClick={soak.stop}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold"
          >
            Stop Soak
          </button>
        )}
        {soak.state === 'stopped' && (
          <>
            <button
              onClick={soak.downloadJson}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
            >
              Download JSON
            </button>
            <button
              onClick={soak.reset}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-semibold"
            >
              Reset
            </button>
          </>
        )}
        {soak.state === 'running' && (
          <button
            onClick={soak.downloadJson}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-semibold"
          >
            Download (in progress)
          </button>
        )}
      </div>

      {/* Add note input (only during running) */}
      {soak.state === 'running' && (
        <div className="flex gap-2">
          <input
            type="text"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            placeholder="Add a note..."
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm placeholder-gray-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddNote();
            }}
          />
          <button
            onClick={handleAddNote}
            disabled={!noteInput.trim()}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Note
          </button>
        </div>
      )}

      {/* Summary display (after stopped) */}
      {soak.state === 'stopped' && soak.report && (
        <div className="mt-4 p-3 bg-gray-900 rounded text-xs">
          <div className="font-semibold mb-2">Summary</div>
          <div className="grid grid-cols-2 gap-2 text-gray-400">
            <div>Duration: {formatElapsed(soak.report.run.durationMs)}</div>
            <div>Asset: {soak.report.run.asset}</div>
            <div>Spot Degraded: {soak.report.summary.degradedPctSpot.toFixed(1)}%</div>
            <div>Perp Degraded: {soak.report.summary.degradedPctPerp.toFixed(1)}%</div>
            <div>Max Outliers: {soak.report.summary.outliersTotal}</div>
            <div>Background: {soak.report.run.pageWentBackground ? 'Yes ⚠️' : 'No ✓'}</div>
          </div>
          {soak.report.summary.notes.length > 0 && (
            <div className="mt-2">
              <div className="font-semibold mb-1">Notes:</div>
              <ul className="list-disc list-inside text-gray-400">
                {soak.report.summary.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Format milliseconds as HH:MM:SS
 */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

export default AbacusIndexDebug;
