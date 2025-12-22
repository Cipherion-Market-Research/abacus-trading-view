import { NextRequest, NextResponse } from 'next/server';
import { fetchKlines, calculateLimit } from '@/lib/api/binance';
import { Interval } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const searchParams = request.nextUrl.searchParams;
    const interval = (searchParams.get('interval') || '1h') as Interval;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : calculateLimit(interval);

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      );
    }

    const candles = await fetchKlines(symbol.toUpperCase(), interval, limit);
    return NextResponse.json(candles);
  } catch (error) {
    console.error('Error fetching crypto prices:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to fetch crypto prices', details: errorMessage },
      { status: 500 }
    );
  }
}
