'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PredictionData } from '@/types';

interface UsePredictionsOptions {
  assetId: string;
  refreshInterval?: number; // in milliseconds
}

interface UsePredictionsReturn {
  predictions: PredictionData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePredictions({
  assetId,
  refreshInterval = 5 * 60 * 1000, // 5 minutes
}: UsePredictionsOptions): UsePredictionsReturn {
  const [predictions, setPredictions] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track the previous assetId to detect changes
  const prevAssetIdRef = useRef<string>(assetId);

  const fetchPredictions = useCallback(async () => {
    if (!assetId) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch with cache disabled to always get fresh predictions
      // This is critical for prediction cycles that change every 24h
      const response = await fetch(`/api/predictions/${assetId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch predictions: ${response.status}`);
      }

      const data = await response.json();
      setPredictions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  // Clear predictions immediately when assetId changes to prevent showing stale data
  useEffect(() => {
    if (prevAssetIdRef.current !== assetId) {
      // Asset changed - clear old predictions immediately
      setPredictions(null);
      prevAssetIdRef.current = assetId;
    }
  }, [assetId]);

  useEffect(() => {
    fetchPredictions();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchPredictions, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchPredictions, refreshInterval]);

  return {
    predictions,
    loading,
    error,
    refresh: fetchPredictions,
  };
}
