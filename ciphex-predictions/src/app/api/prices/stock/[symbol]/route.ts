import { NextRequest, NextResponse } from 'next/server';
import { Interval } from '@/types';

// Databento streaming service URL (Python sidecar)
const DATABENTO_SERVICE_URL = process.env.DATABENTO_SERVICE_URL || 'http://localhost:8080';

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
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      );
    }

    // Proxy to Databento streaming service
    const url = `${DATABENTO_SERVICE_URL}/api/stocks/${symbol.toUpperCase()}/candles?limit=${limit}`;

    const response = await fetch(url, {
      next: { revalidate: 10 }, // Cache for 10 seconds
    });

    if (!response.ok) {
      // If Databento service is not running, return helpful error
      if (response.status === 404 || response.status >= 500) {
        return NextResponse.json(
          {
            error: 'Stock data service not available',
            message: 'Start the Databento streaming service: cd services/databento && python stock_streamer.py',
          },
          { status: 503 }
        );
      }
      throw new Error(`Databento service error: ${response.status}`);
    }

    const data = await response.json();

    // Check if it's an error response from the service
    if (data.error) {
      return NextResponse.json(data, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching stock prices:', error);

    // Most likely the Databento service isn't running
    return NextResponse.json(
      {
        error: 'Stock data service unavailable',
        message: 'Start the Databento streaming service: cd services/databento && python stock_streamer.py',
      },
      { status: 503 }
    );
  }
}
