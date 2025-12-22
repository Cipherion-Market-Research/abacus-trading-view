import { Candle, Interval } from '@/types';

const BINANCE_API_URL = 'https://api.binance.com/api/v3';
const BINANCE_MAX_LIMIT = 1000;

// Interval durations in milliseconds
const INTERVAL_MS: Record<Interval, number> = {
  '1m': 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
};

// Parse raw Binance kline data into our Candle format
function parseKline(candle: (string | number)[]): Candle {
  return {
    time: Math.floor(Number(candle[0]) / 1000),
    open: parseFloat(candle[1] as string),
    high: parseFloat(candle[2] as string),
    low: parseFloat(candle[3] as string),
    close: parseFloat(candle[4] as string),
    volume: parseFloat(candle[5] as string),
  };
}

// Extended interval type for internal use (includes daily for 200-day EMA)
type ExtendedInterval = Interval | '1d';

// Fetch a single batch of klines from Binance
async function fetchKlinesBatch(
  symbol: string,
  interval: ExtendedInterval,
  limit: number,
  startTime?: number,
  endTime?: number
): Promise<Candle[]> {
  let url = `${BINANCE_API_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  if (startTime) {
    url += `&startTime=${startTime}`;
  }
  if (endTime) {
    url += `&endTime=${endTime}`;
  }

  const response = await fetch(url, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status}`);
  }

  const data = await response.json();
  return data.map(parseKline);
}

/**
 * Fetch klines with automatic pagination for time ranges exceeding Binance's 1000 candle limit.
 * This enables fetching 24+ hours of 1m data which requires multiple API calls.
 */
export async function fetchKlines(
  symbol: string,
  interval: Interval,
  limit: number = 500
): Promise<Candle[]> {
  // If limit is within Binance's max, single request is sufficient
  if (limit <= BINANCE_MAX_LIMIT) {
    return fetchKlinesBatch(symbol, interval, limit);
  }

  // For larger limits, we need to paginate using startTime
  // Calculate how far back we need to go
  const intervalMs = INTERVAL_MS[interval];
  const now = Date.now();
  const startTime = now - (limit * intervalMs);

  const allCandles: Candle[] = [];
  let currentStartTime = startTime;
  let remainingCandles = limit;

  while (remainingCandles > 0) {
    const batchLimit = Math.min(remainingCandles, BINANCE_MAX_LIMIT);

    const batch = await fetchKlinesBatch(
      symbol,
      interval,
      batchLimit,
      currentStartTime
    );

    if (batch.length === 0) {
      // No more data available
      break;
    }

    allCandles.push(...batch);
    remainingCandles -= batch.length;

    // Move startTime to after the last candle we received
    const lastCandleTime = batch[batch.length - 1].time * 1000;
    currentStartTime = lastCandleTime + intervalMs;

    // Safety check: if we got fewer candles than requested, we've reached the end
    if (batch.length < batchLimit) {
      break;
    }
  }

  // Deduplicate by timestamp (in case of overlapping data)
  const seen = new Set<number>();
  const deduped = allCandles.filter((candle) => {
    if (seen.has(candle.time)) {
      return false;
    }
    seen.add(candle.time);
    return true;
  });

  // Sort by time ascending
  return deduped.sort((a, b) => a.time - b.time);
}

/**
 * Calculate appropriate limit for a given interval.
 * Returns enough candles for:
 * 1. Technical indicators to stabilize (EMA 200 needs 200+ candles, MACD needs 35+)
 * 2. At least 48 hours of visible history for context
 * 3. More historical data for larger timeframes to ensure good indicator values
 */
export function calculateLimit(interval: Interval): number {
  const intervalMinutes: Record<Interval, number> = {
    '1m': 1,
    '15m': 15,
    '1h': 60,
    '4h': 240,
  };
  const mins = intervalMinutes[interval];

  // Minimum candles needed for EMA 200 to be meaningful (with buffer for stabilization)
  const minForEMA200 = 250;

  // 48 hours of data for good visual context
  const candlesFor48h = Math.ceil((48 * 60) / mins);

  // Return the larger of: 48h worth of candles OR enough for EMA 200
  return Math.max(candlesFor48h, minForEMA200);
}

/**
 * Fetch daily candles for calculating 200-day EMA.
 * This is a separate function since daily candles aren't part of the main interval selection.
 *
 * IMPORTANT: EMA is recursive and needs ALL available historical data to match TradingView.
 * TradingView uses the full history from when the pair was listed (e.g., 2017 for BTCUSDT).
 * We paginate forwards from 2017 to fetch the complete history for accurate EMA calculation.
 */
export async function fetchDailyKlines(symbol: string): Promise<Candle[]> {
  const allCandles: Candle[] = [];
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // Start from 2017 (when most Binance pairs were listed) and work forwards
  // Using Jan 1, 2017 as a safe starting point
  let startTime = new Date('2017-01-01').getTime();
  const now = Date.now();

  while (startTime < now) {
    const batch = await fetchKlinesBatch(symbol, '1d', BINANCE_MAX_LIMIT, startTime, undefined);

    if (batch.length === 0) {
      break;
    }

    allCandles.push(...batch);

    // Move startTime to after the last candle we received
    const lastTime = batch[batch.length - 1].time * 1000;
    startTime = lastTime + ONE_DAY_MS;

    // If we got fewer than max, we've reached the end
    if (batch.length < BINANCE_MAX_LIMIT) {
      break;
    }

    // Safety limit: don't fetch more than 10 years of data
    if (allCandles.length > 3650) {
      break;
    }
  }

  // Deduplicate by timestamp (in case of overlapping data)
  const seen = new Set<number>();
  const deduped = allCandles.filter((candle) => {
    if (seen.has(candle.time)) {
      return false;
    }
    seen.add(candle.time);
    return true;
  });

  // Sort by time ascending
  return deduped.sort((a, b) => a.time - b.time);
}
