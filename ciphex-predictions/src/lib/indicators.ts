/**
 * Technical Indicators Library
 * Provides EMA, SMA, and MACD calculations for chart overlays
 */

export interface MACDResult {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

export interface EMAResult {
  time: number;
  value: number;
}

/**
 * Calculate Exponential Moving Average (EMA)
 * EMA = (Close - Previous EMA) * multiplier + Previous EMA
 * Multiplier = 2 / (period + 1)
 */
export function calculateEMA(
  closes: { time: number; close: number }[],
  period: number
): EMAResult[] {
  if (closes.length < period) return [];

  const multiplier = 2 / (period + 1);
  const results: EMAResult[] = [];

  // Calculate initial SMA for the first EMA value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += closes[i].close;
  }
  let ema = sum / period;

  // First EMA point
  results.push({ time: closes[period - 1].time, value: ema });

  // Calculate subsequent EMA values
  for (let i = period; i < closes.length; i++) {
    ema = (closes[i].close - ema) * multiplier + ema;
    results.push({ time: closes[i].time, value: ema });
  }

  return results;
}

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(
  closes: { time: number; close: number }[],
  period: number
): EMAResult[] {
  if (closes.length < period) return [];

  const results: EMAResult[] = [];

  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += closes[j].close;
    }
    results.push({ time: closes[i].time, value: sum / period });
  }

  return results;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * Standard parameters: fastPeriod=12, slowPeriod=26, signalPeriod=9
 *
 * MACD Line = 12-period EMA - 26-period EMA
 * Signal Line = 9-period EMA of MACD Line
 * Histogram = MACD Line - Signal Line
 */
export function calculateMACD(
  closes: { time: number; close: number }[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult[] {
  if (closes.length < slowPeriod + signalPeriod) return [];

  // Calculate fast and slow EMAs
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  if (fastEMA.length === 0 || slowEMA.length === 0) return [];

  // Create a map of slow EMA values by time for easy lookup
  const slowEMAMap = new Map(slowEMA.map((e) => [e.time, e.value]));

  // Calculate MACD line (fast EMA - slow EMA)
  const macdLine: { time: number; macd: number }[] = [];
  for (const fast of fastEMA) {
    const slow = slowEMAMap.get(fast.time);
    if (slow !== undefined) {
      macdLine.push({ time: fast.time, macd: fast.value - slow });
    }
  }

  if (macdLine.length < signalPeriod) return [];

  // Calculate signal line (EMA of MACD line)
  const macdForSignal = macdLine.map((m) => ({ time: m.time, close: m.macd }));
  const signalEMA = calculateEMA(macdForSignal, signalPeriod);

  // Create a map of signal values by time
  const signalMap = new Map(signalEMA.map((s) => [s.time, s.value]));

  // Build final MACD results with histogram
  const results: MACDResult[] = [];
  for (const m of macdLine) {
    const signal = signalMap.get(m.time);
    if (signal !== undefined) {
      results.push({
        time: m.time,
        macd: m.macd,
        signal: signal,
        histogram: m.macd - signal,
      });
    }
  }

  return results;
}
