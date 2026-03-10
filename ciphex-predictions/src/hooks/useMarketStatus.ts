'use client';

import { useState, useEffect, useCallback } from 'react';

export interface MarketStatus {
  status: 'OPEN' | 'CLOSED' | 'PRE_OPEN' | 'POST_CLOSE';
  isTrading: boolean;
  currentTimeET: string;
  sessionCloseUTC: string | null;
  nextOpenUTC: string | null;
  lastCloseUTC: string | null;
  isHoliday: boolean;
  isWeekend: boolean;
  holidayName: string | null;
}

interface UseMarketStatusOptions {
  enabled: boolean;
}

const POLL_INTERVAL = 60_000; // 60 seconds

export function useMarketStatus({ enabled }: UseMarketStatusOptions) {
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/market/status', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Market status error: ${response.status}`);
      }

      const data: MarketStatus = await response.json();
      setMarketStatus(data);
    } catch (err) {
      console.error('Failed to fetch market status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setMarketStatus(null);
      return;
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [enabled, fetchStatus]);

  return { marketStatus, loading };
}
