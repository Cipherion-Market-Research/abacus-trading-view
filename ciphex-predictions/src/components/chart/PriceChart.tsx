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

const COLORS = {
  high: '#58a6ff',
  mid: '#a371f7',
  low: '#58a6ff',
  background: '#0d1117', // Chart background color for masking
  candleUp: '#3fb950',
  candleDown: '#f85149',
  // Block colors - muted fills for the prediction band
  block1Fill: 'rgba(63, 185, 80, 0.12)',   // Muted green - Outlook
  block2Fill: 'rgba(240, 136, 62, 0.12)',  // Muted orange - Continuation
  block3Fill: 'rgba(163, 113, 247, 0.12)', // Muted purple - Persistence
  // Block marker colors (solid, for markers)
  block1: '#3fb950', // Green - Outlook
  block2: '#f0883e', // Orange - Continuation
  block3: '#a371f7', // Purple - Persistence
};

interface PriceChartProps {
  candles: Candle[];
  predictions: Horizon[];
  blocks?: Block[];
  className?: string;
}

export function PriceChart({ candles, predictions, blocks, className }: PriceChartProps) {
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
        barSpacing: 12,
        minBarSpacing: 8,
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
    const blockLineColors = ['#3fb950', '#f0883e', '#a371f7']; // Matching line colors

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

  // Update candle data - only show candles within the prediction time window
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
  }, [candles, predictions]);

  // Interpolate between prediction points to create smooth lines
  // IMPORTANT: Interval must roughly match candle interval to keep candles readable
  // (lightweight-charts uses the highest-frequency data to set bar width)
  const interpolatePredictions = (predictions: Horizon[], key: 'high' | 'low' | 'close'): LineData<Time>[] => {
    if (predictions.length < 2) {
      return predictions.map(p => ({ time: p.time as Time, value: p[key] }));
    }

    const sorted = [...predictions].sort((a, b) => a.time - b.time);
    const result: LineData<Time>[] = [];
    const INTERVAL = 60; // Generate a point every 1 minute (matches 1m candles)

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      const timeDiff = next.time - current.time;
      const valueDiff = next[key] - current[key];
      const steps = Math.floor(timeDiff / INTERVAL);

      // Add points from current to just before next
      for (let step = 0; step < steps; step++) {
        const t = current.time + step * INTERVAL;
        const ratio = step / steps;
        const value = current[key] + valueDiff * ratio;
        result.push({ time: t as Time, value });
      }
    }

    // Add the final point
    const last = sorted[sorted.length - 1];
    result.push({ time: last.time as Time, value: last[key] });

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

        // Get next block's first horizon to extend this block's data to connect
        const nextBlock = sortedBlocks[index + 1];
        let extendedHorizons = [...blockHorizons];

        if (nextBlock && nextBlock.horizons.length > 0) {
          // Find the first horizon of next block
          const nextFirstHorizon = nextBlock.horizons.reduce((min, h) =>
            h.time < min.time ? h : min, nextBlock.horizons[0]);
          // Add it to this block's horizons to close the gap
          extendedHorizons.push(nextFirstHorizon);
        }

        // Interpolate this block's predictions (extended to next block start)
        const highData = interpolatePredictions(extendedHorizons, 'high');
        const lowData = interpolatePredictions(extendedHorizons, 'low');

        // Set data for this block's area series
        blockHighSeriesRef.current[index]?.setData(highData as AreaData<Time>[]);
        blockLowSeriesRef.current[index]?.setData(lowData as AreaData<Time>[]);

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

  // Set visible range - dynamically anchor on current block's start marker
  // Shows the current block marker on the left side of the chart
  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return;

    setTimeout(() => {
      if (!chartRef.current) return;

      const now = Math.floor(Date.now() / 1000);
      let rangeStart: number;
      let rangeEnd: number;

      // If we have blocks, find the current block and anchor on its start
      if (blocks && blocks.length > 0) {
        // Build block time ranges (start time of first horizon, end time of last horizon)
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

        // Sort by start time
        blockRanges.sort((a, b) => a.start - b.start);

        // Find the block we're currently in (now is between start and end)
        let currentBlock = blockRanges.find(
          (range) => now >= range.start && now <= range.end
        );

        // If not currently in a block, find the most recent one that has started
        if (!currentBlock) {
          for (let i = blockRanges.length - 1; i >= 0; i--) {
            if (now >= blockRanges[i].start) {
              currentBlock = blockRanges[i];
              break;
            }
          }
        }

        // If still no block (we're before all blocks), use the first one
        if (!currentBlock && blockRanges.length > 0) {
          currentBlock = blockRanges[0];
        }

        if (currentBlock) {
          // Anchor view so the block start marker is on the left side
          // Add 30 min buffer before block start to show some candle context
          const buffer = 30 * 60;
          rangeStart = currentBlock.start - buffer;
          // Show 3 hours total from rangeStart
          rangeEnd = rangeStart + 3 * 60 * 60;
        }
      }

      // Fallback to candle-based positioning if no blocks
      if (!rangeStart! || !rangeEnd!) {
        const lastCandleTime = Math.max(...candles.map((c) => c.time));
        rangeStart = lastCandleTime - 1 * 60 * 60;
        rangeEnd = lastCandleTime + 2 * 60 * 60;
      }

      chartRef.current.timeScale().setVisibleRange({
        from: rangeStart as Time,
        to: rangeEnd as Time,
      });
    }, 150);
  }, [candles, predictions, blocks]);

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
          className="w-4 h-3 rounded-sm border border-[#3fb950]"
          style={{ background: COLORS.block1Fill }}
        />
        <span>Outlook</span>
      </div>
      <div className="flex items-center gap-2 text-xs mb-1">
        <div
          className="w-4 h-3 rounded-sm border border-[#f0883e]"
          style={{ background: COLORS.block2Fill }}
        />
        <span>Continuation</span>
      </div>
      <div className="flex items-center gap-2 text-xs mb-1">
        <div
          className="w-4 h-3 rounded-sm border border-[#a371f7]"
          style={{ background: COLORS.block3Fill }}
        />
        <span>Persistence</span>
      </div>
      <div className="flex items-center gap-2 text-xs mt-2 pt-2 border-t border-[#30363d]">
        <div
          className="w-4 h-0.5 rounded"
          style={{ background: '#a371f7' }}
        />
        <span className="text-[#8b949e]">Mid Target</span>
      </div>
    </div>
  );
}
