import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_COUNTRIES = new Set(['CA']);

function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (!forwardedFor) return null;
  return forwardedFor.split(',')[0]?.trim() || null;
}

function getIpAllowlist(): Set<string> {
  const raw = process.env.GEOFENCE_IP_ALLOWLIST || '';
  const entries = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return new Set(entries);
}

export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  // API key bypass for internal services (e.g., api.ciphex.io)
  const apiKey = request.headers.get('x-api-key');
  const validApiKey = process.env.CIPHEX_API_KEY;
  if (apiKey && validApiKey && apiKey === validApiKey) {
    return NextResponse.next();
  }

  const country = request.headers.get('x-vercel-ip-country');
  if (country && ALLOWED_COUNTRIES.has(country)) {
    return NextResponse.next();
  }

  const allowlist = getIpAllowlist();
  const clientIp = getClientIp(request);
  if (clientIp && allowlist.has(clientIp)) {
    return NextResponse.next();
  }

  const geofenceReason = country ? 'country-deny' : 'country-unknown';

  const isApiRoute = request.nextUrl.pathname.startsWith('/api');
  if (isApiRoute) {
    return NextResponse.json(
      { error: 'Access denied in your region.' },
      {
        status: 403,
        headers: {
          'cache-control': 'no-store',
          'x-geofence-reason': geofenceReason,
        },
      }
    );
  }

  const redirectUrl = new URL('https://ciphex.io');
  redirectUrl.searchParams.set('geo', geofenceReason);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
