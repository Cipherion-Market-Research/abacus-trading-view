import { Candle, Interval } from '@/types';

const BINANCE_API_URL = 'https://api.binance.com/api/v3';

export async function fetchKlines(
  symbol: string,
  interval: Interval,
  limit: number = 500
): Promise<Candle[]> {
  const url = `${BINANCE_API_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  const response = await fetch(url, {
    next: { revalidate: 60 }, // Cache for 1 minute
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

// Calculate appropriate limit for a given interval to get ~48 hours of data
export function calculateLimit(interval: Interval): number {
  const intervalMinutes: Record<Interval, number> = {
    '1m': 1,
    '15m': 15,
    '1h': 60,
    '4h': 240,
  };
  const mins = intervalMinutes[interval];
  const candlesFor48h = Math.ceil((48 * 60) / mins);
  // For 1m candles, 48h = 2880 candles, but limit to 1000 (Binance max)
  return Math.min(candlesFor48h, 1000);
}
