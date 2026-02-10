'use client';

import { useMemo, useState, useCallback } from 'react';
import { ITimeScaleApi, Time } from 'lightweight-charts';
import { HorizonMarkerModel } from '@/types/predictions';
import { BLOCK_COLORS, BLOCK_LABELS } from '@/lib/chart-constants';
import { getVarianceColor, formatPercentCorrect, ACCURACY_COLORS } from '@/lib/utils/formatters';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Max markers to render for performance
const MAX_VISIBLE_MARKERS = 50;

// X-axis offset from bottom (where markers appear)
const X_AXIS_OFFSET = 28;

interface HorizonMarkersProps {
  markers: HorizonMarkerModel[];
  timeScale: ITimeScaleApi<Time>;
  containerWidth: number;
  intervalSeconds: number;
  viewportVersion: number;  // Triggers re-render on change
  markerShape?: 'dot' | 'triangle';
}

// Format time for display
function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// Format price for display
function formatPrice(price: number): string {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Get direction arrow
function getDirectionArrow(direction: 'Up' | 'Down' | 'Neutral'): string {
  switch (direction) {
    case 'Up': return '\u2191';
    case 'Down': return '\u2193';
    default: return '\u2194';
  }
}

// Marker content shared between tooltip, popover, and chart hover
// Exported for use in PriceChart when hovering over chart area
export function MarkerContent({ marker }: { marker: HorizonMarkerModel }) {
  const blockColor = BLOCK_COLORS[marker.blockIndex] || BLOCK_COLORS[0];

  return (
    <div className="text-xs space-y-1.5 min-w-[160px]">
      {/* Header with block label */}
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: blockColor }}
        />
        <span className="font-medium text-[#e6edf3]">{marker.blockLabel}</span>
      </div>

      {/* Time */}
      <div className="text-[#8b949e]">{formatTime(marker.time)}</div>

      {/* Prices */}
      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span className="text-[#8b949e]">Target:</span>
          <span className="text-[#e6edf3] font-mono">${formatPrice(marker.close)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#8b949e]">High:</span>
          <span className="text-[#e6edf3] font-mono">${formatPrice(marker.high)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#8b949e]">Low:</span>
          <span className="text-[#e6edf3] font-mono">${formatPrice(marker.low)}</span>
        </div>
      </div>

      {/* TTS model source badge */}
      {marker.model_source === 'tts' && (
        <div className="flex items-center gap-2 pt-1 border-t border-[#30363d]">
          <span
            className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase"
            style={{ color: '#c084fc', backgroundColor: 'rgba(168,85,247,0.2)' }}
          >
            TTS
          </span>
          {marker.remaining_minutes != null && marker.remaining_minutes > 0 && (
            <span className="text-[10px] text-[#c084fc]">
              {marker.remaining_minutes}m to settle
            </span>
          )}
        </div>
      )}

      {/* Direction and probability */}
      <div className="flex justify-between items-center pt-1 border-t border-[#30363d]">
        <span className="text-[#e6edf3]">
          {getDirectionArrow(marker.direction)} {marker.direction} {marker.signal}
        </span>
        <span className="text-[#e6edf3] font-medium">{Math.round(marker.probability * 100)}%</span>
      </div>

      {/* Settlement data if available */}
      {marker.status === 'settled' && marker.variance_pct !== undefined && (
        <div className="pt-1 border-t border-[#30363d] space-y-0.5">
          <div className="flex justify-between items-center">
            <span className="text-[#8b949e]">Accuracy:</span>
            <span
              className="font-mono font-bold flex items-center gap-1"
              style={{ color: getVarianceColor(marker.variance_pct, marker.in_range) }}
            >
              {marker.in_range && (
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: ACCURACY_COLORS.green }}
                />
              )}
              {formatPercentCorrect(marker.variance_pct)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Single marker component with desktop tooltip / mobile popover
function HorizonMarker({
  marker,
  x,
  markerShape,
}: {
  marker: HorizonMarkerModel;
  x: number;
  markerShape: 'dot' | 'triangle';
}) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const blockColor = BLOCK_COLORS[marker.blockIndex] || BLOCK_COLORS[0];
  const isPending = marker.status === 'pending';
  const isTTS = marker.model_source === 'tts';

  // Marker visual element
  const markerElement = markerShape === 'dot' ? (
    <div
      className={`
        w-[10px] h-[10px] rounded-full cursor-pointer
        transition-transform hover:scale-125
        ${isPending ? 'animate-pulse-subtle' : ''}
      `}
      style={{
        backgroundColor: blockColor,
        boxShadow: isTTS
          ? `0 0 0 2px #c084fc`
          : `0 0 0 1px rgba(255,255,255,0.2)`,
        opacity: isPending ? 1 : 0.75,
      }}
      aria-label={`Horizon at ${formatTime(marker.time)}, target $${formatPrice(marker.close)}`}
    />
  ) : (
    <div
      className={`
        w-0 h-0 cursor-pointer
        transition-transform hover:scale-125
        ${isPending ? 'animate-pulse-subtle' : ''}
      `}
      style={{
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderBottom: `10px solid ${blockColor}`,
        opacity: isPending ? 1 : 0.75,
        filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.2))',
      }}
      aria-label={`Horizon at ${formatTime(marker.time)}, target $${formatPrice(marker.close)}`}
    />
  );

  // Check for touch device using media query match (coarse pointer = touch)
  const isTouchDevice = typeof window !== 'undefined' &&
    window.matchMedia('(pointer: coarse)').matches;

  if (isTouchDevice) {
    // Mobile: use Popover for tap-to-pin
    return (
      <div
        className="absolute transform -translate-x-1/2"
        style={{ left: x, bottom: X_AXIS_OFFSET }}
      >
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <button className="touch-manipulation" type="button">
              {markerElement}
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" sideOffset={8}>
            <MarkerContent marker={marker} />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // Desktop: use Tooltip for hover
  return (
    <div
      className="absolute transform -translate-x-1/2"
      style={{ left: x, bottom: X_AXIS_OFFSET }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-full" type="button">
            {markerElement}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8} className="bg-[#161b22] border border-[#30363d] p-3">
          <MarkerContent marker={marker} />
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function HorizonMarkers({
  markers,
  timeScale,
  containerWidth,
  viewportVersion,
  markerShape = 'dot',
}: HorizonMarkersProps) {
  // Compute visible markers with their x-coordinates
  // Re-computes when viewportVersion changes (triggered by pan/zoom/resize)
  const visibleMarkers = useMemo(() => {
    if (!markers.length || !containerWidth) return [];

    const result: { marker: HorizonMarkerModel; x: number }[] = [];

    for (const marker of markers) {
      // Use snapped time for coordinate calculation
      const x = timeScale.timeToCoordinate(marker.timeSnapped as Time);

      // Skip if coordinate is null (out of range) or outside container bounds
      if (x === null || x < 0 || x > containerWidth) continue;

      result.push({ marker, x });

      // Cap at max visible markers for performance
      if (result.length >= MAX_VISIBLE_MARKERS) break;
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, timeScale, containerWidth, viewportVersion]);

  if (!visibleMarkers.length) return null;

  return (
    <TooltipProvider delayDuration={100}>
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none z-20"
        style={{ height: X_AXIS_OFFSET + 20 }}
      >
        {/* Markers are pointer-events-auto so they're clickable */}
        {visibleMarkers.map(({ marker, x }) => (
          <div key={marker.id} className="pointer-events-auto">
            <HorizonMarker
              marker={marker}
              x={x}
              markerShape={markerShape}
            />
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}

export default HorizonMarkers;
