import { NextRequest, NextResponse } from 'next/server';
import { fetchDailyKlines } from '@/lib/api/binance';

// Disable caching - price data should always be fresh
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Cache control headers for price data
const CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400, headers: CACHE_HEADERS }
      );
    }

    const candles = await fetchDailyKlines(symbol.toUpperCase());
    return NextResponse.json(candles, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error('Error fetching daily crypto prices:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to fetch daily crypto prices', details: errorMessage },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}
