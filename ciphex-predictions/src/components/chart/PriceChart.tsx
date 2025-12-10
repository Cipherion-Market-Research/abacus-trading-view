'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  AreaData,
  HistogramData,
  CrosshairMode,
  LineStyle,
  ColorType,
  Time,
} from 'lightweight-charts';
import { Candle, Horizon, Block } from '@/types';

// Professional color palette inspired by TradingView and Kraken
// Uses a cohesive gradient across blocks: Blue → Purple → Teal
const COLORS = {
  high: '#2962FF',   // TradingView blue
  mid: '#7434f3',    // Kraken purple
  low: '#2962FF',
  background: '#0d1117', // Chart background color for masking
  candleUp: '#0ECB81',   // TradingView green (vibrant)
  candleDown: '#F6465D', // TradingView red (vibrant)
  // Block colors - muted fills for the prediction band (TradingView/Kraken style)
  block1Fill: 'rgba(41, 98, 255, 0.15)',   // TradingView Blue - Outlook
  block2Fill: 'rgba(116, 52, 243, 0.15)',  // Kraken Purple - Continuation
  block3Fill: 'rgba(0, 188, 212, 0.15)',   // Teal/Cyan - Persistence
  // Block marker/line colors (solid)
  block1: '#2962FF', // TradingView Blue - Outlook
  block2: '#7434f3', // Kraken Purple - Continuation
  block3: '#00BCD4', // Teal/Cyan - Persistence
};

interface PriceChartProps {
  candles: Candle[];
  predictions: Horizon[];
  blocks?: Block[];
  className?: string;
  assetType?: 'crypto' | 'dex' | 'stock';
  interval?: '1m' | '15m' | '1h' | '4h';
}

// Check if a timestamp falls within Regular Trading Hours (9:30 AM - 4:00 PM ET)
// RTH in UTC: 14:30 - 21:00 (accounting for EST/EDT would need more logic)
function isWithinRTH(timestamp: number): boolean {
  const date = new Date(timestamp * 1000);
  const utcHours = date.getUTCHours();
  const utcMinutes = date.getUTCMinutes();
  const timeInMinutes = utcHours * 60 + utcMinutes;

  // RTH: 14:30 UTC (870 min) to 21:00 UTC (1260 min)
  // During EST (Nov-Mar): RTH is 14:30-21:00 UTC
  // During EDT (Mar-Nov): RTH is 13:30-20:00 UTC
  // For simplicity, we'll use a broader window that covers both: 13:30-21:00 UTC
  const rthStart = 13 * 60 + 30;  // 13:30 UTC (9:30 AM EDT / 8:30 AM EST)
  const rthEnd = 21 * 60;          // 21:00 UTC (4:00 PM EST / 5:00 PM EDT)

  return timeInMinutes >= rthStart && timeInMinutes <= rthEnd;
}

// Map interval strings to seconds
const INTERVAL_TO_SECONDS: Record<string, number> = {
  '1m': 60,
  '15m': 15 * 60,
  '1h': 60 * 60,
  '4h': 4 * 60 * 60,
};

// Bar spacing settings for different intervals (pixels per bar)
// These values control the visual density of candles on screen
const INTERVAL_BAR_SPACING: Record<string, { barSpacing: number; minBarSpacing: number }> = {
  '1m': { barSpacing: 12, minBarSpacing: 8 },   // Original working values
  '15m': { barSpacing: 12, minBarSpacing: 8 },  // Same density as 1m
  '1h': { barSpacing: 12, minBarSpacing: 8 },   // Same density as 1m
  '4h': { barSpacing: 12, minBarSpacing: 8 },   // Same density as 1m
};

export function PriceChart({ candles, predictions, blocks, className, assetType, interval = '1m' }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  // Per-block area series for colored bands (high fills + low masks)
  const blockHighSeriesRef = useRef<ISeriesApi<'Area'>[]>([]);
  const blockLowSeriesRef = useRef<ISeriesApi<'Area'>[]>([]);
  const midLineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: '#21262d' },
        horzLines: { color: '#21262d' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#8b949e',
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: '#8b949e',
          width: 1,
          style: LineStyle.Dashed,
        },
      },
      rightPriceScale: {
        borderColor: '#30363d',
      },
      timeScale: {
        borderColor: '#30363d',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        fixLeftEdge: false,
        fixRightEdge: false,
        shiftVisibleRangeOnNewBar: false,
        barSpacing: INTERVAL_BAR_SPACING[interval]?.barSpacing || 12,
        minBarSpacing: INTERVAL_BAR_SPACING[interval]?.minBarSpacing || 6,
      },
      localization: {
        timeFormatter: (timestamp: number) => {
          const date = new Date(timestamp * 1000);
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        },
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    // Create 3 pairs of area series for block-colored bands
    // Each block gets a HIGH area (colored fill) and LOW area (background mask)
    const blockFillColors = [COLORS.block1Fill, COLORS.block2Fill, COLORS.block3Fill];
    const blockLineColors = [COLORS.block1, COLORS.block2, COLORS.block3]; // Matching line colors

    const highSeries: ISeriesApi<'Area'>[] = [];
    const lowSeries: ISeriesApi<'Area'>[] = [];

    for (let i = 0; i < 3; i++) {
      // HIGH area for this block (colored fill)
      const high = chart.addAreaSeries({
        topColor: blockFillColors[i],
        bottomColor: blockFillColors[i],
        lineColor: blockLineColors[i],
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      highSeries.push(high);

      // LOW area for this block (background mask)
      const low = chart.addAreaSeries({
        topColor: COLORS.background,
        bottomColor: COLORS.background,
        lineColor: blockLineColors[i],
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      lowSeries.push(low);
    }

    // Mid target line (dashed, purple)
    const midLineSeries = chart.addLineSeries({
      color: COLORS.mid,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // Volume histogram - separate price scale at bottom, renders behind everything
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });

    // Configure volume price scale (bottom 15% of chart)
    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.85,
        bottom: 0,
      },
      borderVisible: false,
    });

    // Candlestick series - added LAST so it renders on top of prediction band
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: COLORS.candleUp,
      downColor: COLORS.candleDown,
      borderDownColor: COLORS.candleDown,
      borderUpColor: COLORS.candleUp,
      wickDownColor: COLORS.candleDown,
      wickUpColor: COLORS.candleUp,
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;
    blockHighSeriesRef.current = highSeries;
    blockLowSeriesRef.current = lowSeries;
    midLineSeriesRef.current = midLineSeries;

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  // Update timeScale settings when interval changes (for proper bar spacing)
  useEffect(() => {
    if (!chartRef.current) return;

    const spacing = INTERVAL_BAR_SPACING[interval] || { barSpacing: 12, minBarSpacing: 6 };
    chartRef.current.applyOptions({
      timeScale: {
        barSpacing: spacing.barSpacing,
        minBarSpacing: spacing.minBarSpacing,
      },
    });
  }, [interval]);

  // Update candle data - only show candles within the prediction time window
  // For stocks, additionally filter to RTH (Regular Trading Hours) only
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return;

    // If we have predictions, only show candles from the first prediction onwards
    let filteredCandles = candles;
    if (predictions.length > 0) {
      const firstPredTime = Math.min(...predictions.map((p) => p.time));
      // Show candles from 1 hour before first prediction (for some context)
      const cutoffTime = firstPredTime - 60 * 60;
      filteredCandles = candles.filter((c) => c.time >= cutoffTime);
    }

    // For stocks, filter to RTH only (9:30 AM - 4:00 PM ET)
    if (assetType === 'stock') {
      filteredCandles = filteredCandles.filter((c) => isWithinRTH(c.time));
    }

    const candleData: CandlestickData<Time>[] = filteredCandles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    // Volume data with colors based on candle direction
    const volumeData: HistogramData<Time>[] = filteredCandles.map((c) => ({
      time: c.time as Time,
      value: c.volume || 0,
      color: c.close >= c.open
        ? 'rgba(63, 185, 80, 0.5)'  // Green (up) with transparency
        : 'rgba(248, 81, 73, 0.5)', // Red (down) with transparency
    }));

    candlestickSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);
  }, [candles, predictions, assetType]);

  // Catmull-Rom spline interpolation for smooth curves through all data points
  // This creates natural-looking curves that pass through each prediction exactly
  // Uses centripetal Catmull-Rom which is well-behaved and avoids overshooting
  const catmullRomInterpolate = (
    p0: number, p1: number, p2: number, p3: number,
    t: number
  ): number => {
    // Standard Catmull-Rom with alpha=0.5 (centripetal)
    // At t=0 returns p1, at t=1 returns p2
    const t2 = t * t;
    const t3 = t2 * t;

    // Catmull-Rom basis matrix coefficients (tau = 0.5)
    // This formula is normalized so output is between p1 and p2
    return 0.5 * (
      (2 * p1) +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
  };

  // Interpolate between prediction points to create smooth curved lines
  // Uses Catmull-Rom splines for natural, visually appealing curves
  // CRITICAL: Timestamps must be snapped to candle boundaries to avoid gaps
  const interpolatePredictions = (predictions: Horizon[], key: 'high' | 'low' | 'close'): LineData<Time>[] => {
    if (predictions.length < 2) {
      return predictions.map(p => ({ time: p.time as Time, value: p[key] }));
    }

    const sorted = [...predictions].sort((a, b) => a.time - b.time);
    const result: LineData<Time>[] = [];
    const INTERVAL = INTERVAL_TO_SECONDS[interval] || 60; // Match candle interval

    // Snap a timestamp to the nearest candle boundary (floor to interval)
    const snapToGrid = (timestamp: number): number => {
      return Math.floor(timestamp / INTERVAL) * INTERVAL;
    };

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      // Snap start and end times to candle grid
      const startTime = snapToGrid(current.time);
      const endTime = snapToGrid(next.time);
      const timeDiff = next.time - current.time; // Use original times for ratio calculation

      // Get the 4 control points for Catmull-Rom spline
      // For edge cases, extend the boundary points by mirroring the slope
      const p0 = i > 0 ? sorted[i - 1][key] : current[key] - (next[key] - current[key]);
      const p1 = current[key];
      const p2 = next[key];
      const p3 = i < sorted.length - 2
        ? sorted[i + 2][key]
        : next[key] + (next[key] - current[key]);

      // Generate points on the candle grid from startTime to endTime
      for (let t = startTime; t < endTime; t += INTERVAL) {
        // Calculate ratio based on where t falls between current and next prediction times
        const ratio = Math.max(0, Math.min(1, (t - current.time) / timeDiff));
        const value = catmullRomInterpolate(p0, p1, p2, p3, ratio);
        result.push({ time: t as Time, value });
      }
    }

    // Add the final point (snapped to grid)
    const last = sorted[sorted.length - 1];
    const lastSnapped = snapToGrid(last.time);
    result.push({ time: lastSnapped as Time, value: last[key] });

    return result;
  };

  // Update prediction data with interpolation for smooth band - split by block
  useEffect(() => {
    if (
      blockHighSeriesRef.current.length === 0 ||
      blockLowSeriesRef.current.length === 0 ||
      !midLineSeriesRef.current ||
      predictions.length === 0
    )
      return;

    // If we have blocks, split predictions by block and color each differently
    if (blocks && blocks.length > 0) {
      const blockColors = [COLORS.block1, COLORS.block2, COLORS.block3];

      // Sort blocks by their first horizon time
      const sortedBlocks = [...blocks].sort((a, b) => {
        const aTime = a.horizons.length > 0 ? Math.min(...a.horizons.map(h => h.time)) : Infinity;
        const bTime = b.horizons.length > 0 ? Math.min(...b.horizons.map(h => h.time)) : Infinity;
        return aTime - bTime;
      });

      sortedBlocks.forEach((block, index) => {
        if (index >= 3) return; // Only support 3 blocks

        const blockHorizons = block.horizons;
        if (blockHorizons.length === 0) {
          // Clear this block's series if no data
          blockHighSeriesRef.current[index]?.setData([]);
          blockLowSeriesRef.current[index]?.setData([]);
          return;
        }

        // Build extended horizons with context from adjacent blocks for smooth transitions
        // We need points BEFORE and AFTER the block boundaries for Catmull-Rom to calculate proper slopes
        let extendedHorizons = [...blockHorizons];

        // Add previous block's last horizon as context (for smooth entry)
        const prevBlock = index > 0 ? sortedBlocks[index - 1] : null;
        if (prevBlock && prevBlock.horizons.length > 0) {
          const prevLastHorizon = prevBlock.horizons.reduce((max, h) =>
            h.time > max.time ? h : max, prevBlock.horizons[0]);
          extendedHorizons.unshift(prevLastHorizon);
        }

        // Add next block's first TWO horizons as context (for smooth exit)
        // Two points give Catmull-Rom the trajectory information it needs
        const nextBlock = sortedBlocks[index + 1];
        if (nextBlock && nextBlock.horizons.length > 0) {
          const sortedNextHorizons = [...nextBlock.horizons].sort((a, b) => a.time - b.time);
          // Add first horizon of next block
          extendedHorizons.push(sortedNextHorizons[0]);
          // Add second horizon if available for better trajectory
          if (sortedNextHorizons.length > 1) {
            extendedHorizons.push(sortedNextHorizons[1]);
          }
        }

        // Interpolate with extended context
        const highData = interpolatePredictions(extendedHorizons, 'high');
        const lowData = interpolatePredictions(extendedHorizons, 'low');

        // Filter to keep points within THIS block's time range
        // IMPORTANT: Use snapped boundaries since interpolated points are on the grid
        const INTERVAL = INTERVAL_TO_SECONDS[interval] || 60;
        const snapToGrid = (t: number) => Math.floor(t / INTERVAL) * INTERVAL;

        const blockStartRaw = Math.min(...blockHorizons.map(h => h.time));
        const blockEndRaw = nextBlock && nextBlock.horizons.length > 0
          ? Math.min(...nextBlock.horizons.map(h => h.time))
          : Math.max(...blockHorizons.map(h => h.time));

        // Snap boundaries to grid, but be inclusive
        const blockStart = snapToGrid(blockStartRaw);
        const blockEnd = snapToGrid(blockEndRaw);

        const filteredHighData = highData.filter(d => {
          const t = d.time as number;
          return t >= blockStart && t <= blockEnd;
        });
        const filteredLowData = lowData.filter(d => {
          const t = d.time as number;
          return t >= blockStart && t <= blockEnd;
        });

        // Set data for this block's area series (using filtered data for clean block boundaries)
        blockHighSeriesRef.current[index]?.setData(filteredHighData as AreaData<Time>[]);
        blockLowSeriesRef.current[index]?.setData(filteredLowData as AreaData<Time>[]);

        // Add marker for THIS block's start on THIS block's series
        const firstHorizon = blockHorizons.reduce((min, h) =>
          h.time < min.time ? h : min, blockHorizons[0]);

        blockHighSeriesRef.current[index]?.setMarkers([{
          time: firstHorizon.time as Time,
          position: 'aboveBar',
          color: blockColors[index % blockColors.length],
          shape: 'square',
          text: block.label.replace('Block ', 'B').substring(0, 12),
          size: 1,
        }]);
      });
    } else {
      // Fallback: no blocks, use all predictions with first block's color
      const highData = interpolatePredictions(predictions, 'high');
      const lowData = interpolatePredictions(predictions, 'low');
      blockHighSeriesRef.current[0]?.setData(highData as AreaData<Time>[]);
      blockLowSeriesRef.current[0]?.setData(lowData as AreaData<Time>[]);
      // Clear other block series
      for (let i = 1; i < 3; i++) {
        blockHighSeriesRef.current[i]?.setData([]);
        blockLowSeriesRef.current[i]?.setData([]);
      }
    }

    // Mid line uses all predictions (continuous dashed line)
    const midData = interpolatePredictions(predictions, 'close');
    midLineSeriesRef.current.setData(midData);
  }, [predictions, blocks]);

  // Set visible range - anchor current candle in rightmost third of chart
  // Primary: Current candle visible in rightmost-third
  // Secondary: Block marker visible on left (if it fits)
  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return;

    // Use requestAnimationFrame for smoother updates instead of setTimeout
    requestAnimationFrame(() => {
      if (!chartRef.current) return;

      const now = Math.floor(Date.now() / 1000);
      const lastCandleTime = Math.max(...candles.map((c) => c.time));
      const currentTime = Math.max(now, lastCandleTime);

      // Default visible duration based on interval (show more candles for larger intervals)
      const intervalSeconds = INTERVAL_TO_SECONDS[interval] || 60;
      // Show roughly 60-100 candles worth of time
      const defaultDuration = intervalSeconds * 80;

      // Calculate range to put current candle at ~66% (rightmost third)
      // If currentTime is at 66% of the range, then:
      // rangeStart + 0.66 * duration = currentTime
      // rangeStart = currentTime - 0.66 * duration
      const rightOffset = 0.66;
      let rangeStart = currentTime - (defaultDuration * rightOffset);
      let rangeEnd = rangeStart + defaultDuration;

      // Try to include block marker if we have blocks
      if (blocks && blocks.length > 0) {
        const blockRanges = blocks
          .map((block) => {
            if (block.horizons.length === 0) return null;
            const times = block.horizons.map((h) => h.time);
            return {
              start: Math.min(...times),
              end: Math.max(...times),
              label: block.label,
            };
          })
          .filter((b): b is NonNullable<typeof b> => b !== null);

        blockRanges.sort((a, b) => a.start - b.start);

        // Find current block
        let currentBlock = blockRanges.find(
          (range) => now >= range.start && now <= range.end
        );

        if (!currentBlock) {
          for (let i = blockRanges.length - 1; i >= 0; i--) {
            if (now >= blockRanges[i].start) {
              currentBlock = blockRanges[i];
              break;
            }
          }
        }

        if (!currentBlock && blockRanges.length > 0) {
          currentBlock = blockRanges[0];
        }

        if (currentBlock) {
          const blockStart = currentBlock.start;

          // Check if block marker would be visible with our calculated range
          if (blockStart >= rangeStart) {
            // Block marker is visible - great, keep current range
            // But add a small buffer before block start for context
            const bufferTime = intervalSeconds * 5;
            if (blockStart - bufferTime < rangeStart) {
              rangeStart = blockStart - bufferTime;
              // Recalculate rangeEnd to maintain the same duration
              rangeEnd = rangeStart + defaultDuration;
            }
          } else {
            // Block marker is too far left to fit
            // Option 1: Expand range to include it (may make current candle too small)
            // Option 2: Keep current candle priority (user's preference)
            // Going with Option 2: current candle takes priority
            const blockToCurrentDiff = currentTime - blockStart;
            const maxExpandRatio = 1.5; // Don't expand more than 1.5x

            if (blockToCurrentDiff <= defaultDuration * maxExpandRatio) {
              // Block is close enough - expand range to include both
              const bufferTime = intervalSeconds * 5;
              rangeStart = blockStart - bufferTime;
              // Put current candle at ~70% instead of 66% when expanding
              rangeEnd = currentTime + ((currentTime - rangeStart) * 0.43);
            }
            // Otherwise, keep current candle priority (block won't be visible)
          }
        }
      }

      // Add some future space for predictions
      const futureBuffer = intervalSeconds * 15;
      rangeEnd = Math.max(rangeEnd, currentTime + futureBuffer);

      chartRef.current.timeScale().setVisibleRange({
        from: rangeStart as Time,
        to: rangeEnd as Time,
      });
    });
  }, [candles, predictions, blocks, interval]);

  return (
    <div className={`relative ${className || ''}`}>
      <div ref={containerRef} className="w-full h-full" />
      <ChartLegend />
    </div>
  );
}

function ChartLegend() {
  return (
    <div className="absolute top-3 left-3 bg-[#161b22]/90 border border-[#30363d] rounded-lg px-3.5 py-2.5 backdrop-blur-sm z-10">
      <div className="text-[11px] text-[#8b949e] uppercase tracking-wider mb-2">
        Prediction Bands
      </div>
      <div className="flex items-center gap-2 text-xs mb-1">
        <div
          className="w-4 h-3 rounded-sm"
          style={{ background: COLORS.block1Fill, borderColor: COLORS.block1, borderWidth: 1, borderStyle: 'solid' }}
        />
        <span>Outlook</span>
      </div>
      <div className="flex items-center gap-2 text-xs mb-1">
        <div
          className="w-4 h-3 rounded-sm"
          style={{ background: COLORS.block2Fill, borderColor: COLORS.block2, borderWidth: 1, borderStyle: 'solid' }}
        />
        <span>Continuation</span>
      </div>
      <div className="flex items-center gap-2 text-xs mb-1">
        <div
          className="w-4 h-3 rounded-sm"
          style={{ background: COLORS.block3Fill, borderColor: COLORS.block3, borderWidth: 1, borderStyle: 'solid' }}
        />
        <span>Persistence</span>
      </div>
      <div className="flex items-center gap-2 text-xs mt-2 pt-2 border-t border-[#30363d]">
        <div
          className="w-4 h-0.5 rounded"
          style={{ background: COLORS.mid }}
        />
        <span className="text-[#8b949e]">Mid Target</span>
      </div>
    </div>
  );
}
