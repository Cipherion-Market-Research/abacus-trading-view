import { Candle, Interval } from '@/types';

const BINANCE_API_URL = 'https://api.binance.com/api/v3';

export async function fetchKlines(
  symbol: string,
  interval: Interval,
  limit: number = 500
): Promise<Candle[]> {
  const url = `${BINANCE_API_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  const response = await fetch(url, {
    cache: 'no-store', // Don't cache interval-specific data to ensure fresh data on switch
  });

  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status}`);
  }

  const data = await response.json();

  return data.map((candle: (string | number)[]) => ({
    time: Math.floor(Number(candle[0]) / 1000),
    open: parseFloat(candle[1] as string),
    high: parseFloat(candle[2] as string),
    low: parseFloat(candle[3] as string),
    close: parseFloat(candle[4] as string),
    volume: parseFloat(candle[5] as string),
  }));
}

// Calculate appropriate limit for a given interval to get ~6 hours of data
// Reduced from 48h for faster loading - predictions only show ~2-3h of data anyway
export function calculateLimit(interval: Interval): number {
  const intervalMinutes: Record<Interval, number> = {
    '1m': 1,
    '15m': 15,
    '1h': 60,
    '4h': 240,
  };
  const mins = intervalMinutes[interval];
  // 6 hours = 360 minutes
  const candlesFor6h = Math.ceil((6 * 60) / mins);
  // For 1m candles, 6h = 360 candles (much faster than 1000)
  return Math.min(candlesFor6h, 500);
}
