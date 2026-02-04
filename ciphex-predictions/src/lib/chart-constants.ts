// Shared chart constants extracted from PriceChart.tsx
// Used by HorizonMarkers and other chart components

// Professional color palette inspired by TradingView and Kraken
// Uses a cohesive gradient across blocks: Blue → Purple → Teal
export const CHART_COLORS = {
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
} as const;

// Map interval strings to seconds
export const INTERVAL_TO_SECONDS: Record<string, number> = {
  '15s': 15,
  '1m': 60,
  '15m': 15 * 60,
  '1h': 60 * 60,
};

// Block labels for horizon markers
export const BLOCK_LABELS = ['Outlook', 'Continuation', 'Persistence'] as const;

// Block colors array for easy indexing
export const BLOCK_COLORS = [
  CHART_COLORS.block1,
  CHART_COLORS.block2,
  CHART_COLORS.block3,
] as const;

export const BLOCK_FILL_COLORS = [
  CHART_COLORS.block1Fill,
  CHART_COLORS.block2Fill,
  CHART_COLORS.block3Fill,
] as const;
