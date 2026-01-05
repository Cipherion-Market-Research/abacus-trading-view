'use client';

/**
 * Abacus:INDEX Debug Harness
 *
 * Validation UI for monitoring venue connections, composite calculation,
 * and data quality metrics.
 *
 * NOTE: Keep this tab foregrounded during testing or browser throttling
 * will affect reliability measurements.
 *
 * SOAK TESTING: Expand the Soak Controls panel to run extended stability tests.
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
import { useSoakReportApi } from '../hooks/useSoakReportApi';
import {
  VenueTelemetry,
  ConnectionState,
  AssetId,
} from '../types';
import {
  CURRENT_SYSTEM_STATUS,
  OUTLIER_THRESHOLD_BPS,
  CURRENT_QUORUM_POLICY,
  STATUS_COLORS,
  COMPOSITE_COLORS,
  UI_COLORS,
  QUORUM_POLICIES,
} from '../constants';

// =============================================================================
// Component
// =============================================================================

// Get API base URL for display
const API_BASE_URL = process.env.NEXT_PUBLIC_ABACUS_API_BASE_URL || 'https://api.ciphex.io/indexer/v0';

export type SoakMode = 'browser' | 'api';

export function AbacusIndexDebug() {
  // Asset and soak state
  const [asset, setAsset] = useState<AssetId>('BTC');
  const [noteInput, setNoteInput] = useState('');
  const [soakMode, setSoakMode] = useState<SoakMode>('browser');
  const [soakPanelOpen, setSoakPanelOpen] = useState(false);

  // Venue hooks (4 spot + 3 perp)
  const binanceSpot = useBinanceSpot({ asset });
  const coinbaseSpot = useCoinbaseSpot({ asset });
  const okxSpot = useOKXSpot({ asset });
  const krakenSpot = useKrakenSpot({ asset });
  const binancePerp = useBinancePerp({ asset });
  const okxPerp = useOKXPerp({ asset });
  const bybitPerp = useBybitPerp({ asset });

  // Composites (4 spot venues, 3 perp venues)
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

  // Soak report - browser mode (always called for React rules)
  const browserSoak = useSoakReport({
    asset,
    spotComposite,
    perpComposite,
    basis,
  });

  // Soak report - API mode (always called for React rules)
  const apiSoak = useSoakReportApi({ asset });

  // Select active soak based on mode
  const soak = soakMode === 'api' ? apiSoak : browserSoak;

  // Lock asset and mode toggle during soak
  const isAssetLocked = soak.state === 'running';
  const isSoakModeLocked = browserSoak.state === 'running' || apiSoak.state === 'running';

  return (
    <div
      className="p-6 min-h-screen font-mono text-sm"
      style={{ backgroundColor: UI_COLORS.background, color: UI_COLORS.textPrimary }}
    >
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2" style={{ color: UI_COLORS.textPrimary }}>
          Abacus:INDEX Debug Harness
        </h1>
        <div className="flex gap-4 items-center flex-wrap" style={{ color: UI_COLORS.textSecondary }}>
          <span>
            Status:{' '}
            <span style={{ color: UI_COLORS.accent }}>{CURRENT_SYSTEM_STATUS}</span>
          </span>
          <div className="flex items-center gap-2">
            <span>Asset:</span>
            <div
              className={`flex rounded overflow-hidden ${isAssetLocked ? 'opacity-50' : ''}`}
              style={{ backgroundColor: UI_COLORS.cardBackground }}
            >
              <button
                onClick={() => !isAssetLocked && setAsset('BTC')}
                disabled={isAssetLocked}
                className={`px-3 py-1 text-sm transition-colors ${isAssetLocked ? 'cursor-not-allowed' : ''}`}
                style={{
                  backgroundColor: asset === 'BTC' ? UI_COLORS.accent : 'transparent',
                  color: asset === 'BTC' ? UI_COLORS.background : UI_COLORS.textSecondary,
                }}
              >
                BTC
              </button>
              <button
                onClick={() => !isAssetLocked && setAsset('ETH')}
                disabled={isAssetLocked}
                className={`px-3 py-1 text-sm transition-colors ${isAssetLocked ? 'cursor-not-allowed' : ''}`}
                style={{
                  backgroundColor: asset === 'ETH' ? UI_COLORS.accent : 'transparent',
                  color: asset === 'ETH' ? UI_COLORS.background : UI_COLORS.textSecondary,
                }}
              >
                ETH
              </button>
            </div>
            {isAssetLocked && (
              <span className="text-xs" style={{ color: UI_COLORS.neutral }}>(locked during soak)</span>
            )}
          </div>
          <span>
            Quorum: {QUORUM_POLICIES[CURRENT_QUORUM_POLICY].minQuorum}+ venues
          </span>
          <span>Outlier: ±{OUTLIER_THRESHOLD_BPS} bps</span>
        </div>
        <div
          className="mt-2 p-2 rounded text-xs"
          style={{
            backgroundColor: UI_COLORS.neutralSecondary + '30',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: UI_COLORS.neutral,
            color: UI_COLORS.neutral,
          }}
        >
          User Notice: Keep this tab foregrounded. Browser throttling affects reliability metrics.
        </div>
      </div>

      {/* Soak Controls Toggle */}
      <div className="mb-6">
        <button
          onClick={() => setSoakPanelOpen(!soakPanelOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded text-sm transition-opacity hover:opacity-80"
          style={{
            backgroundColor: UI_COLORS.cardBackground,
            color: UI_COLORS.textSecondary,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: UI_COLORS.border,
          }}
        >
          <span
            className="transition-transform"
            style={{ transform: soakPanelOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            ▶
          </span>
          Soak Test Controls
          {soak.state === 'running' && (
            <span
              className="ml-2 px-2 py-0.5 rounded text-xs animate-pulse"
              style={{ backgroundColor: UI_COLORS.positive, color: UI_COLORS.background }}
            >
              RUNNING
            </span>
          )}
        </button>

        {soakPanelOpen && (
          <div className="mt-2">
            <SoakControlsPanel
              soak={soak}
              soakMode={soakMode}
              setSoakMode={setSoakMode}
              isSoakModeLocked={isSoakModeLocked}
              apiError={soakMode === 'api' ? apiSoak.apiError : null}
              noteInput={noteInput}
              setNoteInput={setNoteInput}
            />
          </div>
        )}
      </div>

      {/* Composite Prices - Hero Section */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <CompositeCard
          label="SPOT"
          sublabel="COMPOSITE"
          value={spotComposite.price?.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) ?? '—'}
          degraded={spotComposite.degraded}
          accentColor={COMPOSITE_COLORS.spot}
          glowColor={COMPOSITE_COLORS.spotGlow}
          mutedColor={COMPOSITE_COLORS.spotMuted}
        />
        <CompositeCard
          label="PERP"
          sublabel="COMPOSITE"
          value={perpComposite.price?.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) ?? '—'}
          degraded={perpComposite.degraded}
          accentColor={COMPOSITE_COLORS.perp}
          glowColor={COMPOSITE_COLORS.perpGlow}
          mutedColor={COMPOSITE_COLORS.perpMuted}
        />
        <CompositeCard
          label="BASIS"
          sublabel={basisInterpretation?.description ?? 'SPREAD'}
          value={`${basis.current?.basisBps?.toFixed(2) ?? '—'} bps`}
          degraded={basis.degraded}
          accentColor={COMPOSITE_COLORS.basis}
          glowColor={COMPOSITE_COLORS.basisGlow}
          mutedColor={COMPOSITE_COLORS.basisMuted}
        />
      </div>

      {/* Venue Status Grid */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3" style={{ color: UI_COLORS.textPrimary }}>Spot Venues (4)</h2>
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
        <h2 className="text-lg font-semibold mb-3" style={{ color: UI_COLORS.textPrimary }}>Perp Venues</h2>
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
        <h2 className="text-lg font-semibold mb-3" style={{ color: UI_COLORS.textPrimary }}>Telemetry Summary</h2>
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
      <div className="text-xs" style={{ color: UI_COLORS.textSecondary }}>
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

/**
 * Hero card for composite prices - designed for maximum visibility
 */
function CompositeCard({
  label,
  sublabel,
  value,
  degraded,
  accentColor,
  glowColor,
  mutedColor,
}: {
  label: string;
  sublabel: string;
  value: string;
  degraded: boolean;
  accentColor: string;
  glowColor: string;
  mutedColor: string;
}) {
  return (
    <div
      className="relative p-5 rounded-xl overflow-hidden"
      style={{
        backgroundColor: UI_COLORS.cardBackground,
        borderLeft: `4px solid ${accentColor}`,
        boxShadow: `0 0 20px ${glowColor}20, inset 0 1px 0 ${accentColor}15`,
      }}
    >
      {/* Subtle gradient overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          background: `linear-gradient(135deg, ${mutedColor} 0%, transparent 50%)`,
        }}
      />

      {/* Content */}
      <div className="relative">
        {/* Label */}
        <div className="flex items-baseline gap-2 mb-2">
          <span
            className="text-sm font-bold tracking-wider"
            style={{ color: accentColor }}
          >
            {label}
          </span>
          <span
            className="text-xs font-medium tracking-wide"
            style={{ color: UI_COLORS.textSecondary }}
          >
            {sublabel}
          </span>
        </div>

        {/* Value - Large and prominent */}
        <div
          className="text-4xl font-bold tracking-tight"
          style={{ color: UI_COLORS.textPrimary }}
        >
          {value}
        </div>

        {/* Degraded indicator */}
        {degraded && (
          <div
            className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
            style={{
              backgroundColor: UI_COLORS.neutralSecondary + '40',
              color: UI_COLORS.neutral,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: UI_COLORS.neutral }} />
            DEGRADED
          </div>
        )}
      </div>
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
    <div className="p-4 rounded-lg" style={{ backgroundColor: UI_COLORS.cardBackground }}>
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold" style={{ color: UI_COLORS.textPrimary }}>{name}</span>
        <span
          className="px-2 py-0.5 rounded text-xs font-medium"
          style={{ backgroundColor: statusColor, color: UI_COLORS.background }}
        >
          {telemetry.connectionState}
        </span>
      </div>

      <div className="text-xl font-bold mb-2" style={{ color: UI_COLORS.textPrimary }}>
        {price?.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) ?? '—'}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: UI_COLORS.textSecondary }}>
        <div>Messages: {telemetry.messageCount}</div>
        <div>Trades: {telemetry.tradeCount}</div>
        <div>Reconnects: {telemetry.reconnectCount}</div>
        <div>Gaps: {telemetry.gapCount}</div>
        <div>Rate: {telemetry.avgMessageRate.toFixed(1)}/s</div>
        <div>Uptime: {telemetry.uptimePercent.toFixed(1)}%</div>
      </div>

      {error && (
        <div className="mt-2 text-xs" style={{ color: UI_COLORS.negative }}>{error}</div>
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
    <div className="p-4 rounded-lg" style={{ backgroundColor: UI_COLORS.cardBackground }}>
      <div className="flex justify-between items-center mb-3">
        <span className="font-semibold" style={{ color: UI_COLORS.textPrimary }}>{label}</span>
        <span
          className="px-2 py-0.5 rounded text-xs font-medium"
          style={{ backgroundColor: STATUS_COLORS[health], color: UI_COLORS.background }}
        >
          {health}
        </span>
      </div>

      <div className="space-y-2">
        {venues.map((v) => (
          <div
            key={v.venue}
            className="flex justify-between items-center text-sm"
            style={{ color: v.included ? UI_COLORS.textPrimary : UI_COLORS.textMuted }}
          >
            <span>{v.venue}</span>
            <span className="flex items-center gap-2">
              {v.price?.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }) ?? '—'}
              {v.deviationBps !== undefined && (
                <span className="text-xs" style={{ color: UI_COLORS.textSecondary }}>
                  ({v.deviationBps.toFixed(1)} bps)
                </span>
              )}
              {!v.included && v.excludeReason && (
                <span className="text-xs" style={{ color: UI_COLORS.negative }}>
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
    <div className="p-3 rounded-lg text-center" style={{ backgroundColor: UI_COLORS.cardBackground }}>
      <div className="text-xs mb-1" style={{ color: UI_COLORS.textSecondary }}>{label}</div>
      <div className="text-lg font-bold" style={{ color: UI_COLORS.textPrimary }}>{value}</div>
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
  soak: ReturnType<typeof useSoakReport> | ReturnType<typeof useSoakReportApi>;
  soakMode: SoakMode;
  setSoakMode: (mode: SoakMode) => void;
  isSoakModeLocked: boolean;
  apiError: string | null;
  noteInput: string;
  setNoteInput: (value: string) => void;
}

function SoakControlsPanel({
  soak,
  soakMode,
  setSoakMode,
  isSoakModeLocked,
  apiError,
  noteInput,
  setNoteInput
}: SoakControlsPanelProps) {
  const handleAddNote = () => {
    if (noteInput.trim()) {
      soak.addNote(noteInput.trim());
      setNoteInput('');
    }
  };

  return (
    <div
      className="mb-6 p-4 rounded-lg"
      style={{
        backgroundColor: UI_COLORS.cardBackground,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: UI_COLORS.border,
      }}
    >
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold" style={{ color: UI_COLORS.textPrimary }}>Soak Test Controls</h2>

          {/* Soak Mode Toggle */}
          <div
            className={`flex rounded overflow-hidden ${isSoakModeLocked ? 'opacity-50' : ''}`}
            style={{ backgroundColor: UI_COLORS.background }}
          >
            <button
              onClick={() => !isSoakModeLocked && setSoakMode('browser')}
              disabled={isSoakModeLocked}
              className={`px-3 py-1 text-xs transition-colors ${isSoakModeLocked ? 'cursor-not-allowed' : ''}`}
              style={{
                backgroundColor: soakMode === 'browser' ? UI_COLORS.accent : 'transparent',
                color: soakMode === 'browser' ? UI_COLORS.background : UI_COLORS.textSecondary,
              }}
            >
              Browser WS
            </button>
            <button
              onClick={() => !isSoakModeLocked && setSoakMode('api')}
              disabled={isSoakModeLocked}
              className={`px-3 py-1 text-xs transition-colors ${isSoakModeLocked ? 'cursor-not-allowed' : ''}`}
              style={{
                backgroundColor: soakMode === 'api' ? UI_COLORS.accentSecondary : 'transparent',
                color: soakMode === 'api' ? UI_COLORS.background : UI_COLORS.textSecondary,
              }}
            >
              ECS API
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <span
            className={`px-2 py-1 rounded text-xs font-bold ${soak.state === 'running' ? 'animate-pulse' : ''}`}
            style={{
              backgroundColor:
                soak.state === 'idle'
                  ? UI_COLORS.textMuted
                  : soak.state === 'running'
                  ? UI_COLORS.positive
                  : UI_COLORS.accent,
              color: UI_COLORS.background,
            }}
          >
            {soak.state.toUpperCase()}
          </span>

          {/* Elapsed time */}
          {(soak.state === 'running' || soak.state === 'stopped') && (
            <span className="text-sm" style={{ color: UI_COLORS.textSecondary }}>
              {formatElapsed(soak.elapsedMs)}
            </span>
          )}
        </div>
      </div>

      {/* API Mode Info */}
      {soakMode === 'api' && (
        <div
          className="mb-3 p-2 rounded text-xs"
          style={{
            backgroundColor: UI_COLORS.accentMuted + '30',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: UI_COLORS.accentSecondary,
            color: UI_COLORS.accent,
          }}
        >
          <strong>API Mode:</strong> Polling {API_BASE_URL}
          <br />
          <span style={{ color: UI_COLORS.accentSecondary }}>Type A criteria: is_gap=false, included_venues≥2 (ignores degraded flag)</span>
        </div>
      )}

      {/* API Error */}
      {apiError && soakMode === 'api' && (
        <div
          className="mb-3 p-2 rounded text-xs"
          style={{
            backgroundColor: UI_COLORS.negativeMuted + '30',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: UI_COLORS.negative,
            color: UI_COLORS.negative,
          }}
        >
          <strong>API Error:</strong> {apiError}
        </div>
      )}

      {/* Warnings */}
      {soak.pageWentBackground && (
        <div
          className="mb-3 p-2 rounded text-xs"
          style={{
            backgroundColor: UI_COLORS.neutralSecondary + '30',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: UI_COLORS.neutral,
            color: UI_COLORS.neutral,
          }}
        >
          ⚠️ Page went to background during soak — results may be compromised by browser throttling.
        </div>
      )}
      {soak.showSnapshotWarning && (
        <div
          className="mb-3 p-2 rounded text-xs"
          style={{
            backgroundColor: UI_COLORS.neutralSecondary + '40',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: UI_COLORS.neutral,
            color: UI_COLORS.neutral,
          }}
        >
          ⚠️ Snapshot count exceeded 1000 — consider stopping the soak to avoid memory issues.
        </div>
      )}

      {/* Stats row */}
      <div className="flex gap-6 mb-4 text-sm">
        <div>
          <span style={{ color: UI_COLORS.textSecondary }}>Snapshots: </span>
          <span className="font-bold" style={{ color: UI_COLORS.textPrimary }}>{soak.snapshotCount}</span>
        </div>
        {soak.report && (
          <>
            <div>
              <span style={{ color: UI_COLORS.textSecondary }}>Spot Connected: </span>
              <span className="font-bold" style={{ color: UI_COLORS.textPrimary }}>
                {soak.report.summary.degradedPctSpot !== undefined
                  ? `${(100 - soak.report.summary.degradedPctSpot).toFixed(1)}%`
                  : '—'}
              </span>
            </div>
            <div>
              <span style={{ color: UI_COLORS.textSecondary }}>Perp Connected: </span>
              <span className="font-bold" style={{ color: UI_COLORS.textPrimary }}>
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
            className="px-4 py-2 rounded font-semibold transition-opacity hover:opacity-80"
            style={{ backgroundColor: UI_COLORS.positive, color: UI_COLORS.background }}
          >
            Start Soak
          </button>
        )}
        {soak.state === 'running' && (
          <button
            onClick={soak.stop}
            className="px-4 py-2 rounded font-semibold transition-opacity hover:opacity-80"
            style={{ backgroundColor: UI_COLORS.negative, color: UI_COLORS.textPrimary }}
          >
            Stop Soak
          </button>
        )}
        {soak.state === 'stopped' && (
          <>
            <button
              onClick={soak.downloadJson}
              className="px-4 py-2 rounded font-semibold transition-opacity hover:opacity-80"
              style={{ backgroundColor: UI_COLORS.accent, color: UI_COLORS.background }}
            >
              Download JSON
            </button>
            <button
              onClick={soak.reset}
              className="px-4 py-2 rounded font-semibold transition-opacity hover:opacity-80"
              style={{ backgroundColor: UI_COLORS.textMuted, color: UI_COLORS.textPrimary }}
            >
              Reset
            </button>
          </>
        )}
        {soak.state === 'running' && (
          <button
            onClick={soak.downloadJson}
            className="px-4 py-2 rounded font-semibold transition-opacity hover:opacity-80"
            style={{ backgroundColor: UI_COLORS.textMuted, color: UI_COLORS.textPrimary }}
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
            className="flex-1 px-3 py-2 rounded text-sm"
            style={{
              backgroundColor: UI_COLORS.background,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: UI_COLORS.border,
              color: UI_COLORS.textPrimary,
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddNote();
            }}
          />
          <button
            onClick={handleAddNote}
            disabled={!noteInput.trim()}
            className="px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-opacity hover:opacity-80"
            style={{ backgroundColor: UI_COLORS.textMuted, color: UI_COLORS.textPrimary }}
          >
            Add Note
          </button>
        </div>
      )}

      {/* Summary display (after stopped) */}
      {soak.state === 'stopped' && soak.report && (
        <div className="mt-4 p-3 rounded text-xs" style={{ backgroundColor: UI_COLORS.background }}>
          <div className="font-semibold mb-2" style={{ color: UI_COLORS.textPrimary }}>Summary</div>
          <div className="grid grid-cols-2 gap-2" style={{ color: UI_COLORS.textSecondary }}>
            <div>Duration: {formatElapsed(soak.report.run.durationMs)}</div>
            <div>Asset: {soak.report.run.asset}</div>
            <div>Spot Degraded: {soak.report.summary.degradedPctSpot.toFixed(1)}%</div>
            <div>Perp Degraded: {soak.report.summary.degradedPctPerp.toFixed(1)}%</div>
            <div>Max Outliers: {soak.report.summary.outliersTotal}</div>
            <div>Background: {soak.report.run.pageWentBackground ? 'Yes ⚠️' : 'No ✓'}</div>
          </div>
          {soak.report.summary.notes.length > 0 && (
            <div className="mt-2">
              <div className="font-semibold mb-1" style={{ color: UI_COLORS.textPrimary }}>Notes:</div>
              <ul className="list-disc list-inside" style={{ color: UI_COLORS.textSecondary }}>
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
