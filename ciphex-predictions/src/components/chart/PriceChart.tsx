'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

// localStorage key for persisting MACD panel height
const MACD_PANEL_HEIGHT_KEY = 'ciphex-macd-panel-height';
const DEFAULT_MACD_PANEL_HEIGHT = 20; // 20% of container height

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
  ema9: '#FF9800',      // Orange for 9-period EMA
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
  ema9: boolean;     // EMA 9
  ema200: boolean;   // EMA 200
  ema20: boolean;    // EMA 20
  macd: boolean;     // MACD histogram
}

// Default indicator visibility
const DEFAULT_INDICATOR_VISIBILITY: IndicatorVisibility = {
  ema9: true,
  ema200: false,
  ema20: true,
  macd: true,
};

// localStorage key for persisting preferences
const INDICATOR_PREFS_KEY = 'ciphex-indicator-visibility';
const EXCHANGE_PREFS_KEY = 'ciphex-exchange-visibility';
const LEGEND_SECTIONS_KEY = 'ciphex-legend-sections';

// Legend section collapse state
interface LegendSectionState {
  predictions: boolean; // true = expanded, false = collapsed
  technicals: boolean;  // true = expanded, false = collapsed
  exchanges: boolean;   // true = expanded, false = collapsed
}

// Default: predictions expanded, others collapsed to minimize legend height
const DEFAULT_LEGEND_SECTIONS: LegendSectionState = {
  predictions: true,
  technicals: false,
  exchanges: false,
};

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
  predictions: Horizon[];
  blocks?: Block[];
  className?: string;
  assetType?: 'crypto' | 'dex' | 'stock';
  interval?: '15s' | '1m' | '15m' | '1h';
  refreshKey?: number;  // Increments to trigger visible range recalculation
  exchangeData?: ExchangePriceData;  // Exchange price overlays
  chartContextKey?: string;  // Unique key for asset+interval+effectiveSource context
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


export function PriceChart({ candles, predictions, blocks, className, assetType, interval = '1m', refreshKey = 0, exchangeData, chartContextKey }: PriceChartProps) {
  // Main chart container and refs
  const containerRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const ema9SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);     // 9-period EMA
  const ema200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);   // 200-period EMA (current timeframe)
  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);    // 20-period EMA (current timeframe)

  // MACD chart container and refs (separate pane)
  const macdContainerRef = useRef<HTMLDivElement>(null);
  const macdChartRef = useRef<IChartApi | null>(null);
  const macdSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // State for resizable MACD panel
  const [macdPanelHeight, setMacdPanelHeight] = useState(DEFAULT_MACD_PANEL_HEIGHT);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const dividerDragStartY = useRef<number>(0);
  const dividerDragStartHeight = useRef<number>(0);

  // Refs to prevent infinite sync loops between charts
  const isSyncingTimeScale = useRef(false);
  const isSyncingCrosshair = useRef(false);
  // Flag to temporarily disable sync during initial range setup
  const isSettingInitialRange = useRef(false);
  // Flag to disable sync during data updates (prevents range reset on exchange toggle)
  const isUpdatingData = useRef(false);
  // Timeout ref for clearing isUpdatingData flag (prevents race conditions)
  const updateDataTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved MACD panel height from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(MACD_PANEL_HEIGHT_KEY);
    if (saved) {
      const height = parseFloat(saved);
      if (!isNaN(height) && height >= 10 && height <= 50) {
        setMacdPanelHeight(height);
      }
    }
  }, []);

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
  // Track pending timeout for visible range setting (to cancel stale ones)
  const visibleRangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Track the last chart context key to detect asset/interval/source changes
  const lastChartContextKeyRef = useRef<string | undefined>(undefined);

  // Initialize main price chart
  useEffect(() => {
    if (!mainContainerRef.current) return;

    const chart = createChart(mainContainerRef.current, {
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
          bottom: 0.05, // 5% margin at bottom (MACD now in separate pane)
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
      width: mainContainerRef.current.clientWidth,
      height: mainContainerRef.current.clientHeight,
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

    // 9-period EMA line overlay
    const ema9Series = chart.addLineSeries({
      color: COLORS.ema9,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'EMA 9',
    });

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
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'EMA 200',
    });

    // Exchange price overlay lines
    // Composite Index first (gold)
    const compositeIndexSeries = chart.addLineSeries({
      color: COLORS.composite_index,
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'TV:Index',
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
    ema9SeriesRef.current = ema9Series;
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

    // Handle resize for main chart
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    resizeObserver.observe(mainContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Chart should only be created once on mount. Interval changes are handled by a separate effect.
  }, []);

  // Initialize MACD chart (separate pane with its own y-axis)
  useEffect(() => {
    if (!macdContainerRef.current || !indicatorVisibility.macd) return;

    const macdChart = createChart(macdContainerRef.current, {
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
          top: 0.1,    // 10% margin at top
          bottom: 0.1, // 10% margin at bottom
        },
      },
      timeScale: {
        borderColor: '#30363d',
        timeVisible: false,  // Hide time labels (main chart shows them)
        secondsVisible: false,
        rightOffset: 5,
        fixLeftEdge: false,
        fixRightEdge: false,
        shiftVisibleRangeOnNewBar: false,
        lockVisibleTimeRangeOnResize: true,
        barSpacing: INTERVAL_BAR_SPACING[interval]?.barSpacing || 12,
        minBarSpacing: INTERVAL_BAR_SPACING[interval]?.minBarSpacing || 1,
      },
      width: macdContainerRef.current.clientWidth,
      height: macdContainerRef.current.clientHeight,
    });

    // MACD histogram series with its own y-axis
    const macdSeries = macdChart.addHistogramSeries({
      priceFormat: {
        type: 'price',
        precision: 6,
        minMove: 0.000001,
      },
    });

    macdChartRef.current = macdChart;
    macdSeriesRef.current = macdSeries;

    // Handle resize for MACD chart
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        macdChart.applyOptions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    resizeObserver.observe(macdContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      macdChart.remove();
      macdChartRef.current = null;
      macdSeriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- MACD chart recreated when visibility changes
  }, [indicatorVisibility.macd]);

  // Sync time scales between main chart and MACD chart
  // ONE-WAY SYNC: Main chart controls, MACD follows
  // Uses LOGICAL range sync now that MACD has placeholder points at prediction timestamps
  useEffect(() => {
    if (!chartRef.current || !macdChartRef.current || !indicatorVisibility.macd) return;

    const mainChart = chartRef.current;
    const macdChart = macdChartRef.current;

    // Sync main chart time scale changes to MACD chart (main → MACD)
    // Using logical range (bar indices) - works because both charts now have
    // data points at the same timestamps (MACD has invisible placeholders for future)
    const handleMainTimeRangeChange = (logicalRange: { from: number; to: number } | null) => {
      // Skip sync during initial setup or data updates (prevents range reset on exchange toggle)
      if (isSyncingTimeScale.current || isSettingInitialRange.current || isUpdatingData.current || !logicalRange) return;
      isSyncingTimeScale.current = true;
      try {
        macdChart.timeScale().setVisibleLogicalRange(logicalRange);
      } catch {
        // Chart may have been removed
      }
      isSyncingTimeScale.current = false;
    };

    mainChart.timeScale().subscribeVisibleLogicalRangeChange(handleMainTimeRangeChange);

    return () => {
      mainChart.timeScale().unsubscribeVisibleLogicalRangeChange(handleMainTimeRangeChange);
    };
  }, [indicatorVisibility.macd]);

  // Sync crosshair between main chart and MACD chart
  useEffect(() => {
    if (!chartRef.current || !macdChartRef.current || !indicatorVisibility.macd) return;

    const mainChart = chartRef.current;
    const macdChart = macdChartRef.current;

    // Sync main chart crosshair to MACD chart
    const handleMainCrosshairMove = (param: MouseEventParams<Time>) => {
      if (isSyncingCrosshair.current || !macdSeriesRef.current || !candlestickSeriesRef.current) return;

      // Only sync if hovering over actual candle data to prevent feedback loops in void area
      const candleData = param.seriesData?.get(candlestickSeriesRef.current);
      if (!candleData) {
        // In void area - clear MACD crosshair without syncing
        try {
          macdChart.clearCrosshairPosition();
        } catch {
          // Chart may not be ready
        }
        return;
      }

      isSyncingCrosshair.current = true;

      try {
        if (param.time) {
          macdChart.setCrosshairPosition(0, param.time, macdSeriesRef.current);
        } else {
          macdChart.clearCrosshairPosition();
        }
      } catch {
        // Series may not have data yet
      }

      isSyncingCrosshair.current = false;
    };

    // Sync MACD chart crosshair to main chart
    const handleMacdCrosshairMove = (param: MouseEventParams<Time>) => {
      if (isSyncingCrosshair.current || !candlestickSeriesRef.current) return;
      isSyncingCrosshair.current = true;

      try {
        if (param.time) {
          mainChart.setCrosshairPosition(0, param.time, candlestickSeriesRef.current);
        } else {
          mainChart.clearCrosshairPosition();
        }
      } catch {
        // Series may not have data yet
      }

      isSyncingCrosshair.current = false;
    };

    mainChart.subscribeCrosshairMove(handleMainCrosshairMove);
    macdChart.subscribeCrosshairMove(handleMacdCrosshairMove);

    return () => {
      mainChart.unsubscribeCrosshairMove(handleMainCrosshairMove);
      macdChart.unsubscribeCrosshairMove(handleMacdCrosshairMove);
    };
  }, [indicatorVisibility.macd]);

  // Update timeScale settings when interval changes (for proper bar spacing)
  useEffect(() => {
    const spacing = INTERVAL_BAR_SPACING[interval] || { barSpacing: 12, minBarSpacing: 1 };

    if (chartRef.current) {
      chartRef.current.applyOptions({
        timeScale: {
          barSpacing: spacing.barSpacing,
          minBarSpacing: spacing.minBarSpacing,
        },
      });
    }

    if (macdChartRef.current) {
      macdChartRef.current.applyOptions({
        timeScale: {
          barSpacing: spacing.barSpacing,
          minBarSpacing: spacing.minBarSpacing,
        },
      });
    }
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

      // Convert prices to Y coordinates (may fail if series has no data yet)
      try {
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
      } catch {
        // Series may not be ready yet
      }
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
    };
  }, []);

  // Update candle data - only show candles within the prediction time window
  // For stocks, additionally filter to RTH (Regular Trading Hours) only
  useEffect(() => {
    if (!candlestickSeriesRef.current || !ema9SeriesRef.current || !ema20SeriesRef.current || !ema200SeriesRef.current) return;

    // Clear any pending timeout and disable time scale sync during data updates
    if (updateDataTimeoutRef.current) {
      clearTimeout(updateDataTimeoutRef.current);
      updateDataTimeoutRef.current = null;
    }
    isUpdatingData.current = true;

    // Clear chart when candles array is empty (e.g., during interval switch)
    if (candles.length === 0) {
      candlestickSeriesRef.current.setData([]);
      if (macdSeriesRef.current) macdSeriesRef.current.setData([]);
      ema9SeriesRef.current.setData([]);
      ema20SeriesRef.current.setData([]);
      ema200SeriesRef.current.setData([]);
      isUpdatingData.current = false;
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

    // MACD histogram - show/hide based on visibility (separate chart)
    if (indicatorVisibility.macd && macdSeriesRef.current) {
      const macdData = calculateMACD(closesForIndicators, 12, 26, 9);

      // Create a Map of MACD data by timestamp for quick lookup
      const macdByTime = new Map(macdData.map(m => [m.time, m]));

      // Build MACD histogram data with placeholders at ALL candle + prediction timestamps
      // This ensures bar indices match between main chart and MACD chart
      const macdHistogramData: HistogramData<Time>[] = [];

      // Add placeholders for candle timestamps (including warm-up period)
      for (const candle of sortedAllCandles) {
        const macdPoint = macdByTime.get(candle.time);
        if (macdPoint) {
          // Real MACD data
          macdHistogramData.push({
            time: candle.time as Time,
            value: macdPoint.histogram,
            color: macdPoint.histogram >= 0 ? COLORS.macdPositive : COLORS.macdNegative,
          });
        } else {
          // Warm-up period - invisible placeholder
          macdHistogramData.push({
            time: candle.time as Time,
            value: 0,
            color: 'transparent',
          });
        }
      }

      // Add placeholders for prediction timestamps (future)
      if (predictions.length > 0) {
        const lastCandleTime = sortedAllCandles.length > 0
          ? sortedAllCandles[sortedAllCandles.length - 1].time
          : 0;

        for (const pred of predictions) {
          if (pred.time > lastCandleTime) {
            macdHistogramData.push({
              time: pred.time as Time,
              value: 0,
              color: 'transparent',
            });
          }
        }
      }

      macdSeriesRef.current.setData(macdHistogramData);
    } else if (macdSeriesRef.current) {
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

    // EMA 9 - show/hide based on visibility
    if (indicatorVisibility.ema9) {
      const ema9Data = calculateEMA(closesForIndicators, 9);
      const ema9LineData: LineData<Time>[] = ema9Data.map((e) => ({
        time: e.time as Time,
        value: e.value,
      }));
      ema9SeriesRef.current.setData(ema9LineData);
    } else {
      ema9SeriesRef.current.setData([]);
    }

    // Re-enable time scale sync after chart events have fully settled
    // Use setTimeout with delay instead of requestAnimationFrame because chart events
    // can fire asynchronously well after the render frame completes
    updateDataTimeoutRef.current = setTimeout(() => {
      isUpdatingData.current = false;
      updateDataTimeoutRef.current = null;
    }, 150);
  }, [candles, predictions, assetType, interval, indicatorVisibility]);

  // Update exchange overlay data
  // Helper to ensure price is always a number (some APIs return strings)
  const ensureNumber = (val: number | string): number => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(num) ? 0 : num;
  };

  useEffect(() => {
    // Clear any pending timeout and disable time scale sync during data updates
    if (updateDataTimeoutRef.current) {
      clearTimeout(updateDataTimeoutRef.current);
      updateDataTimeoutRef.current = null;
    }
    isUpdatingData.current = true;

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

    // Composite Index overlay (TradingView-style TV:INDEX)
    // CRITICAL: Only plot when ALL 4 exchanges are live to prevent chart distortion
    // from partial data with large spreads during connection initialization
    updateExchangeSeries(
      compositeIndexSeriesRef,
      !!(support?.index && exchangeVisibility.composite_index && exchangeData?.composite_index?.connected),
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

    // Re-enable time scale sync after chart events have fully settled
    // Use setTimeout with delay instead of requestAnimationFrame because chart events
    // can fire asynchronously well after the render frame completes
    updateDataTimeoutRef.current = setTimeout(() => {
      isUpdatingData.current = false;
      updateDataTimeoutRef.current = null;
    }, 150);
  }, [exchangeData, exchangeVisibility]);

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
    // Helper to safely cancel pending timeout
    const cancelPendingTimeout = () => {
      if (visibleRangeTimeoutRef.current) {
        clearTimeout(visibleRangeTimeoutRef.current);
        visibleRangeTimeoutRef.current = null;
      }
    };

    if (!chartRef.current) {
      cancelPendingTimeout();  // Cancel on early return
      return;
    }

    const expectedIntervalSeconds = INTERVAL_TO_SECONDS[interval] || 60;
    const useRealtimeView = interval === '15s' || interval === '1m';

    // Detect chart context change (asset, interval, or effective data source)
    const contextChanged = chartContextKey !== undefined &&
                           lastChartContextKeyRef.current !== undefined &&
                           lastChartContextKeyRef.current !== chartContextKey;

    if (contextChanged) {
      // Reset state for new context
      hasSetInitialRangeRef.current = false;
      chartRef.current.timeScale().resetTimeScale();
      // Re-enable Y-axis auto-scale (user may have manually scaled on previous asset)
      chartRef.current.priceScale('right').applyOptions({ autoScale: true });
      // Also reset MACD panel's Y-scale if present
      if (macdChartRef.current) {
        macdChartRef.current.priceScale('right').applyOptions({ autoScale: true });
      }
      cancelPendingTimeout();
      lastChartContextKeyRef.current = chartContextKey;
      // CRITICAL: Return immediately to avoid setting range with stale data
      return;
    }

    // Update ref on first render
    if (lastChartContextKeyRef.current === undefined) {
      lastChartContextKeyRef.current = chartContextKey;
    }

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
      cancelPendingTimeout();
    }

    // Need candle data to proceed
    if (candles.length < 2) {
      cancelPendingTimeout();  // Cancel on early return
      return;
    }

    // CRITICAL: Verify candles match the expected interval before setting range
    const sortedCandles = [...candles].sort((a, b) => a.time - b.time);
    const recentGap = sortedCandles[sortedCandles.length - 1].time - sortedCandles[sortedCandles.length - 2].time;

    const isCorrectInterval = recentGap >= expectedIntervalSeconds * 0.5 && recentGap <= expectedIntervalSeconds * 2;
    if (!isCorrectInterval) {
      cancelPendingTimeout();  // Cancel on early return
      return;
    }

    // Skip if we've already set the range for this data (preserve user pan/zoom)
    if (hasSetInitialRangeRef.current) {
      cancelPendingTimeout();  // Cancel on early return
      return;
    }

    // For 15m/1h, WAIT until predictions are loaded before setting range
    // This prevents the race condition where candle-based range is set first
    if (!useRealtimeView && predictions.length === 0) {
      cancelPendingTimeout();  // Cancel on early return
      return; // Don't set any range yet, wait for predictions
    }

    // Cancel any pending timeout before scheduling a new one
    cancelPendingTimeout();

    // Use setTimeout to ensure chart and data are ready
    // Using 300ms to allow chart to stabilize after all data loading completes
    visibleRangeTimeoutRef.current = setTimeout(() => {
      // Double-check the flag inside timeout (another effect may have set it)
      if (!chartRef.current || hasSetInitialRangeRef.current) return;

      // Also ensure we still have the data we expect
      if (!useRealtimeView && predictions.length === 0) return;

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

      // Note: useRealtimeView is already defined above in outer scope
      if (!useRealtimeView && predictions.length > 0) {
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

      try {
        // Temporarily disable sync during initial range setup
        isSettingInitialRange.current = true;

        // Set visible range on main chart
        chartRef.current.timeScale().setVisibleRange({
          from: rangeStart as Time,
          to: rangeEnd as Time,
        });

        // Also sync to MACD chart if it exists (using logical range for proper alignment)
        if (macdChartRef.current && indicatorVisibility.macd) {
          try {
            const logicalRange = chartRef.current.timeScale().getVisibleLogicalRange();
            if (logicalRange) {
              macdChartRef.current.timeScale().setVisibleLogicalRange(logicalRange);
            }
          } catch {
            // MACD chart may not be ready
          }
        }

        isSettingInitialRange.current = false;
      } catch {
        isSettingInitialRange.current = false;
        // Chart may not be ready yet
        return;
      }

      // Mark range as set - we only get here if we have the required data
      // (realtime view always has candles, prediction view waits for predictions)
      hasSetInitialRangeRef.current = true;
    }, 300);

    // Cleanup: cancel timeout on unmount or when effect re-runs
    return () => {
      if (visibleRangeTimeoutRef.current) {
        clearTimeout(visibleRangeTimeoutRef.current);
        visibleRangeTimeoutRef.current = null;
      }
    };
  }, [candles, predictions, blocks, interval, refreshKey, indicatorVisibility.macd, chartContextKey]);

  // Format price for display
  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Divider drag handlers for resizing MACD panel
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingDivider(true);
    dividerDragStartY.current = e.clientY;
    dividerDragStartHeight.current = macdPanelHeight;
  }, [macdPanelHeight]);

  // Handle divider drag globally
  useEffect(() => {
    if (!isDraggingDivider) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerHeight = containerRef.current.clientHeight;
      const deltaY = dividerDragStartY.current - e.clientY;
      const deltaPercent = (deltaY / containerHeight) * 100;
      const newHeight = Math.min(50, Math.max(10, dividerDragStartHeight.current + deltaPercent));
      setMacdPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDraggingDivider(false);
      // Save to localStorage
      localStorage.setItem(MACD_PANEL_HEIGHT_KEY, macdPanelHeight.toString());
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDivider, macdPanelHeight]);

  // Calculate main chart height based on MACD visibility
  const mainChartHeight = indicatorVisibility.macd ? `${100 - macdPanelHeight}%` : '100%';
  const macdChartHeight = indicatorVisibility.macd ? `${macdPanelHeight}%` : '0%';

  return (
    <div ref={containerRef} className={`relative overflow-hidden flex flex-col ${className || ''}`}>
      {/* Main price chart pane */}
      <div className="relative" style={{ height: mainChartHeight, minHeight: 0 }}>
        <div ref={mainContainerRef} className="w-full h-full min-w-0" />
        <ChartLegend
          visibility={indicatorVisibility}
          onToggle={toggleIndicator}
          exchangeVisibility={exchangeVisibility}
          onExchangeToggle={toggleExchange}
          exchangeData={exchangeData}
        />

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
            className="absolute right-0 px-1.5 py-0.5 text-[11px] font-medium rounded-l pointer-events-none z-30 transition-opacity duration-75 flex items-center gap-1.5"
            style={{
              top: crosshairBandValues.midY - 9,
              backgroundColor: COLORS.mid,
              color: '#ffffff',
            }}
          >
            <span className="opacity-80 text-[10px]">Peak HM Avg</span>
            <span>{formatPrice(crosshairBandValues.mid)}</span>
          </div>
        )}
      </div>

      {/* Draggable divider between main chart and MACD */}
      {indicatorVisibility.macd && (
        <div
          className={`h-1 bg-[#30363d] cursor-ns-resize hover:bg-[#3b82f6] transition-colors relative flex-shrink-0 ${
            isDraggingDivider ? 'bg-[#3b82f6]' : ''
          }`}
          onMouseDown={handleDividerMouseDown}
        >
          {/* Divider grip indicator */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
            <div className="w-8 h-0.5 bg-[#8b949e] rounded opacity-50" />
          </div>
          {/* MACD label */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-[#8b949e] font-medium uppercase tracking-wider">
            MACD
          </div>
        </div>
      )}

      {/* MACD chart pane */}
      {indicatorVisibility.macd && (
        <div className="relative flex-shrink-0" style={{ height: macdChartHeight, minHeight: 0 }}>
          <div ref={macdContainerRef} className="w-full h-full min-w-0" />
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
  visibility: IndicatorVisibility;
  onToggle: (indicator: keyof IndicatorVisibility) => void;
  exchangeVisibility: ExchangeVisibility;
  onExchangeToggle: (exchange: keyof ExchangeVisibility) => void;
  exchangeData?: ExchangePriceData;
}

function ChartLegend({ visibility, onToggle, exchangeVisibility, onExchangeToggle, exchangeData }: ChartLegendProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Section collapse state with localStorage persistence
  const [sectionState, setSectionState] = useState<LegendSectionState>(() => {
    // Initialize from localStorage if available (only runs on client)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LEGEND_SECTIONS_KEY);
      if (saved) {
        try {
          return JSON.parse(saved) as LegendSectionState;
        } catch {
          // Invalid JSON, use defaults
        }
      }
    }
    return DEFAULT_LEGEND_SECTIONS;
  });
  const hasMountedRef = useRef(false);

  // Track mount state and save section state to localStorage when it changes
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    localStorage.setItem(LEGEND_SECTIONS_KEY, JSON.stringify(sectionState));
  }, [sectionState]);

  // Toggle section expand/collapse
  const toggleSection = (section: keyof LegendSectionState) => {
    setSectionState(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Format large numbers with commas
  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Count active indicators for badge
  const activeCount = Object.values(visibility).filter(Boolean).length;

  // Count active exchanges for badge
  const activeExchangeCount = Object.entries(exchangeVisibility).filter(
    ([key, value]) => value && exchangeData?.support?.[key as keyof ExchangeSupport]
  ).length;

  // Count total available exchanges
  const totalExchangeCount = exchangeData?.support
    ? Object.values(exchangeData.support).filter(Boolean).length
    : 0;

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
                color={COLORS.ema9}
                label="EMA 9"
                isVisible={visibility.ema9}
                onToggle={() => onToggle('ema9')}
              />
              <MobileIndicatorRow
                color={COLORS.ema20}
                label="EMA 20"
                isVisible={visibility.ema20}
                onToggle={() => onToggle('ema20')}
              />
              <MobileIndicatorRow
                color={COLORS.ema200}
                label="EMA 200"
                isVisible={visibility.ema200}
                onToggle={() => onToggle('ema200')}
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
                  label="TV:Composite Index"
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
        {/* Collapsible Prediction Bands Section */}
        <button
          onClick={() => toggleSection('predictions')}
          className="w-full flex items-center justify-between mb-1 group cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#8b949e] uppercase tracking-wider group-hover:text-[#c9d1d9] transition-colors">
              Prediction Bands
            </span>
            {!sectionState.predictions && (
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ background: COLORS.block1 }} />
                <div className="w-2 h-2 rounded-sm" style={{ background: COLORS.block2 }} />
                <div className="w-2 h-2 rounded-sm" style={{ background: COLORS.block3 }} />
              </div>
            )}
          </div>
          <svg
            className={`w-3.5 h-3.5 text-[#8b949e] group-hover:text-[#c9d1d9] transition-all duration-200 ${
              sectionState.predictions ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Prediction Bands content - collapsible */}
        <div
          className={`overflow-hidden transition-all duration-200 ease-out ${
            sectionState.predictions ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
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

        {/* Collapsible Indicators Section */}
        <button
          onClick={() => toggleSection('technicals')}
          className="w-full flex items-center justify-between mt-3 mb-1 group cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#8b949e] uppercase tracking-wider group-hover:text-[#c9d1d9] transition-colors">
              Indicators
            </span>
            {!sectionState.technicals && (
              <span className="text-[9px] bg-[#30363d] text-[#8b949e] px-1.5 py-0.5 rounded">
                {activeCount}/4
              </span>
            )}
          </div>
          <svg
            className={`w-3.5 h-3.5 text-[#8b949e] group-hover:text-[#c9d1d9] transition-all duration-200 ${
              sectionState.technicals ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Indicators content - collapsible */}
        <div
          className={`overflow-hidden transition-all duration-200 ease-out ${
            sectionState.technicals ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="text-[10px] text-[#8b949e] opacity-60 mb-1">(click to toggle)</div>
          <IndicatorRow
            color={COLORS.ema9}
            label="EMA 9"
            isVisible={visibility.ema9}
            onToggle={() => onToggle('ema9')}
          />

          <IndicatorRow
            color={COLORS.ema20}
            label="EMA 20"
            isVisible={visibility.ema20}
            onToggle={() => onToggle('ema20')}
          />

          <IndicatorRow
            color={COLORS.ema200}
            label="EMA 200"
            isVisible={visibility.ema200}
            onToggle={() => onToggle('ema200')}
          />

          <IndicatorRow
            color=""
            label="MACD"
            isMACD
            isVisible={visibility.macd}
            onToggle={() => onToggle('macd')}
          />
        </div>

        {/* Collapsible Exchanges Section */}
        <button
          onClick={() => toggleSection('exchanges')}
          className="w-full flex items-center justify-between mt-3 mb-1 group cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#8b949e] uppercase tracking-wider group-hover:text-[#c9d1d9] transition-colors">
              Exchanges
            </span>
            {!sectionState.exchanges && totalExchangeCount > 0 && (
              <span className="text-[9px] bg-[#30363d] text-[#8b949e] px-1.5 py-0.5 rounded">
                {activeExchangeCount}/{totalExchangeCount}
              </span>
            )}
          </div>
          <svg
            className={`w-3.5 h-3.5 text-[#8b949e] group-hover:text-[#c9d1d9] transition-all duration-200 ${
              sectionState.exchanges ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Exchanges content - collapsible */}
        <div
          className={`overflow-hidden transition-all duration-200 ease-out ${
            sectionState.exchanges ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="text-[10px] text-[#8b949e] opacity-60 mb-1">(click to toggle)</div>

        {/* Composite Index (TradingView-style TV:INDEX) */}
        {exchangeData?.support?.index && (
          <>
            <IndicatorRow
              color={COLORS.composite_index}
              label="TV:Composite Index"
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
