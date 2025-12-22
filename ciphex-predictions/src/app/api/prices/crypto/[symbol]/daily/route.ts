import { NextRequest, NextResponse } from 'next/server';
import { fetchDailyKlines } from '@/lib/api/binance';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      );
    }

    const candles = await fetchDailyKlines(symbol.toUpperCase());
    return NextResponse.json(candles);
  } catch (error) {
    console.error('Error fetching daily crypto prices:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to fetch daily crypto prices', details: errorMessage },
      { status: 500 }
    );
  }
}
