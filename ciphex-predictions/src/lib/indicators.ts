/**
 * Technical Indicators Library
 * Uses the 'technicalindicators' library for accurate calculations
 * matching TradingView's indicator formulas.
 */

import { EMA, SMA, MACD } from 'technicalindicators';

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
 * Legacy EMA implementation for comparison purposes.
 * Uses the standard formula: EMA = (Close - Previous EMA) * multiplier + Previous EMA
 */
function calculateEMALegacy(
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
 * Compare legacy vs library EMA calculations and log differences.
 * Call this to verify the implementations match.
 */
export function compareEMAImplementations(
  closes: { time: number; close: number }[],
  period: number
): void {
  const legacyResults = calculateEMALegacy(closes, period);
  const values = closes.map((c) => c.close);
  const libraryValues = EMA.calculate({ period, values });

  if (legacyResults.length === 0 || libraryValues.length === 0) {
    console.log(`[EMA Comparison] Not enough data for ${period}-period EMA`);
    return;
  }

  const legacyLast = legacyResults[legacyResults.length - 1].value;
  const libraryLast = libraryValues[libraryValues.length - 1];
  const difference = Math.abs(legacyLast - libraryLast);
  const percentDiff = (difference / libraryLast) * 100;

  // Debug: Show data range
  const firstCandle = closes[0];
  const lastCandle = closes[closes.length - 1];
  const firstDate = new Date(firstCandle.time * 1000).toISOString().split('T')[0];
  const lastDate = new Date(lastCandle.time * 1000).toISOString().split('T')[0];

  console.log(`[EMA ${period} Comparison]`);
  console.log(`  Data points: ${closes.length}`);
  console.log(`  Date range: ${firstDate} to ${lastDate}`);
  console.log(`  First close: $${firstCandle.close.toFixed(2)} | Last close: $${lastCandle.close.toFixed(2)}`);
  console.log(`  Legacy EMA:  ${legacyLast.toFixed(2)}`);
  console.log(`  Library EMA: ${libraryLast.toFixed(2)}`);
  console.log(`  Difference:  ${difference.toFixed(6)} (${percentDiff.toFixed(4)}%)`);

  if (difference < 0.000001) {
    console.log(`  ✓ Implementations match exactly`);
  } else if (percentDiff < 0.01) {
    console.log(`  ✓ Implementations match (negligible floating point difference)`);
  } else {
    console.log(`  ⚠ Implementations differ - investigate data or formula`);
  }
}

/**
 * Calculate Exponential Moving Average (EMA) using technicalindicators library
 * Matches TradingView's EMA indicator exactly.
 */
export function calculateEMA(
  closes: { time: number; close: number }[],
  period: number
): EMAResult[] {
  if (closes.length < period) return [];

  const values = closes.map((c) => c.close);
  const emaValues = EMA.calculate({ period, values });

  // EMA output starts at index (period - 1) of the input
  // Map back to timestamps
  const startIndex = closes.length - emaValues.length;
  return emaValues.map((value, i) => ({
    time: closes[startIndex + i].time,
    value,
  }));
}

/**
 * Calculate Simple Moving Average (SMA) using technicalindicators library
 */
export function calculateSMA(
  closes: { time: number; close: number }[],
  period: number
): EMAResult[] {
  if (closes.length < period) return [];

  const values = closes.map((c) => c.close);
  const smaValues = SMA.calculate({ period, values });

  // SMA output starts at index (period - 1) of the input
  const startIndex = closes.length - smaValues.length;
  return smaValues.map((value, i) => ({
    time: closes[startIndex + i].time,
    value,
  }));
}

/**
 * Calculate MACD (Moving Average Convergence Divergence) using technicalindicators library
 * Standard parameters: fastPeriod=12, slowPeriod=26, signalPeriod=9
 * Matches TradingView's MACD indicator exactly.
 */
export function calculateMACD(
  closes: { time: number; close: number }[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult[] {
  if (closes.length < slowPeriod + signalPeriod) return [];

  const values = closes.map((c) => c.close);
  const macdOutput = MACD.calculate({
    values,
    fastPeriod,
    slowPeriod,
    signalPeriod,
    SimpleMAOscillator: false, // Use EMA for MACD line (standard)
    SimpleMASignal: false,     // Use EMA for signal line (standard)
  });

  // MACD output starts after enough data for slowPeriod + signalPeriod
  const startIndex = closes.length - macdOutput.length;
  const results: MACDResult[] = [];

  // Map each MACD output to its corresponding timestamp
  // Must iterate with original index to maintain correct timestamp alignment
  for (let i = 0; i < macdOutput.length; i++) {
    const m = macdOutput[i];
    if (m.MACD !== undefined && m.signal !== undefined && m.histogram !== undefined) {
      results.push({
        time: closes[startIndex + i].time,
        macd: m.MACD,
        signal: m.signal,
        histogram: m.histogram,
      });
    }
  }

  return results;
}
