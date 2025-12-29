import { NextRequest, NextResponse } from 'next/server';

// Disable caching - price data should always be fresh
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Bitfinex REST API
const BITFINEX_API_URL = 'https://api-pub.bitfinex.com/v2';

// Cache control headers
const CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
};

// Bitfinex timeframe mapping
const BITFINEX_TIMEFRAME: Record<string, string> = {
  '15s': '1m',    // Bitfinex minimum is 1m
  '1m': '1m',
  '15m': '15m',
  '1h': '1h',
};

/**
 * Server-side proxy for Bitfinex candle data
 * Bypasses CORS restrictions by fetching from server
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const searchParams = request.nextUrl.searchParams;
    const interval = searchParams.get('interval') || '15m';
    const limit = searchParams.get('limit') || '300';

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400, headers: CACHE_HEADERS }
      );
    }

    // Build Bitfinex symbol format (BTC -> tBTCUSD)
    const bitfinexSymbol = `t${symbol.toUpperCase()}USD`;
    const timeframe = BITFINEX_TIMEFRAME[interval] || '15m';

    // Fetch from Bitfinex REST API
    const response = await fetch(
      `${BITFINEX_API_URL}/candles/trade:${timeframe}:${bitfinexSymbol}/hist?limit=${limit}&sort=1`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Bitfinex API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Bitfinex API error: ${response.status}` },
        { status: response.status, headers: CACHE_HEADERS }
      );
    }

    const data = await response.json();

    // Bitfinex candle format: [MTS, OPEN, CLOSE, HIGH, LOW, VOLUME]
    // Transform to our format: { time, price }
    if (Array.isArray(data)) {
      const candles = data.map((candle: number[]) => ({
        time: Math.floor(candle[0] / 1000), // Convert ms to seconds
        price: Number(candle[2]), // Close price
      }));

      return NextResponse.json(candles, { headers: CACHE_HEADERS });
    }

    return NextResponse.json([], { headers: CACHE_HEADERS });
  } catch (error) {
    console.error('Error fetching Bitfinex prices:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to fetch Bitfinex prices', details: errorMessage },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}
