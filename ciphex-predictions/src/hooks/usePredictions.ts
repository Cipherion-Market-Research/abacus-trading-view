'use client';

import { useState, useEffect, useCallback } from 'react';
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

  const fetchPredictions = useCallback(async () => {
    if (!assetId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/predictions/${assetId}`);
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
