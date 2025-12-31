'use client';

/**
 * Data Source Toggle
 *
 * Allows switching between Binance (default) and Abacus:INDEX as the
 * candle data source for the chart.
 */

import { cn } from '@/lib/utils';

export type DataSource = 'binance' | 'abacus';

interface DataSourceToggleProps {
  value: DataSource;
  onChange: (source: DataSource) => void;
  abacusStatus?: {
    degraded: boolean;
    degradedReason?: string;
    connectedVenues: number;
    totalVenues: number;
  };
  className?: string;
}

export function DataSourceToggle({
  value,
  onChange,
  abacusStatus,
  className,
}: DataSourceToggleProps) {
  return (
    <div className={cn('flex items-center gap-1 bg-[#21262d] rounded-md p-0.5', className)}>
      <button
        onClick={() => onChange('binance')}
        className={cn(
          'px-2.5 py-1 rounded text-xs font-medium transition-colors',
          value === 'binance'
            ? 'bg-[#30363d] text-[#f0f6fc]'
            : 'text-[#8b949e] hover:text-[#c9d1d9]'
        )}
      >
        Binance
      </button>
      <button
        onClick={() => onChange('abacus')}
        className={cn(
          'px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5',
          value === 'abacus'
            ? 'bg-[#30363d] text-[#f0f6fc]'
            : 'text-[#8b949e] hover:text-[#c9d1d9]'
        )}
      >
        <span>Abacus:INDEX</span>
        {value === 'abacus' && abacusStatus && (
          <StatusIndicator
            degraded={abacusStatus.degraded}
            degradedReason={abacusStatus.degradedReason}
            connectedVenues={abacusStatus.connectedVenues}
            totalVenues={abacusStatus.totalVenues}
          />
        )}
      </button>
    </div>
  );
}

function StatusIndicator({
  degraded,
  degradedReason,
  connectedVenues,
  totalVenues,
}: {
  degraded: boolean;
  degradedReason?: string;
  connectedVenues: number;
  totalVenues: number;
}) {
  if (connectedVenues === 0) {
    return (
      <span
        className="w-2 h-2 rounded-full bg-[#f85149]"
        title="No venues connected"
      />
    );
  }

  if (degraded) {
    return (
      <span
        className="w-2 h-2 rounded-full bg-[#d29922]"
        title={degradedReason || `${connectedVenues}/${totalVenues} venues`}
      />
    );
  }

  return (
    <span
      className="w-2 h-2 rounded-full bg-[#3fb950]"
      title={`${connectedVenues}/${totalVenues} venues connected`}
    />
  );
}

/**
 * Abacus Status Badge (optional, for more detailed display)
 */
export function AbacusStatusBadge({
  degraded,
  degradedReason,
  connectedVenues,
  totalVenues,
  className,
}: {
  degraded: boolean;
  degradedReason?: string;
  connectedVenues: number;
  totalVenues: number;
  className?: string;
}) {
  if (connectedVenues === 0) {
    return (
      <span
        className={cn(
          'px-1.5 py-0.5 rounded text-[10px] font-medium bg-[rgba(248,81,73,0.15)] text-[#f85149]',
          className
        )}
      >
        Offline
      </span>
    );
  }

  if (degraded) {
    return (
      <span
        className={cn(
          'px-1.5 py-0.5 rounded text-[10px] font-medium bg-[rgba(210,153,34,0.15)] text-[#d29922]',
          className
        )}
        title={degradedReason}
      >
        {degradedReason || `${connectedVenues}/${totalVenues}`}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'px-1.5 py-0.5 rounded text-[10px] font-medium bg-[rgba(63,185,80,0.15)] text-[#3fb950]',
        className
      )}
    >
      {connectedVenues}/{totalVenues}
    </span>
  );
}
