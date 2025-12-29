import { NextRequest, NextResponse } from 'next/server';
import { fetchPredictions } from '@/lib/api/ciphex';

// Disable all caching for this route - predictions change with each cycle
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await params;

    if (!assetId) {
      return NextResponse.json(
        { error: 'Asset ID is required' },
        { status: 400 }
      );
    }

    const predictions = await fetchPredictions(assetId);

    // Return with explicit no-cache headers to prevent browser caching
    return NextResponse.json(predictions, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error fetching predictions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch predictions' },
      { status: 500 },
    );
  }
}
