import { NextResponse } from 'next/server';

const CIPHEX_API_URL = process.env.CIPHEX_API_URL || 'https://api.ciphex.io';
const CIPHEX_API_KEY = process.env.CIPHEX_API_KEY || '';

export const revalidate = 30;

export async function GET() {
  try {
    const response = await fetch(`${CIPHEX_API_URL}/v1/market/status`, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': CIPHEX_API_KEY,
      },
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      throw new Error(`Market status API error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      status: data.status,
      isTrading: data.is_trading,
      currentTimeET: data.current_time_et,
      sessionCloseUTC: data.session_close_utc,
      nextOpenUTC: data.next_open_utc,
      lastCloseUTC: data.last_close_utc,
      isHoliday: data.is_holiday,
      isWeekend: data.is_weekend,
      holidayName: data.holiday_name,
    });
  } catch (error) {
    console.error('Error fetching market status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market status' },
      { status: 500 },
    );
  }
}
