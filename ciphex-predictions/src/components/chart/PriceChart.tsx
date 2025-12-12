'use client';

import { useEffect, useRef, useState } from 'react';
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
import { calculateMACD, calculateEMA } from '@/lib/indicators';

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
  // Technical indicator colors
  ema200d: '#FF9800',      // Orange for 200-day EMA (the classic)
  ema20: '#FFD700',        // Gold/Yellow for 20-period EMA (short-term momentum)
  macdPositive: '#0ECB81', // Green for bullish histogram
  macdNegative: '#F6465D', // Red for bearish histogram
};

interface PriceChartProps {
  candles: Candle[];
  dailyCandles?: Candle[];
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

// Default visible candle window for each interval
// Defines how many candles to show by default when switching intervals
// For 15m/1h/4h: 24-hour cycle. For 1m: ~1 hour of data
const INTERVAL_CANDLE_WINDOW: Record<string, { back: number; forward: number }> = {
  '1m': { back: 60, forward: 15 },      // 60 candles back (~1h), 15 forward (~15min)
  '15m': { back: 96, forward: 4 },      // 96 candles back (24h), 4 forward (~1h)
  '1h': { back: 24, forward: 4 },       // 24 candles back (24h), 4 forward (~4h)
  '4h': { back: 6, forward: 2 },        // 6 candles back (24h), 2 forward (~8h)
};

export function PriceChart({ candles, dailyCandles, predictions, blocks, className, assetType, interval = '1m' }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const macdSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema200dPriceLineRef = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null>(null);  // 200-day EMA as price line
  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);    // 20-period EMA (current timeframe)

  // State for displaying EMA 200D value in legend and Y-axis indicator
  const [ema200dValue, setEma200dValue] = useState<number | null>(null);
  const [ema200dPosition, setEma200dPosition] = useState<'above' | 'below' | 'visible' | null>(null);

  // Per-block area series for colored bands (high fills + low masks)
  const blockHighSeriesRef = useRef<ISeriesApi<'Area'>[]>([]);
  const blockLowSeriesRef = useRef<ISeriesApi<'Area'>[]>([]);
  const midLineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  // Track if we've set the initial visible range (to avoid resetting on every candle update)
  const hasSetInitialRangeRef = useRef<boolean>(false);
  // Track the last interval to detect changes
  const lastIntervalRef = useRef<string>(interval);

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
        scaleMargins: {
          top: 0.05,    // 5% margin at top
          bottom: 0.25, // 25% margin at bottom (room for MACD)
        },
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

    // MACD histogram - separate price scale at bottom, renders behind everything
    const macdSeries = chart.addHistogramSeries({
      priceFormat: {
        type: 'price',
        precision: 6,
        minMove: 0.000001,
      },
      priceScaleId: 'macd',
    });

    // Configure MACD price scale (bottom 20% of chart)
    chart.priceScale('macd').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
      borderVisible: false,
    });

    // 200-day EMA is added as a price line (not a series) to avoid affecting auto-scaling
    // It will be created dynamically when daily candle data is available

    // 20-period EMA line overlay (short-term momentum on current timeframe)
    const ema20Series = chart.addLineSeries({
      color: COLORS.ema20,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'EMA 20',
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
    macdSeriesRef.current = macdSeries;
    ema20SeriesRef.current = ema20Series;
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
    if (!candlestickSeriesRef.current || !macdSeriesRef.current || !ema20SeriesRef.current) return;

    // Clear chart when candles array is empty (e.g., during interval switch)
    if (candles.length === 0) {
      candlestickSeriesRef.current.setData([]);
      macdSeriesRef.current.setData([]);
      ema20SeriesRef.current.setData([]);
      return;
    }

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

    candlestickSeriesRef.current.setData(candleData);

    // Calculate MACD (12/26/9) from ALL candles for accurate indicator values
    const sortedAllCandles = [...candles].sort((a, b) => a.time - b.time);
    const closesForIndicators = sortedAllCandles.map((c) => ({ time: c.time, close: c.close }));

    // Calculate MACD histogram
    const macdData = calculateMACD(closesForIndicators, 12, 26, 9);
    const macdHistogramData: HistogramData<Time>[] = macdData.map((m) => ({
      time: m.time as Time,
      value: m.histogram,
      color: m.histogram >= 0 ? COLORS.macdPositive : COLORS.macdNegative,
    }));
    macdSeriesRef.current.setData(macdHistogramData);

    // Calculate 20-period EMA (short-term momentum on current timeframe)
    const ema20Data = calculateEMA(closesForIndicators, 20);
    const ema20LineData: LineData<Time>[] = ema20Data.map((e) => ({
      time: e.time as Time,
      value: e.value,
    }));
    ema20SeriesRef.current.setData(ema20LineData);
  }, [candles, predictions, assetType, interval]);

  // Update 200-day EMA from daily candles as a PRICE LINE (not a series)
  // Using a price line instead of a line series prevents it from affecting auto-scaling
  // This is critical because the 200-day EMA can be far from current price
  useEffect(() => {
    // Don't add price line if no daily candles
    if (!dailyCandles || dailyCandles.length === 0) {
      setEma200dValue(null);
      return;
    }

    // Calculate 200-day EMA from daily candles
    const sortedDailyCandles = [...dailyCandles].sort((a, b) => a.time - b.time);
    const dailyCloses = sortedDailyCandles.map((c) => ({ time: c.time, close: c.close }));

    const ema200dData = calculateEMA(dailyCloses, 200);

    if (ema200dData.length === 0) {
      setEma200dValue(null);
      return;
    }

    // Get the latest 200-day EMA value and store it for display
    const lastEmaValue = ema200dData[ema200dData.length - 1].value;
    setEma200dValue(lastEmaValue);

    // Create price line on candlestick series if available
    if (!candlestickSeriesRef.current) return;

    // Remove existing price line if any
    if (ema200dPriceLineRef.current) {
      candlestickSeriesRef.current.removePriceLine(ema200dPriceLineRef.current);
      ema200dPriceLineRef.current = null;
    }

    // Create a price line at the 200-day EMA level
    // This shows as a horizontal reference line with a label, but doesn't affect scaling
    const priceLine = candlestickSeriesRef.current.createPriceLine({
      price: lastEmaValue,
      color: COLORS.ema200d,
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: 'EMA 200D',
    });

    ema200dPriceLineRef.current = priceLine;
  }, [dailyCandles]);

  // Determine EMA 200D position relative to visible price range (from candle data)
  useEffect(() => {
    if (ema200dValue === null || candles.length === 0) {
      setEma200dPosition(null);
      return;
    }

    // Calculate visible price range from candle data
    // Include predictions if they extend the range
    const candleHighs = candles.map(c => c.high);
    const candleLows = candles.map(c => c.low);
    const predictionHighs = predictions.map(p => p.high);
    const predictionLows = predictions.map(p => p.low);

    const maxPrice = Math.max(...candleHighs, ...predictionHighs);
    const minPrice = Math.min(...candleLows, ...predictionLows);

    // Add some buffer (5%) to account for chart padding
    const buffer = (maxPrice - minPrice) * 0.05;

    if (ema200dValue > maxPrice + buffer) {
      setEma200dPosition('above');
    } else if (ema200dValue < minPrice - buffer) {
      setEma200dPosition('below');
    } else {
      setEma200dPosition('visible');
    }
  }, [ema200dValue, candles, predictions]);

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
  // Only runs on initial load or when interval changes (not on every candle update)
  useEffect(() => {
    if (!chartRef.current) return;

    // Check if interval changed to reset the flag (but DON'T update lastIntervalRef yet)
    const intervalChanged = lastIntervalRef.current !== interval;
    if (intervalChanged) {
      hasSetInitialRangeRef.current = false;
    }

    // Now check if we have data to work with
    if (candles.length === 0) return;

    // CRITICAL: When interval changes, wait for enough candles before setting range
    // If we have too few candles, it means we're still loading the new interval's data
    const candleWindow = INTERVAL_CANDLE_WINDOW[interval] || { back: 60, forward: 15 };
    const minimumCandles = Math.min(candleWindow.back / 2, 10); // Need at least 50% of target or 10 candles
    if (intervalChanged && candles.length < minimumCandles) {
      // Still loading new interval data, skip this run
      return;
    }

    // Skip if we've already set the initial range for this interval (user may have panned/zoomed)
    if (hasSetInitialRangeRef.current) return;

    // Use requestAnimationFrame for smoother updates instead of setTimeout
    requestAnimationFrame(() => {
      if (!chartRef.current) return;

      // CRITICAL: Check interval change again INSIDE requestAnimationFrame
      // Only update lastIntervalRef AFTER successfully calling resetTimeScale
      const intervalChanged = lastIntervalRef.current !== interval;
      if (intervalChanged) {
        chartRef.current.timeScale().resetTimeScale();
        lastIntervalRef.current = interval; // Update tracking ref AFTER reset
      }

      // Use candle-based windowing instead of time-based for predictable results
      const candleWindow = INTERVAL_CANDLE_WINDOW[interval] || { back: 60, forward: 15 };

      // Sort candles by time to ensure correct indexing
      const sortedCandles = [...candles].sort((a, b) => a.time - b.time);

      // Find the current/latest candle (last in sorted array)
      const currentIndex = sortedCandles.length - 1;

      // Calculate indices for visible window
      const startIndex = Math.max(0, currentIndex - candleWindow.back);
      const endIndex = Math.min(sortedCandles.length - 1, currentIndex + candleWindow.forward);

      // Get timestamps from those indices
      let rangeStart = sortedCandles[startIndex].time;
      let rangeEnd = sortedCandles[endIndex].time;

      // Add a small buffer at the end for prediction overlay
      const intervalSeconds = INTERVAL_TO_SECONDS[interval] || 60;
      rangeEnd += intervalSeconds * 5; // 5 candles worth of buffer

      // Try to include the first block marker if it's close
      // This is a best-effort attempt - we prioritize showing the configured candle count
      if (blocks && blocks.length > 0) {
        const firstBlock = blocks.find(b => b.horizons.length > 0);
        if (firstBlock) {
          const blockStart = Math.min(...firstBlock.horizons.map(h => h.time));
          // If block marker is just slightly before our range, expand to include it
          if (blockStart < rangeStart && blockStart > rangeStart - (intervalSeconds * 10)) {
            rangeStart = blockStart - (intervalSeconds * 2); // Small buffer before block
          }
        }
      }

      chartRef.current.timeScale().setVisibleRange({
        from: rangeStart as Time,
        to: rangeEnd as Time,
      });

      // Mark that we've set the initial range
      hasSetInitialRangeRef.current = true;
    });
  }, [candles, predictions, blocks, interval]);

  // Format price for display
  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className={`relative ${className || ''}`}>
      <div ref={containerRef} className="w-full h-full" />
      <ChartLegend ema200dValue={ema200dValue} />

      {/* EMA 200D Y-axis indicator - shows when EMA is off-screen */}
      {ema200dValue !== null && ema200dPosition === 'above' && (
        <div
          className="absolute right-[60px] top-3 flex items-center gap-1 bg-[#FF9800] text-black text-xs font-semibold px-2 py-1 rounded shadow-lg z-20"
          style={{ borderLeft: '3px solid #FF9800' }}
        >
          <span>▲</span>
          <span>EMA 200D</span>
          <span>${formatPrice(ema200dValue)}</span>
        </div>
      )}
      {ema200dValue !== null && ema200dPosition === 'below' && (
        <div
          className="absolute right-[60px] bottom-[25%] flex items-center gap-1 bg-[#FF9800] text-black text-xs font-semibold px-2 py-1 rounded shadow-lg z-20"
          style={{ borderLeft: '3px solid #FF9800' }}
        >
          <span>▼</span>
          <span>EMA 200D</span>
          <span>${formatPrice(ema200dValue)}</span>
        </div>
      )}
    </div>
  );
}

function ChartLegend({ ema200dValue }: { ema200dValue: number | null }) {
  // Format large numbers with commas
  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

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
      <div className="text-[11px] text-[#8b949e] uppercase tracking-wider mt-3 mb-2">
        Indicators
      </div>
      <div className="flex items-center gap-2 text-xs mb-1">
        <div
          className="w-4 h-0.5 rounded"
          style={{ background: COLORS.ema200d }}
        />
        <span className="text-[#8b949e]">
          EMA 200D {ema200dValue !== null && <span className="text-[#FF9800] font-medium">${formatPrice(ema200dValue)}</span>}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs mb-1">
        <div
          className="w-4 h-0.5 rounded"
          style={{ background: COLORS.ema20 }}
        />
        <span className="text-[#8b949e]">EMA 20</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <div className="flex gap-0.5">
          <div
            className="w-1.5 h-3 rounded-sm"
            style={{ background: COLORS.macdPositive }}
          />
          <div
            className="w-1.5 h-2 rounded-sm"
            style={{ background: COLORS.macdNegative }}
          />
        </div>
        <span className="text-[#8b949e]">MACD (12,26,9)</span>
      </div>
    </div>
  );
}
