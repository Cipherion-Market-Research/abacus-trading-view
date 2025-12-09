import { NextResponse } from 'next/server';
import { ASSETS, ASSET_GROUPS } from '@/config/assets';

export async function GET() {
  return NextResponse.json({
    assets: ASSETS,
    groups: ASSET_GROUPS,
  });
}
