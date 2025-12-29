'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  MouseEventParams,
} from 'lightweight-charts';
import { Candle, Horizon, Block, ExchangePricePoint, ExchangeVisibility, DEFAULT_EXCHANGE_VISIBILITY } from '@/types';
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
  // Technical indicator colors (distinct from prediction bands)
  ema200d: '#FF9800',      // Orange for 200-day EMA (industry standard)
  ema200: '#B0BEC5',       // Silver/White for 200-period EMA (neutral reference)
  ema20: '#FF4081',        // Pink for 20-period EMA (short-term momentum)
  macdPositive: '#0ECB81', // Green for bullish histogram
  macdNegative: '#F6465D', // Red for bearish histogram
  // Exchange overlay colors
  composite_index: '#FFD700', // Gold for INDEX (premium/important)
  htx: '#00D1B2',          // HTX teal
  coinbase: '#0052FF',     // Coinbase blue
  gemini: '#00DCFA',       // Gemini cyan
  kraken: '#5741D9',       // Kraken purple
  bitstamp: '#4CAF50',     // Bitstamp green
  bitfinex: '#16B157',     // Bitfinex green
  crypto_com: '#002D74',   // Crypto.com navy
};

// Indicator visibility state type
interface IndicatorVisibility {
  ema200d: boolean;  // EMA 200 · 1D (daily)
  ema200: boolean;   // EMA 200 (chart timeframe)
  ema20: boolean;    // EMA 20
  macd: boolean;     // MACD histogram
}

// Default indicator visibility - all visible by default
const DEFAULT_INDICATOR_VISIBILITY: IndicatorVisibility = {
  ema200d: true,
  ema200: true,
  ema20: true,
  macd: true,
};

// localStorage key for persisting preferences
const INDICATOR_PREFS_KEY = 'ciphex-indicator-visibility';
const EXCHANGE_PREFS_KEY = 'ciphex-exchange-visibility';

// Exchange support flags
interface ExchangeSupport {
  htx: boolean;
  coinbase: boolean;
  gemini: boolean;
  kraken: boolean;
  bitstamp: boolean;
  bitfinex: boolean;
  crypto_com_usd: boolean;
  crypto_com_usdt: boolean;
  index: boolean;
}

// Exchange price data passed from parent
interface ExchangePriceData {
  support?: ExchangeSupport;
  composite_index?: {
    priceHistory: ExchangePricePoint[];
    currentPrice: number | null;
    connected: boolean;
    connectedCount?: number;
  };
  htx?: {
    priceHistory: ExchangePricePoint[];
    currentPrice: number | null;
    connected: boolean;
  };
  coinbase?: {
    priceHistory: ExchangePricePoint[];
    currentPrice: number | null;
    connected: boolean;
  };
  gemini?: {
    priceHistory: ExchangePricePoint[];
    currentPrice: number | null;
    connected: boolean;
  };
  kraken?: {
    priceHistory: ExchangePricePoint[];
    currentPrice: number | null;
    connected: boolean;
  };
  bitstamp?: {
    priceHistory: ExchangePricePoint[];
    currentPrice: number | null;
    connected: boolean;
  };
  bitfinex?: {
    priceHistory: ExchangePricePoint[];
    currentPrice: number | null;
    connected: boolean;
  };
  crypto_com_usd?: {
    priceHistory: ExchangePricePoint[];
    currentPrice: number | null;
    connected: boolean;
  };
  crypto_com_usdt?: {
    priceHistory: ExchangePricePoint[];
    currentPrice: number | null;
    connected: boolean;
  };
}

interface PriceChartProps {
  candles: Candle[];
  dailyCandles?: Candle[];
  predictions: Horizon[];
  blocks?: Block[];
  className?: string;
  assetType?: 'crypto' | 'dex' | 'stock';
  interval?: '15s' | '1m' | '15m' | '1h';
  refreshKey?: number;  // Increments to trigger visible range recalculation
  exchangeData?: ExchangePriceData;  // Exchange price overlays
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
  '15s': 15,
  '1m': 60,
  '15m': 15 * 60,
  '1h': 60 * 60,
};

// Bar spacing settings for different intervals (pixels per bar)
// These values control the visual density of candles on screen
// minBarSpacing allows compression when window shrinks (TradingView-style)
const INTERVAL_BAR_SPACING: Record<string, { barSpacing: number; minBarSpacing: number }> = {
  '15s': { barSpacing: 12, minBarSpacing: 1 },
  '1m': { barSpacing: 12, minBarSpacing: 1 },
  '15m': { barSpacing: 12, minBarSpacing: 1 },
  '1h': { barSpacing: 12, minBarSpacing: 1 },
};


export function PriceChart({ candles, dailyCandles, predictions, blocks, className, assetType, interval = '1m', refreshKey = 0, exchangeData }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const macdSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema200dPriceLineRef = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null>(null);  // 200-day EMA as price line
  const ema200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);   // 200-period EMA (current timeframe)
  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);    // 20-period EMA (current timeframe)

  // Exchange overlay line series refs
  const compositeIndexSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const htxSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const coinbaseSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const geminiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const krakenSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bitstampSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bitfinexSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const cryptoComUsdSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const cryptoComUsdtSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Compute EMA 200D value from daily candles (derived state, not useState)
  const ema200dValue = useMemo(() => {
    if (!dailyCandles || dailyCandles.length === 0) {
      return null;
    }
    const sortedDailyCandles = [...dailyCandles].sort((a, b) => a.time - b.time);
    const dailyCloses = sortedDailyCandles.map((c) => ({ time: c.time, close: c.close }));
    const ema200dData = calculateEMA(dailyCloses, 200);
    if (ema200dData.length === 0) {
      return null;
    }
    return ema200dData[ema200dData.length - 1].value;
  }, [dailyCandles]);

  // Determine EMA 200D position relative to visible price range (derived state)
  const ema200dPosition = useMemo((): 'above' | 'below' | 'visible' | null => {
    if (ema200dValue === null || candles.length === 0) {
      return null;
    }
    const candleHighs = candles.map(c => c.high);
    const candleLows = candles.map(c => c.low);
    const predictionHighs = predictions.map(p => p.high);
    const predictionLows = predictions.map(p => p.low);
    const maxPrice = Math.max(...candleHighs, ...predictionHighs);
    const minPrice = Math.min(...candleLows, ...predictionLows);
    const buffer = (maxPrice - minPrice) * 0.05;
    if (ema200dValue > maxPrice + buffer) {
      return 'above';
    } else if (ema200dValue < minPrice - buffer) {
      return 'below';
    }
    return 'visible';
  }, [ema200dValue, candles, predictions]);

  // State for crosshair hover - prediction band values
  const [crosshairBandValues, setCrosshairBandValues] = useState<{
    high: number | null;
    low: number | null;
    mid: number | null;
    highY: number | null;
    lowY: number | null;
    midY: number | null;
  }>({ high: null, low: null, mid: null, highY: null, lowY: null, midY: null });

  // Refs to store interpolated prediction data for crosshair lookup
  const interpolatedHighRef = useRef<Map<number, number>>(new Map());
  const interpolatedLowRef = useRef<Map<number, number>>(new Map());
  const interpolatedMidRef = useRef<Map<number, number>>(new Map());

  // Indicator visibility state with localStorage persistence
  // Initialize with defaults to avoid hydration mismatch, then load from localStorage in useEffect
  const [indicatorVisibility, setIndicatorVisibility] = useState<IndicatorVisibility>(DEFAULT_INDICATOR_VISIBILITY);

  // Load indicator visibility from localStorage after mount (avoids hydration mismatch)
  useEffect(() => {
    const saved = localStorage.getItem(INDICATOR_PREFS_KEY);
    if (saved) {
      try {
        setIndicatorVisibility({ ...DEFAULT_INDICATOR_VISIBILITY, ...JSON.parse(saved) });
      } catch {
        // Keep defaults on parse error
      }
    }
  }, []);

  // Toggle indicator visibility
  const toggleIndicator = (indicator: keyof IndicatorVisibility) => {
    setIndicatorVisibility((prev) => {
      const updated = { ...prev, [indicator]: !prev[indicator] };
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(INDICATOR_PREFS_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  };

  // Exchange visibility state with localStorage persistence
  // Initialize with defaults to avoid hydration mismatch, then load from localStorage in useEffect
  const [exchangeVisibility, setExchangeVisibility] = useState<ExchangeVisibility>(DEFAULT_EXCHANGE_VISIBILITY);

  // Load exchange visibility from localStorage after mount (avoids hydration mismatch)
  useEffect(() => {
    const saved = localStorage.getItem(EXCHANGE_PREFS_KEY);
    if (saved) {
      try {
        setExchangeVisibility({ ...DEFAULT_EXCHANGE_VISIBILITY, ...JSON.parse(saved) });
      } catch {
        // Keep defaults on parse error
      }
    }
  }, []);

  // Toggle exchange visibility
  const toggleExchange = (exchange: keyof ExchangeVisibility) => {
    setExchangeVisibility((prev) => {
      const updated = { ...prev, [exchange]: !prev[exchange] };
      if (typeof window !== 'undefined') {
        localStorage.setItem(EXCHANGE_PREFS_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  };

  // Per-block area series for colored bands (high fills + low masks)
  const blockHighSeriesRef = useRef<ISeriesApi<'Area'>[]>([]);
  const blockLowSeriesRef = useRef<ISeriesApi<'Area'>[]>([]);
  const midLineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  // Track if we've set the initial visible range (to avoid resetting on every candle update)
  const hasSetInitialRangeRef = useRef<boolean>(false);
  // Track the last interval to detect changes
  const lastIntervalRef = useRef<string>(interval);
  // Track the last refreshKey to detect manual refresh triggers
  const lastRefreshKeyRef = useRef<number>(refreshKey);

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
        lockVisibleTimeRangeOnResize: true,  // Compress/expand candles on window resize (TradingView-style)
        barSpacing: INTERVAL_BAR_SPACING[interval]?.barSpacing || 12,
        minBarSpacing: INTERVAL_BAR_SPACING[interval]?.minBarSpacing || 1,
        tickMarkFormatter: (timestamp: number) => {
          // Format x-axis tick labels in user's local time
          const date = new Date(timestamp * 1000);
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        },
      },
      localization: {
        timeFormatter: (timestamp: number) => {
          // Format crosshair/hover tooltip in user's local time
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

      // LOW area for this block (transparent fill, only draws the lower boundary line)
      // Using transparent instead of background color so grid lines remain visible
      const low = chart.addAreaSeries({
        topColor: 'transparent',
        bottomColor: 'transparent',
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

    // 200-period EMA line overlay (current timeframe)
    const ema200Series = chart.addLineSeries({
      color: COLORS.ema200,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'EMA 200',
    });

    // Exchange price overlay lines
    // Composite Index first (gold, thicker line as it's the aggregated reference)
    const compositeIndexSeries = chart.addLineSeries({
      color: COLORS.composite_index,
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'INDEX',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
    });

    const htxSeries = chart.addLineSeries({
      color: COLORS.htx,
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'HTX',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });

    const coinbaseSeries = chart.addLineSeries({
      color: COLORS.coinbase,
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'Coinbase',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });

    const geminiSeries = chart.addLineSeries({
      color: COLORS.gemini,
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'Gemini',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });

    const krakenSeries = chart.addLineSeries({
      color: COLORS.kraken,
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'Kraken',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });

    const bitstampSeries = chart.addLineSeries({
      color: COLORS.bitstamp,
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'Bitstamp',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });

    const bitfinexSeries = chart.addLineSeries({
      color: COLORS.bitfinex,
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'Bitfinex',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });

    const cryptoComUsdSeries = chart.addLineSeries({
      color: COLORS.crypto_com,
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'Crypto.com USD',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });

    const cryptoComUsdtSeries = chart.addLineSeries({
      color: '#1199FA',  // Lighter blue for USDT variant
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,  // Dashed to differentiate from USD
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'Crypto.com USDT',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
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
    ema200SeriesRef.current = ema200Series;
    compositeIndexSeriesRef.current = compositeIndexSeries;
    htxSeriesRef.current = htxSeries;
    coinbaseSeriesRef.current = coinbaseSeries;
    geminiSeriesRef.current = geminiSeries;
    krakenSeriesRef.current = krakenSeries;
    bitstampSeriesRef.current = bitstampSeries;
    bitfinexSeriesRef.current = bitfinexSeries;
    cryptoComUsdSeriesRef.current = cryptoComUsdSeries;
    cryptoComUsdtSeriesRef.current = cryptoComUsdtSeries;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Chart should only be created once on mount. Interval changes are handled by a separate effect.
  }, []);

  // Update timeScale settings when interval changes (for proper bar spacing)
  useEffect(() => {
    if (!chartRef.current) return;

    const spacing = INTERVAL_BAR_SPACING[interval] || { barSpacing: 12, minBarSpacing: 1 };
    chartRef.current.applyOptions({
      timeScale: {
        barSpacing: spacing.barSpacing,
        minBarSpacing: spacing.minBarSpacing,
      },
    });
  }, [interval]);

  // Subscribe to crosshair move events for prediction band values on Y-axis
  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current) return;

    const chart = chartRef.current;
    const series = candlestickSeriesRef.current;

    const handleCrosshairMove = (param: MouseEventParams<Time>) => {
      if (!param.time || !param.point) {
        // Mouse left the chart, clear values
        setCrosshairBandValues({
          high: null, low: null, mid: null,
          highY: null, lowY: null, midY: null,
        });
        return;
      }

      // Time can be a number (Unix timestamp) or a BusinessDay object
      // For our use case with Unix timestamps, we need to handle both
      const timestamp = typeof param.time === 'number' ? param.time : (param.time as { year: number; month: number; day: number }).year;

      // Look up band values at this timestamp
      const highValue = interpolatedHighRef.current.get(timestamp);
      const lowValue = interpolatedLowRef.current.get(timestamp);
      const midValue = interpolatedMidRef.current.get(timestamp);

      if (highValue === undefined && lowValue === undefined) {
        // No prediction data at this timestamp
        setCrosshairBandValues({
          high: null, low: null, mid: null,
          highY: null, lowY: null, midY: null,
        });
        return;
      }

      // Convert prices to Y coordinates
      const highY = highValue !== undefined ? series.priceToCoordinate(highValue) : null;
      const lowY = lowValue !== undefined ? series.priceToCoordinate(lowValue) : null;
      const midY = midValue !== undefined ? series.priceToCoordinate(midValue) : null;

      setCrosshairBandValues({
        high: highValue ?? null,
        low: lowValue ?? null,
        mid: midValue ?? null,
        highY: highY,
        lowY: lowY,
        midY: midY,
      });
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
    };
  }, []);

  // Update candle data - only show candles within the prediction time window
  // For stocks, additionally filter to RTH (Regular Trading Hours) only
  useEffect(() => {
    if (!candlestickSeriesRef.current || !macdSeriesRef.current || !ema20SeriesRef.current || !ema200SeriesRef.current) return;

    // Clear chart when candles array is empty (e.g., during interval switch)
    if (candles.length === 0) {
      candlestickSeriesRef.current.setData([]);
      macdSeriesRef.current.setData([]);
      ema20SeriesRef.current.setData([]);
      ema200SeriesRef.current.setData([]);
      return;
    }

    // Show all candles (no filtering) so they match MACD/EMA data range
    // The visible range is controlled separately, allowing users to scroll for more history
    let filteredCandles = candles;

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

    // Calculate indicators from ALL candles for accurate values
    const sortedAllCandles = [...candles].sort((a, b) => a.time - b.time);
    const closesForIndicators = sortedAllCandles.map((c) => ({ time: c.time, close: c.close }));

    // MACD histogram - show/hide based on visibility
    if (indicatorVisibility.macd) {
      const macdData = calculateMACD(closesForIndicators, 12, 26, 9);
      const macdHistogramData: HistogramData<Time>[] = macdData.map((m) => ({
        time: m.time as Time,
        value: m.histogram,
        color: m.histogram >= 0 ? COLORS.macdPositive : COLORS.macdNegative,
      }));
      macdSeriesRef.current.setData(macdHistogramData);
    } else {
      macdSeriesRef.current.setData([]);
    }

    // EMA 20 - show/hide based on visibility
    if (indicatorVisibility.ema20) {
      const ema20Data = calculateEMA(closesForIndicators, 20);
      const ema20LineData: LineData<Time>[] = ema20Data.map((e) => ({
        time: e.time as Time,
        value: e.value,
      }));
      ema20SeriesRef.current.setData(ema20LineData);
    } else {
      ema20SeriesRef.current.setData([]);
    }

    // EMA 200 (chart timeframe) - show/hide based on visibility
    if (indicatorVisibility.ema200) {
      const ema200Data = calculateEMA(closesForIndicators, 200);
      const ema200LineData: LineData<Time>[] = ema200Data.map((e) => ({
        time: e.time as Time,
        value: e.value,
      }));
      ema200SeriesRef.current.setData(ema200LineData);
    } else {
      ema200SeriesRef.current.setData([]);
    }
  }, [candles, predictions, assetType, interval, indicatorVisibility]);

  // Update exchange overlay data
  // Helper to ensure price is always a number (some APIs return strings)
  const ensureNumber = (val: number | string): number => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(num) ? 0 : num;
  };

  useEffect(() => {
    // Get support flags (default to false if not provided)
    const support = exchangeData?.support;

    // Helper to update exchange series with proper lastValueVisible toggling
    // This ensures the y-axis price label is hidden when series has no data
    const updateExchangeSeries = (
      seriesRef: React.RefObject<ISeriesApi<'Line'> | null>,
      shouldShow: boolean,
      priceHistory: { time: number; price: number }[] | undefined
    ) => {
      if (!seriesRef.current) return;

      if (shouldShow && priceHistory?.length) {
        const lineData: LineData<Time>[] = priceHistory.map((p) => ({
          time: p.time as Time,
          value: ensureNumber(p.price),
        }));
        seriesRef.current.setData(lineData);
        seriesRef.current.applyOptions({ lastValueVisible: true });
      } else {
        seriesRef.current.setData([]);
        // CRITICAL: Hide the y-axis price label when series is empty
        // Without this, the label persists showing stale prices from previous asset
        seriesRef.current.applyOptions({ lastValueVisible: false });
      }
    };

    // Composite Index overlay (TradingView-style INDEX)
    updateExchangeSeries(
      compositeIndexSeriesRef,
      !!(support?.index && exchangeVisibility.composite_index),
      exchangeData?.composite_index?.priceHistory
    );

    // HTX overlay
    updateExchangeSeries(
      htxSeriesRef,
      !!(support?.htx && exchangeVisibility.htx),
      exchangeData?.htx?.priceHistory
    );

    // Coinbase overlay
    updateExchangeSeries(
      coinbaseSeriesRef,
      !!(support?.coinbase && exchangeVisibility.coinbase),
      exchangeData?.coinbase?.priceHistory
    );

    // Gemini overlay
    updateExchangeSeries(
      geminiSeriesRef,
      !!(support?.gemini && exchangeVisibility.gemini),
      exchangeData?.gemini?.priceHistory
    );

    // Kraken overlay
    updateExchangeSeries(
      krakenSeriesRef,
      !!(support?.kraken && exchangeVisibility.kraken),
      exchangeData?.kraken?.priceHistory
    );

    // Bitstamp overlay
    updateExchangeSeries(
      bitstampSeriesRef,
      !!(support?.bitstamp && exchangeVisibility.bitstamp),
      exchangeData?.bitstamp?.priceHistory
    );

    // Bitfinex overlay
    updateExchangeSeries(
      bitfinexSeriesRef,
      !!(support?.bitfinex && exchangeVisibility.bitfinex),
      exchangeData?.bitfinex?.priceHistory
    );

    // Crypto.com USD overlay
    updateExchangeSeries(
      cryptoComUsdSeriesRef,
      !!(support?.crypto_com_usd && exchangeVisibility.crypto_com_usd),
      exchangeData?.crypto_com_usd?.priceHistory
    );

    // Crypto.com USDT overlay
    updateExchangeSeries(
      cryptoComUsdtSeriesRef,
      !!(support?.crypto_com_usdt && exchangeVisibility.crypto_com_usdt),
      exchangeData?.crypto_com_usdt?.priceHistory
    );
  }, [exchangeData, exchangeVisibility]);

  // Create/update 200-day EMA price line when value changes
  // The ema200dValue is computed via useMemo above, this effect handles the chart update
  useEffect(() => {
    // Remove existing price line first
    if (candlestickSeriesRef.current && ema200dPriceLineRef.current) {
      candlestickSeriesRef.current.removePriceLine(ema200dPriceLineRef.current);
      ema200dPriceLineRef.current = null;
    }

    // Don't add price line if no value or indicator is hidden
    if (ema200dValue === null || !indicatorVisibility.ema200d || !candlestickSeriesRef.current) {
      return;
    }

    // Create a price line at the 200-day EMA level
    // This shows as a horizontal reference line with a label, but doesn't affect scaling
    const priceLine = candlestickSeriesRef.current.createPriceLine({
      price: ema200dValue,
      color: COLORS.ema200d,
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: 'EMA 200 · 1D',
    });

    ema200dPriceLineRef.current = priceLine;
  }, [ema200dValue, indicatorVisibility.ema200d]);

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
  const interpolatePredictions = useCallback((preds: Horizon[], key: 'high' | 'low' | 'close'): LineData<Time>[] => {
    if (preds.length < 2) {
      return preds.map(p => ({ time: p.time as Time, value: p[key] }));
    }

    const sorted = [...preds].sort((a, b) => a.time - b.time);
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
  }, [interval]);

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
        const extendedHorizons = [...blockHorizons];

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

    // Store interpolated data in refs for crosshair lookup
    // This allows us to efficiently find band values at any hovered timestamp
    const allHighData = interpolatePredictions(predictions, 'high');
    const allLowData = interpolatePredictions(predictions, 'low');

    interpolatedHighRef.current.clear();
    interpolatedLowRef.current.clear();
    interpolatedMidRef.current.clear();

    allHighData.forEach((d) => {
      interpolatedHighRef.current.set(d.time as number, d.value);
    });
    allLowData.forEach((d) => {
      interpolatedLowRef.current.set(d.time as number, d.value);
    });
    midData.forEach((d) => {
      interpolatedMidRef.current.set(d.time as number, d.value);
    });
  }, [predictions, blocks, interpolatePredictions, interval]);

  // Set visible range when interval changes or on initial load
  // ALWAYS show the most recent candles when switching intervals
  useEffect(() => {
    if (!chartRef.current) return;

    const expectedIntervalSeconds = INTERVAL_TO_SECONDS[interval] || 60;

    // Check if interval changed
    const intervalChanged = lastIntervalRef.current !== interval;

    // Check if refreshKey changed (manual refresh)
    const refreshTriggered = lastRefreshKeyRef.current !== refreshKey;
    if (refreshTriggered) {
      lastRefreshKeyRef.current = refreshKey;
      hasSetInitialRangeRef.current = false;
    }

    // If interval changed, reset everything and wait for new data
    if (intervalChanged) {
      hasSetInitialRangeRef.current = false;
      lastIntervalRef.current = interval;
      chartRef.current.timeScale().resetTimeScale();
    }

    // Need candle data to proceed (predictions optional for 15s)
    if (candles.length < 2) return;

    // CRITICAL: Verify candles match the expected interval before setting range
    const sortedCandles = [...candles].sort((a, b) => a.time - b.time);
    const recentGap = sortedCandles[sortedCandles.length - 1].time - sortedCandles[sortedCandles.length - 2].time;

    const isCorrectInterval = recentGap >= expectedIntervalSeconds * 0.5 && recentGap <= expectedIntervalSeconds * 2;
    if (!isCorrectInterval) return;

    // Skip if we've already set the range for this data (preserve user pan/zoom)
    if (hasSetInitialRangeRef.current) return;

    // Use setTimeout to ensure chart is ready
    setTimeout(() => {
      if (!chartRef.current) return;

      const mostRecentCandle = sortedCandles[sortedCandles.length - 1];
      const now = mostRecentCandle.time;

      // Detect mobile viewport
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

      // Determine how many candles to show based on interval
      // Mobile shows fewer candles for better readability
      const visibleCandleCounts: Record<string, number> = isMobile ? {
        '15s': 60,   // 15 minutes on mobile (60 x 15s = 900s = 15min)
        '1m': 90,    // 1.5 hours on mobile (90 x 1m = 5400s = 1.5h)
        '15m': 24,   // ~6 hours (fallback if no predictions)
        '1h': 24,    // ~1 day (fallback if no predictions)
      } : {
        '15s': 120,  // 30 minutes (120 x 15s = 1800s = 30min)
        '1m': 180,   // 3 hours (180 x 1m = 10800s = 3h)
        '15m': 48,   // ~12 hours (fallback if no predictions)
        '1h': 48,    // ~2 days (fallback if no predictions)
      };

      const visibleCandles = visibleCandleCounts[interval] || 60;

      // For 15s, 1m: show most recent candle in the middle-third (real-time trading view)
      // For 15m, 1h: show prediction band (desktop) or current block (mobile)
      let rangeStart: number;
      let rangeEnd: number;

      const useRealtimeView = interval === '15s' || interval === '1m';

      if (predictions.length > 0 && !useRealtimeView) {
        if (isMobile && blocks && blocks.length > 0) {
          // Mobile 15m/1h: Show current block based on which block we're in
          // Find current block (the one containing the first pending prediction or most recent)
          const nowTimestamp = Date.now() / 1000;
          let currentBlockIndex = 0;

          // Sort blocks by their first horizon time
          const sortedBlocks = [...blocks].sort((a, b) => {
            const aTime = a.horizons.length > 0 ? Math.min(...a.horizons.map(h => h.time)) : Infinity;
            const bTime = b.horizons.length > 0 ? Math.min(...b.horizons.map(h => h.time)) : Infinity;
            return aTime - bTime;
          });

          // Find which block we're currently in (has pending predictions)
          for (let i = 0; i < sortedBlocks.length; i++) {
            const block = sortedBlocks[i];
            const hasPending = block.horizons.some(h => h.status === 'pending');
            if (hasPending) {
              currentBlockIndex = i;
              break;
            }
            // If no pending found, we're past this block, check next
            if (i === sortedBlocks.length - 1) {
              currentBlockIndex = i; // Last block
            }
          }

          const currentBlock = sortedBlocks[currentBlockIndex];
          if (currentBlock && currentBlock.horizons.length > 0) {
            const blockTimes = currentBlock.horizons.map(h => h.time);
            const blockStart = Math.min(...blockTimes);
            const blockEnd = Math.max(...blockTimes);
            const blockDuration = blockEnd - blockStart;

            if (currentBlockIndex === 0) {
              // Block 1 (Outlook): Show full block start to end
              const buffer = blockDuration * 0.05;
              rangeStart = blockStart - buffer;
              rangeEnd = blockEnd + buffer;
            } else {
              // Block 2 or 3 (Continuation/Persistence): Show half of block length
              // Center on current time or first pending prediction
              const firstPending = currentBlock.horizons.find(h => h.status === 'pending');
              const centerTime = firstPending ? firstPending.time : nowTimestamp;
              const halfDuration = blockDuration / 2;
              rangeStart = centerTime - halfDuration / 2;
              rangeEnd = centerTime + halfDuration / 2;
            }
          } else {
            // Fallback: show all predictions
            const predictionTimes = predictions.map(p => p.time);
            const firstPredTime = Math.min(...predictionTimes);
            const lastPredTime = Math.max(...predictionTimes);
            const predictionDuration = lastPredTime - firstPredTime;
            const buffer = predictionDuration * 0.05;
            rangeStart = firstPredTime - buffer;
            rangeEnd = lastPredTime + buffer;
          }
        } else {
          // Desktop 15m/1h: Show prediction band with 5% buffer on both sides
          const predictionTimes = predictions.map(p => p.time);
          const firstPredTime = Math.min(...predictionTimes);
          const lastPredTime = Math.max(...predictionTimes);
          const predictionDuration = lastPredTime - firstPredTime;

          // 5% buffer on both sides of the prediction band
          const buffer = predictionDuration * 0.05;
          rangeStart = firstPredTime - buffer;
          rangeEnd = lastPredTime + buffer;
        }
      } else {
        // For 15s, 1m: show most recent candle in the middle-third
        // This gives space on the right for incoming candles
        // Put current candle at ~60% from left (40% from right)
        const historyCandles = Math.floor(visibleCandles * 0.6);  // 60% history
        const futureCandles = visibleCandles - historyCandles;     // 40% future space

        rangeStart = now - (historyCandles * expectedIntervalSeconds);
        rangeEnd = now + (futureCandles * expectedIntervalSeconds);
      }

      chartRef.current.timeScale().setVisibleRange({
        from: rangeStart as Time,
        to: rangeEnd as Time,
      });

      hasSetInitialRangeRef.current = true;
    }, 100);
  }, [candles, predictions, blocks, interval, refreshKey]);

  // Format price for display
  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className={`relative overflow-hidden ${className || ''}`}>
      <div ref={containerRef} className="w-full h-full min-w-0" />
      <ChartLegend
        ema200dValue={ema200dValue}
        visibility={indicatorVisibility}
        onToggle={toggleIndicator}
        exchangeVisibility={exchangeVisibility}
        onExchangeToggle={toggleExchange}
        exchangeData={exchangeData}
      />

      {/* EMA 200D Y-axis indicator - shows when EMA is off-screen and indicator is enabled */}
      {indicatorVisibility.ema200d && ema200dValue !== null && ema200dPosition === 'above' && (
        <div
          className="absolute right-[60px] top-3 flex items-center gap-1 bg-[#FF9800] text-black text-xs font-semibold px-2 py-1 rounded shadow-lg z-20"
          style={{ borderLeft: '3px solid #FF9800' }}
        >
          <span>▲</span>
          <span>EMA 200D</span>
          <span>${formatPrice(ema200dValue)}</span>
        </div>
      )}
      {indicatorVisibility.ema200d && ema200dValue !== null && ema200dPosition === 'below' && (
        <div
          className="absolute right-[60px] bottom-[25%] flex items-center gap-1 bg-[#FF9800] text-black text-xs font-semibold px-2 py-1 rounded shadow-lg z-20"
          style={{ borderLeft: '3px solid #FF9800' }}
        >
          <span>▼</span>
          <span>EMA 200D</span>
          <span>${formatPrice(ema200dValue)}</span>
        </div>
      )}

      {/* Prediction band Y-axis labels on crosshair hover */}
      {crosshairBandValues.high !== null && crosshairBandValues.highY !== null && (
        <div
          className="absolute right-0 px-1.5 py-0.5 text-[11px] font-medium rounded-l pointer-events-none z-30 transition-opacity duration-75"
          style={{
            top: crosshairBandValues.highY - 9,
            backgroundColor: COLORS.high,
            color: '#ffffff',
          }}
        >
          {formatPrice(crosshairBandValues.high)}
        </div>
      )}
      {crosshairBandValues.low !== null && crosshairBandValues.lowY !== null && (
        <div
          className="absolute right-0 px-1.5 py-0.5 text-[11px] font-medium rounded-l pointer-events-none z-30 transition-opacity duration-75"
          style={{
            top: crosshairBandValues.lowY - 9,
            backgroundColor: COLORS.high,
            color: '#ffffff',
          }}
        >
          {formatPrice(crosshairBandValues.low)}
        </div>
      )}
      {crosshairBandValues.mid !== null && crosshairBandValues.midY !== null && (
        <div
          className="absolute right-0 px-1.5 py-0.5 text-[11px] font-medium rounded-l pointer-events-none z-30 transition-opacity duration-75"
          style={{
            top: crosshairBandValues.midY - 9,
            backgroundColor: COLORS.mid,
            color: '#ffffff',
          }}
        >
          {formatPrice(crosshairBandValues.mid)}
        </div>
      )}
    </div>
  );
}

// Indicator toggle row component - defined outside ChartLegend to avoid recreating on each render
interface IndicatorRowProps {
  color: string;
  label: string;
  value?: string;
  isMACD?: boolean;
  isVisible: boolean;
  onToggle: () => void;
}

function IndicatorRow({
  color,
  label,
  value,
  isMACD = false,
  isVisible,
  onToggle,
}: IndicatorRowProps) {
  return (
    <button
      onClick={onToggle}
      className={`flex flex-col text-xs mb-1 w-full text-left transition-all duration-150 hover:bg-[#21262d] rounded px-1 py-0.5 -mx-1 ${
        isVisible ? '' : 'opacity-40'
      }`}
      title={`Click to ${isVisible ? 'hide' : 'show'} ${label}`}
    >
      <div className="flex items-center gap-2">
        {isMACD ? (
          <div className="flex gap-0.5">
            <div
              className="w-1.5 h-3 rounded-sm transition-opacity"
              style={{ background: COLORS.macdPositive, opacity: isVisible ? 1 : 0.3 }}
            />
            <div
              className="w-1.5 h-2 rounded-sm transition-opacity"
              style={{ background: COLORS.macdNegative, opacity: isVisible ? 1 : 0.3 }}
            />
          </div>
        ) : (
          <div
            className="w-4 h-0.5 rounded transition-opacity"
            style={{ background: color, opacity: isVisible ? 1 : 0.3 }}
          />
        )}
        <span className={`text-[#8b949e] ${!isVisible ? 'line-through' : ''}`}>
          {label}
        </span>
      </div>
      {value && isVisible && (
        <div className="pl-6 font-medium text-[11px]" style={{ color }}>
          {value}
        </div>
      )}
    </button>
  );
}

interface ChartLegendProps {
  ema200dValue: number | null;
  visibility: IndicatorVisibility;
  onToggle: (indicator: keyof IndicatorVisibility) => void;
  exchangeVisibility: ExchangeVisibility;
  onExchangeToggle: (exchange: keyof ExchangeVisibility) => void;
  exchangeData?: ExchangePriceData;
}

function ChartLegend({ ema200dValue, visibility, onToggle, exchangeVisibility, onExchangeToggle, exchangeData }: ChartLegendProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Format large numbers with commas
  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Count active indicators for badge
  const activeCount = Object.values(visibility).filter(Boolean).length;

  return (
    <>
      {/* Mobile: Collapsed compact legend (default) */}
      <button
        onClick={() => setIsExpanded(true)}
        className="md:hidden absolute top-2 left-2 bg-[#161b22]/90 border border-[#30363d] rounded-lg px-2.5 py-1.5 backdrop-blur-sm z-10 flex items-center gap-2"
      >
        {/* Prediction band colors */}
        <div className="flex gap-1">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS.block1, opacity: 0.8 }} />
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS.block2, opacity: 0.8 }} />
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS.block3, opacity: 0.8 }} />
        </div>
        <span className="text-[10px] text-[#8b949e]">Legend</span>
        {activeCount < 4 && (
          <span className="text-[9px] bg-[#30363d] text-[#8b949e] px-1 rounded">{activeCount}/4</span>
        )}
      </button>

      {/* Mobile: Expanded overlay */}
      {isExpanded && (
        <div
          className="md:hidden fixed inset-0 z-50 flex items-start justify-start pt-12 pl-2"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2.5 shadow-xl max-w-[200px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-[#8b949e] uppercase tracking-wider">Legend</span>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-[#8b949e] hover:text-[#f0f6fc] text-sm px-1"
              >
                ✕
              </button>
            </div>

            {/* Compact prediction bands */}
            <div className="flex items-center gap-3 text-[10px] mb-2 pb-2 border-b border-[#30363d]">
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS.block1 }} />
                <span className="text-[#8b949e]">Out</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS.block2 }} />
                <span className="text-[#8b949e]">Con</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS.block3 }} />
                <span className="text-[#8b949e]">Per</span>
              </div>
            </div>

            {/* Indicator toggles - compact mobile version */}
            <div className="space-y-1">
              <MobileIndicatorRow
                color={COLORS.ema200d}
                label="EMA 200D"
                isVisible={visibility.ema200d}
                onToggle={() => onToggle('ema200d')}
              />
              <MobileIndicatorRow
                color={COLORS.ema200}
                label="EMA 200"
                isVisible={visibility.ema200}
                onToggle={() => onToggle('ema200')}
              />
              <MobileIndicatorRow
                color={COLORS.ema20}
                label="EMA 20"
                isVisible={visibility.ema20}
                onToggle={() => onToggle('ema20')}
              />
              <MobileIndicatorRow
                color={COLORS.macdPositive}
                label="MACD"
                isVisible={visibility.macd}
                onToggle={() => onToggle('macd')}
              />
            </div>

            {/* Exchange toggles - mobile (only show supported exchanges) */}
            <div className="mt-2 pt-2 border-t border-[#30363d] space-y-1">
              <span className="text-[10px] text-[#8b949e] uppercase tracking-wider">Exchanges</span>
              {exchangeData?.support?.index && (
                <MobileIndicatorRow
                  color={COLORS.composite_index}
                  label="INDEX"
                  isVisible={exchangeVisibility.composite_index}
                  onToggle={() => onExchangeToggle('composite_index')}
                />
              )}
              {exchangeData?.support?.htx && (
                <MobileIndicatorRow
                  color={COLORS.htx}
                  label="HTX"
                  isVisible={exchangeVisibility.htx}
                  onToggle={() => onExchangeToggle('htx')}
                />
              )}
              {exchangeData?.support?.coinbase && (
                <MobileIndicatorRow
                  color={COLORS.coinbase}
                  label="Coinbase"
                  isVisible={exchangeVisibility.coinbase}
                  onToggle={() => onExchangeToggle('coinbase')}
                />
              )}
              {exchangeData?.support?.gemini && (
                <MobileIndicatorRow
                  color={COLORS.gemini}
                  label="Gemini"
                  isVisible={exchangeVisibility.gemini}
                  onToggle={() => onExchangeToggle('gemini')}
                />
              )}
              {exchangeData?.support?.kraken && (
                <MobileIndicatorRow
                  color={COLORS.kraken}
                  label="Kraken"
                  isVisible={exchangeVisibility.kraken}
                  onToggle={() => onExchangeToggle('kraken')}
                />
              )}
              {exchangeData?.support?.bitstamp && (
                <MobileIndicatorRow
                  color={COLORS.bitstamp}
                  label="Bitstamp"
                  isVisible={exchangeVisibility.bitstamp}
                  onToggle={() => onExchangeToggle('bitstamp')}
                />
              )}
              {exchangeData?.support?.bitfinex && (
                <MobileIndicatorRow
                  color={COLORS.bitfinex}
                  label="Bitfinex"
                  isVisible={exchangeVisibility.bitfinex}
                  onToggle={() => onExchangeToggle('bitfinex')}
                />
              )}
              {exchangeData?.support?.crypto_com_usd && (
                <MobileIndicatorRow
                  color={COLORS.crypto_com}
                  label="Crypto.com"
                  isVisible={exchangeVisibility.crypto_com_usd}
                  onToggle={() => onExchangeToggle('crypto_com_usd')}
                />
              )}
              {exchangeData?.support?.crypto_com_usdt && (
                <MobileIndicatorRow
                  color="#1199FA"
                  label="Crypto.com₮"
                  isVisible={exchangeVisibility.crypto_com_usdt}
                  onToggle={() => onExchangeToggle('crypto_com_usdt')}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Desktop: Full legend (always visible) */}
      <div className="hidden md:block absolute top-3 left-3 bg-[#161b22]/90 border border-[#30363d] rounded-lg px-3.5 py-2.5 backdrop-blur-sm z-10">
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
          Indicators <span className="text-[10px] normal-case opacity-60">(click to toggle)</span>
        </div>

        <IndicatorRow
          color={COLORS.ema200d}
          label="EMA 200 · 1D"
          value={ema200dValue !== null ? `$${formatPrice(ema200dValue)}` : undefined}
          isVisible={visibility.ema200d}
          onToggle={() => onToggle('ema200d')}
        />

        <IndicatorRow
          color={COLORS.ema200}
          label="EMA 200"
          isVisible={visibility.ema200}
          onToggle={() => onToggle('ema200')}
        />

        <IndicatorRow
          color={COLORS.ema20}
          label="EMA 20"
          isVisible={visibility.ema20}
          onToggle={() => onToggle('ema20')}
        />

        <IndicatorRow
          color=""
          label="MACD"
          isMACD
          isVisible={visibility.macd}
          onToggle={() => onToggle('macd')}
        />

        {/* Exchange Overlays Section */}
        <div className="text-[11px] text-[#8b949e] uppercase tracking-wider mt-3 mb-2">
          Exchanges <span className="text-[10px] normal-case opacity-60">(click to toggle)</span>
        </div>

        {/* Composite Index (TradingView-style INDEX) */}
        {exchangeData?.support?.index && (
          <>
            <IndicatorRow
              color={COLORS.composite_index}
              label="INDEX"
              value={exchangeVisibility.composite_index && exchangeData?.composite_index?.currentPrice
                ? `$${formatPrice(exchangeData.composite_index.currentPrice)}`
                : undefined}
              isVisible={exchangeVisibility.composite_index}
              onToggle={() => onExchangeToggle('composite_index')}
            />
            {exchangeVisibility.composite_index && exchangeData?.composite_index && (
              <div className="pl-6 text-[10px] text-[#8b949e] -mt-1 mb-1">
                {exchangeData.composite_index.connected ? (
                  <span className="text-[#3fb950]">● {exchangeData.composite_index.connectedCount}/4</span>
                ) : (
                  <span className="text-[#f85149]">● Offline</span>
                )}
                <span className="ml-2 opacity-60">Avg USD</span>
              </div>
            )}
          </>
        )}

        {/* HTX (USDT) */}
        {exchangeData?.support?.htx && (
          <>
            <IndicatorRow
              color={COLORS.htx}
              label="HTX"
              value={exchangeVisibility.htx && exchangeData?.htx?.currentPrice
                ? `$${formatPrice(exchangeData.htx.currentPrice)}`
                : undefined}
              isVisible={exchangeVisibility.htx}
              onToggle={() => onExchangeToggle('htx')}
            />
            {exchangeVisibility.htx && exchangeData?.htx && (
              <div className="pl-6 text-[10px] text-[#8b949e] -mt-1 mb-1">
                {exchangeData.htx.connected ? (
                  <span className="text-[#3fb950]">● Live</span>
                ) : (
                  <span className="text-[#f85149]">● Offline</span>
                )}
                <span className="ml-2 opacity-60">USDT</span>
              </div>
            )}
          </>
        )}

        {/* Coinbase (USD) */}
        {exchangeData?.support?.coinbase && (
          <>
            <IndicatorRow
              color={COLORS.coinbase}
              label="Coinbase"
              value={exchangeVisibility.coinbase && exchangeData?.coinbase?.currentPrice
                ? `$${formatPrice(exchangeData.coinbase.currentPrice)}`
                : undefined}
              isVisible={exchangeVisibility.coinbase}
              onToggle={() => onExchangeToggle('coinbase')}
            />
            {exchangeVisibility.coinbase && exchangeData?.coinbase && (
              <div className="pl-6 text-[10px] text-[#8b949e] -mt-1 mb-1">
                {exchangeData.coinbase.connected ? (
                  <span className="text-[#3fb950]">● Live</span>
                ) : (
                  <span className="text-[#f85149]">● Offline</span>
                )}
                <span className="ml-2 opacity-60">USD</span>
              </div>
            )}
          </>
        )}

        {/* Gemini (USD) */}
        {exchangeData?.support?.gemini && (
          <>
            <IndicatorRow
              color={COLORS.gemini}
              label="Gemini"
              value={exchangeVisibility.gemini && exchangeData?.gemini?.currentPrice
                ? `$${formatPrice(exchangeData.gemini.currentPrice)}`
                : undefined}
              isVisible={exchangeVisibility.gemini}
              onToggle={() => onExchangeToggle('gemini')}
            />
            {exchangeVisibility.gemini && exchangeData?.gemini && (
              <div className="pl-6 text-[10px] text-[#8b949e] -mt-1 mb-1">
                {exchangeData.gemini.connected ? (
                  <span className="text-[#3fb950]">● Live</span>
                ) : (
                  <span className="text-[#f85149]">● Offline</span>
                )}
                <span className="ml-2 opacity-60">USD</span>
              </div>
            )}
          </>
        )}

        {/* Kraken (USD) */}
        {exchangeData?.support?.kraken && (
          <>
            <IndicatorRow
              color={COLORS.kraken}
              label="Kraken"
              value={exchangeVisibility.kraken && exchangeData?.kraken?.currentPrice
                ? `$${formatPrice(exchangeData.kraken.currentPrice)}`
                : undefined}
              isVisible={exchangeVisibility.kraken}
              onToggle={() => onExchangeToggle('kraken')}
            />
            {exchangeVisibility.kraken && exchangeData?.kraken && (
              <div className="pl-6 text-[10px] text-[#8b949e] -mt-1 mb-1">
                {exchangeData.kraken.connected ? (
                  <span className="text-[#3fb950]">● Live</span>
                ) : (
                  <span className="text-[#f85149]">● Offline</span>
                )}
                <span className="ml-2 opacity-60">USD</span>
              </div>
            )}
          </>
        )}

        {/* Bitstamp (USD) */}
        {exchangeData?.support?.bitstamp && (
          <>
            <IndicatorRow
              color={COLORS.bitstamp}
              label="Bitstamp"
              value={exchangeVisibility.bitstamp && exchangeData?.bitstamp?.currentPrice
                ? `$${formatPrice(exchangeData.bitstamp.currentPrice)}`
                : undefined}
              isVisible={exchangeVisibility.bitstamp}
              onToggle={() => onExchangeToggle('bitstamp')}
            />
            {exchangeVisibility.bitstamp && exchangeData?.bitstamp && (
              <div className="pl-6 text-[10px] text-[#8b949e] -mt-1 mb-1">
                {exchangeData.bitstamp.connected ? (
                  <span className="text-[#3fb950]">● Live</span>
                ) : (
                  <span className="text-[#f85149]">● Offline</span>
                )}
                <span className="ml-2 opacity-60">USD</span>
              </div>
            )}
          </>
        )}

        {/* Bitfinex (USD) */}
        {exchangeData?.support?.bitfinex && (
          <>
            <IndicatorRow
              color={COLORS.bitfinex}
              label="Bitfinex"
              value={exchangeVisibility.bitfinex && exchangeData?.bitfinex?.currentPrice
                ? `$${formatPrice(exchangeData.bitfinex.currentPrice)}`
                : undefined}
              isVisible={exchangeVisibility.bitfinex}
              onToggle={() => onExchangeToggle('bitfinex')}
            />
            {exchangeVisibility.bitfinex && exchangeData?.bitfinex && (
              <div className="pl-6 text-[10px] text-[#8b949e] -mt-1 mb-1">
                {exchangeData.bitfinex.connected ? (
                  <span className="text-[#3fb950]">● Live</span>
                ) : (
                  <span className="text-[#f85149]">● Offline</span>
                )}
                <span className="ml-2 opacity-60">USD</span>
              </div>
            )}
          </>
        )}

        {/* Crypto.com USD */}
        {exchangeData?.support?.crypto_com_usd && (
          <>
            <IndicatorRow
              color={COLORS.crypto_com}
              label="Crypto.com"
              value={exchangeVisibility.crypto_com_usd && exchangeData?.crypto_com_usd?.currentPrice
                ? `$${formatPrice(exchangeData.crypto_com_usd.currentPrice)}`
                : undefined}
              isVisible={exchangeVisibility.crypto_com_usd}
              onToggle={() => onExchangeToggle('crypto_com_usd')}
            />
            {exchangeVisibility.crypto_com_usd && exchangeData?.crypto_com_usd && (
              <div className="pl-6 text-[10px] text-[#8b949e] -mt-1 mb-1">
                {exchangeData.crypto_com_usd.connected ? (
                  <span className="text-[#3fb950]">● Live</span>
                ) : (
                  <span className="text-[#f85149]">● Offline</span>
                )}
                <span className="ml-2 opacity-60">USD</span>
              </div>
            )}
          </>
        )}

        {/* Crypto.com USDT */}
        {exchangeData?.support?.crypto_com_usdt && (
          <>
            <IndicatorRow
              color="#1199FA"
              label="Crypto.com₮"
              value={exchangeVisibility.crypto_com_usdt && exchangeData?.crypto_com_usdt?.currentPrice
                ? `$${formatPrice(exchangeData.crypto_com_usdt.currentPrice)}`
                : undefined}
              isVisible={exchangeVisibility.crypto_com_usdt}
              onToggle={() => onExchangeToggle('crypto_com_usdt')}
            />
            {exchangeVisibility.crypto_com_usdt && exchangeData?.crypto_com_usdt && (
              <div className="pl-6 text-[10px] text-[#8b949e] -mt-1 mb-1">
                {exchangeData.crypto_com_usdt.connected ? (
                  <span className="text-[#3fb950]">● Live</span>
                ) : (
                  <span className="text-[#f85149]">● Offline</span>
                )}
                <span className="ml-2 opacity-60">USDT</span>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// Compact mobile indicator toggle
function MobileIndicatorRow({
  color,
  label,
  isVisible,
  onToggle,
}: {
  color: string;
  label: string;
  isVisible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center justify-between w-full text-[11px] py-1 px-1 rounded transition-all ${
        isVisible ? 'bg-[#21262d]' : 'opacity-50'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <div
          className="w-3 h-0.5 rounded"
          style={{ background: color, opacity: isVisible ? 1 : 0.3 }}
        />
        <span className={isVisible ? 'text-[#c9d1d9]' : 'text-[#8b949e] line-through'}>{label}</span>
      </div>
      <span className={`text-[9px] ${isVisible ? 'text-[#3fb950]' : 'text-[#8b949e]'}`}>
        {isVisible ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}
