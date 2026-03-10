import { NextRequest, NextResponse } from 'next/server';
import { Interval } from '@/types';

// Databento streaming service URL (Python sidecar) — optional
const DATABENTO_SERVICE_URL = process.env.DATABENTO_SERVICE_URL || 'http://localhost:8080';

// Map our intervals to Yahoo Finance intervals and ranges
const YAHOO_INTERVAL_MAP: Record<string, { interval: string; range: string }> = {
  '15s': { interval: '1m', range: '1d' },   // Yahoo min is 1m, we'll use 1m
  '1m':  { interval: '1m', range: '1d' },
  '15m': { interval: '15m', range: '5d' },  // 5 days for MACD warm-up (needs 34+ candles)
  '1h':  { interval: '1h', range: '5d' },   // 5 days for MACD warm-up (needs 34+ candles)
};

interface YahooCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

async function fetchFromYahoo(symbol: string, interval: string): Promise<YahooCandle[]> {
  const config = YAHOO_INTERVAL_MAP[interval] || YAHOO_INTERVAL_MAP['1m'];

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol.toUpperCase())}?interval=${config.interval}&range=${config.range}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    },
    next: { revalidate: 5 },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance error: ${response.status}`);
  }

  const data = await response.json();
  const result = data?.chart?.result?.[0];

  if (!result?.timestamp || !result?.indicators?.quote?.[0]) {
    throw new Error('Invalid Yahoo Finance response structure');
  }

  const timestamps = result.timestamp;
  const quote = result.indicators.quote[0];
  const candles: YahooCandle[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    // Yahoo returns null for some fields during gaps
    if (quote.open[i] == null || quote.close[i] == null) continue;

    candles.push({
      time: timestamps[i],
      open: quote.open[i],
      high: quote.high[i] ?? quote.open[i],
      low: quote.low[i] ?? quote.open[i],
      close: quote.close[i],
      volume: quote.volume[i] ?? 0,
    });
  }

  return candles;
}

async function fetchFromDatabento(symbol: string, limit: string): Promise<YahooCandle[] | null> {
  try {
    const url = `${DATABENTO_SERVICE_URL}/api/stocks/${symbol.toUpperCase()}/candles?limit=${limit}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(3000), // 3s timeout — fail fast if sidecar is down
      next: { revalidate: 10 },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.error) return null;

    return data;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const searchParams = request.nextUrl.searchParams;
    const interval = (searchParams.get('interval') || '1m') as Interval;
    const limit = searchParams.get('limit') || '500';

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    // Try Databento sidecar first (lower latency, real-time)
    const databentoResult = await fetchFromDatabento(symbol, limit);
    if (databentoResult && databentoResult.length > 0) {
      return NextResponse.json(databentoResult);
    }

    // Fallback to Yahoo Finance
    const yahooCandles = await fetchFromYahoo(symbol, interval);
    return NextResponse.json(yahooCandles);
  } catch (error) {
    console.error('Error fetching stock prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock prices' },
      { status: 503 },
    );
  }
}
