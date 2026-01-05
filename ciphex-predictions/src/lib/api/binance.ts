import { Candle, Interval } from '@/types';

// Binance API endpoints - use fallbacks if main endpoint is blocked
// Global Binance has better liquidity; Binance.US is fallback for US-based servers
const BINANCE_API_ENDPOINTS = [
  'https://api.binance.com/api/v3',   // Main endpoint (best liquidity)
  'https://api1.binance.com/api/v3',  // Alternative endpoint 1
  'https://api2.binance.com/api/v3',  // Alternative endpoint 2
  'https://api3.binance.com/api/v3',  // Alternative endpoint 3
  'https://api4.binance.com/api/v3',  // Alternative endpoint 4
  'https://api.binance.us/api/v3',    // Binance US (fallback for US servers)
];
const BINANCE_MAX_LIMIT = 1000;

// Interval durations in milliseconds
const INTERVAL_MS: Record<Interval, number> = {
  '15s': 15 * 1000,
  '1m': 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
};

// Map our intervals to Binance-supported intervals
// Binance supports: 1s, 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
const BINANCE_INTERVAL_MAP: Record<Interval, string> = {
  '15s': '1s',  // Fetch 1s data and aggregate to 15s
  '1m': '1m',
  '15m': '15m',
  '1h': '1h',
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

/**
 * Aggregate smaller candles into larger timeframe candles.
 * Used to create 15s candles from 1s data since Binance doesn't support 15s directly.
 */
function aggregateCandles(candles: Candle[], targetIntervalSeconds: number): Candle[] {
  if (candles.length === 0) return [];

  const aggregated: Candle[] = [];
  let currentBucket: Candle | null = null;

  for (const candle of candles) {
    // Calculate the bucket start time for this candle
    const bucketStart = Math.floor(candle.time / targetIntervalSeconds) * targetIntervalSeconds;

    if (!currentBucket || currentBucket.time !== bucketStart) {
      // Start a new bucket
      if (currentBucket) {
        aggregated.push(currentBucket);
      }
      currentBucket = {
        time: bucketStart,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume || 0,
      };
    } else {
      // Update the current bucket
      currentBucket.high = Math.max(currentBucket.high, candle.high);
      currentBucket.low = Math.min(currentBucket.low, candle.low);
      currentBucket.close = candle.close;
      currentBucket.volume = (currentBucket.volume || 0) + (candle.volume || 0);
    }
  }

  // Don't forget the last bucket
  if (currentBucket) {
    aggregated.push(currentBucket);
  }

  return aggregated;
}

// Extended interval type for internal use (includes daily for 200-day EMA)
type ExtendedInterval = Interval | '1d';

// Fetch a single batch of klines from Binance with endpoint fallback
async function fetchKlinesBatch(
  symbol: string,
  interval: ExtendedInterval,
  limit: number,
  startTime?: number,
  endTime?: number
): Promise<Candle[]> {
  let lastError: Error | null = null;

  // Try each endpoint until one works
  for (const baseUrl of BINANCE_API_ENDPOINTS) {
    try {
      let url = `${baseUrl}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

      if (startTime) {
        url += `&startTime=${startTime}`;
      }
      if (endTime) {
        url += `&endTime=${endTime}`;
      }

      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Binance API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.map(parseKline);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Continue to next endpoint
      console.warn(`Binance endpoint ${baseUrl} failed:`, lastError.message);
    }
  }

  // All endpoints failed
  throw lastError || new Error('All Binance API endpoints failed');
}

/**
 * Fetch klines with automatic pagination for time ranges exceeding Binance's 1000 candle limit.
 * This enables fetching 24+ hours of 1m data which requires multiple API calls.
 * For intervals not natively supported by Binance (like 15s), fetches smaller intervals and aggregates.
 */
export async function fetchKlines(
  symbol: string,
  interval: Interval,
  limit: number = 500
): Promise<Candle[]> {
  // Get the Binance-supported interval for this request
  const binanceInterval = BINANCE_INTERVAL_MAP[interval];
  const needsAggregation = binanceInterval !== interval;

  // For aggregated intervals (like 15s from 1s), we need to fetch more raw candles
  // 15s = 15 x 1s candles per output candle
  const aggregationFactor = needsAggregation ? Math.round(INTERVAL_MS[interval] / 1000) : 1;
  const rawLimit = limit * aggregationFactor;

  // Helper to fetch and optionally aggregate
  const fetchAndAggregate = async (candles: Candle[]): Promise<Candle[]> => {
    if (needsAggregation) {
      return aggregateCandles(candles, INTERVAL_MS[interval] / 1000);
    }
    return candles;
  };

  // If limit is within Binance's max, single request is sufficient
  if (rawLimit <= BINANCE_MAX_LIMIT) {
    const rawCandles = await fetchKlinesBatch(symbol, binanceInterval as ExtendedInterval, rawLimit);
    return fetchAndAggregate(rawCandles);
  }

  // For larger limits, we need to paginate using startTime
  // Calculate how far back we need to go (use raw interval for fetching)
  const rawIntervalMs = needsAggregation ? 1000 : INTERVAL_MS[interval]; // 1s = 1000ms
  const now = Date.now();
  const startTime = now - (rawLimit * rawIntervalMs);

  const allCandles: Candle[] = [];
  let currentStartTime = startTime;
  let remainingRawCandles = rawLimit;

  while (remainingRawCandles > 0) {
    const batchLimit = Math.min(remainingRawCandles, BINANCE_MAX_LIMIT);

    const batch = await fetchKlinesBatch(
      symbol,
      binanceInterval as ExtendedInterval,
      batchLimit,
      currentStartTime
    );

    if (batch.length === 0) {
      // No more data available
      break;
    }

    allCandles.push(...batch);
    remainingRawCandles -= batch.length;

    // Move startTime to after the last candle we received
    const lastCandleTime = batch[batch.length - 1].time * 1000;
    currentStartTime = lastCandleTime + rawIntervalMs;

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
  const sorted = deduped.sort((a, b) => a.time - b.time);

  // Aggregate if needed (e.g., 1s -> 15s)
  return fetchAndAggregate(sorted);
}

/**
 * Calculate appropriate limit for a given interval.
 * Returns enough candles for:
 * 1. Technical indicators to stabilize (EMA 200 needs 200+ candles, MACD needs 35+)
 * 2. Sufficient visible history with EMA 200 line displayed
 * 3. More historical data for larger timeframes to ensure good indicator values
 */
export function calculateLimit(interval: Interval): number {
  const intervalMinutes: Record<Interval, number> = {
    '15s': 0.25,  // 15 seconds = 0.25 minutes
    '1m': 1,
    '15m': 15,
    '1h': 60,
  };
  const mins = intervalMinutes[interval];

  // EMA 200 warm-up period (first 200 candles don't produce EMA values)
  const emaWarmup = 200;

  // Desired candles WITH EMA visible (7 days worth for good historical context)
  const desiredVisibleWithEMA = Math.ceil((7 * 24 * 60) / mins);

  // Total candles needed: warm-up + visible history with EMA
  // Cap at reasonable limits per interval to avoid excessive API calls
  const maxLimits: Record<Interval, number> = {
    '15s': 500,   // ~2 hours of 15s candles (to avoid huge 1s data fetches)
    '1m': 1500,   // ~25 hours total, ~4.5 hours with EMA
    '15m': 1000,  // ~10 days total, ~5 days with EMA
    '1h': 1000,   // ~41 days total, ~33 days with EMA
  };

  return Math.min(emaWarmup + desiredVisibleWithEMA, maxLimits[interval]);
}

/**
 * Fetch daily candles for calculating 9-day EMA.
 * This is a separate function since daily candles aren't part of the main interval selection.
 *
 * Note: For EMA 9, we only need recent data (last ~30 days is sufficient for the EMA to stabilize).
 * We fetch the last 100 days to ensure accuracy.
 */
export async function fetchDailyKlines(symbol: string): Promise<Candle[]> {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // Fetch last 100 days - sufficient for EMA 9 to stabilize
  const now = Date.now();
  const startTime = now - (100 * ONE_DAY_MS);

  const candles = await fetchKlinesBatch(symbol, '1d', 100, startTime, undefined);

  // Sort by time ascending
  return candles.sort((a, b) => a.time - b.time);
}
