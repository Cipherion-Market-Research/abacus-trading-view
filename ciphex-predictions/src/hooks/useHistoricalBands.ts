'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { HistoricalBandData } from '@/types';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface UseHistoricalBandsOptions {
  assetId: string;
}

interface UseHistoricalBandsReturn {
  historicalBands: HistoricalBandData | null;
  loading: boolean;
}

export function useHistoricalBands({
  assetId,
}: UseHistoricalBandsOptions): UseHistoricalBandsReturn {
  const [historicalBands, setHistoricalBands] = useState<HistoricalBandData | null>(null);
  const [loading, setLoading] = useState(true);
  const prevAssetIdRef = useRef<string>(assetId);

  // Clear immediately on asset change (before paint)
  useIsomorphicLayoutEffect(() => {
    if (prevAssetIdRef.current !== assetId) {
      setHistoricalBands(null);
      prevAssetIdRef.current = assetId;
    }
  }, [assetId]);

  useEffect(() => {
    if (!assetId) return;

    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch(`/api/history/${assetId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch history: ${response.status}`);
        }
        const data = await response.json();
        if (!cancelled) {
          setHistoricalBands(data);
        }
      } catch (err) {
        console.error('Error fetching historical bands:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return { historicalBands, loading };
}
