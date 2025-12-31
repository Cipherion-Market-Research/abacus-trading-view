'use client';

/**
 * Basis Features Hook
 *
 * Computes basis (perp - spot) and derived features.
 * These are key signals for forecasting models.
 *
 * Reference: EXCHANGE_INDEX_ANALYSIS.md Section A2
 */

import { useMemo } from 'react';
import {
  BasisFeatures,
  BasisHookReturn,
  CompositeHookReturn,
} from '../../types';
import { nowSeconds } from '../../utils/timestamps';

// =============================================================================
// Types
// =============================================================================

interface UseBasisFeaturesOptions {
  spot: CompositeHookReturn;
  perp: CompositeHookReturn;
  enabled?: boolean;
}

// =============================================================================
// Hook
// =============================================================================

export function useBasisFeatures({
  spot,
  perp,
  enabled = true,
}: UseBasisFeaturesOptions): BasisHookReturn {
  // Current basis features
  const current = useMemo((): BasisFeatures | null => {
    if (!enabled) return null;
    if (spot.price === null || perp.price === null) return null;

    const basis = perp.price - spot.price;
    const basisBps = (basis / spot.price) * 10000;

    return {
      basis,
      basisBps,
      time: nowSeconds(),
      degraded: spot.degraded || perp.degraded,
    };
  }, [enabled, spot.price, perp.price, spot.degraded, perp.degraded]);

  // Historical basis aligned with bars
  const history = useMemo((): BasisFeatures[] => {
    if (!enabled) return [];

    const spotBars = spot.bars;
    const perpBars = perp.bars;

    if (spotBars.length === 0 || perpBars.length === 0) return [];

    // Create lookup map for perp bars by time
    const perpByTime = new Map(perpBars.map((b) => [b.time, b]));

    const result: BasisFeatures[] = [];

    for (const spotBar of spotBars) {
      const perpBar = perpByTime.get(spotBar.time);
      if (!perpBar) continue;

      const basis = perpBar.close - spotBar.close;
      const basisBps = (basis / spotBar.close) * 10000;

      result.push({
        basis,
        basisBps,
        time: spotBar.time,
        degraded: spotBar.degraded || perpBar.degraded,
      });
    }

    return result;
  }, [enabled, spot.bars, perp.bars]);

  return {
    current,
    history,
    degraded: spot.degraded || perp.degraded,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Interpret basis value
 */
export function interpretBasis(basisBps: number): {
  direction: 'contango' | 'backwardation' | 'neutral';
  magnitude: 'small' | 'moderate' | 'large';
  description: string;
} {
  const absBasis = Math.abs(basisBps);

  let direction: 'contango' | 'backwardation' | 'neutral';
  if (basisBps > 5) direction = 'contango';
  else if (basisBps < -5) direction = 'backwardation';
  else direction = 'neutral';

  let magnitude: 'small' | 'moderate' | 'large';
  if (absBasis < 10) magnitude = 'small';
  else if (absBasis < 50) magnitude = 'moderate';
  else magnitude = 'large';

  let description: string;
  if (direction === 'contango') {
    description = `Perp trading ${basisBps.toFixed(1)} bps above spot (bullish crowding)`;
  } else if (direction === 'backwardation') {
    description = `Perp trading ${Math.abs(basisBps).toFixed(1)} bps below spot (bearish pressure)`;
  } else {
    description = 'Spot and perp prices aligned';
  }

  return { direction, magnitude, description };
}

/**
 * Calculate rolling basis statistics
 */
export function calculateBasisStats(history: BasisFeatures[]): {
  mean: number;
  std: number;
  min: number;
  max: number;
  current: number | null;
} | null {
  if (history.length === 0) return null;

  const values = history.map((h) => h.basisBps).filter((v): v is number => v !== null);
  if (values.length === 0) return null;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);

  return {
    mean,
    std,
    min: Math.min(...values),
    max: Math.max(...values),
    current: values[values.length - 1] ?? null,
  };
}
