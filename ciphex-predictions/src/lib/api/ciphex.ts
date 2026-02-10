import { PredictionData, Horizon, Block, HistoricalBandData, HistoricalCycle, HistoricalHorizon } from '@/types';

const CIPHEX_API_URL = process.env.CIPHEX_API_URL || 'https://api.ciphex.io';
const CIPHEX_API_KEY = process.env.CIPHEX_API_KEY || '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchDashboard(assetId: string): Promise<any> {
  const response = await fetch(`${CIPHEX_API_URL}/v2/assets/${assetId}/dashboard/hybrid`, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': CIPHEX_API_KEY,
    },
    next: { revalidate: 300 }, // Cache for 5 minutes
  });

  if (!response.ok) {
    throw new Error(`Ciphex API error: ${response.status}`);
  }

  return response.json();
}

// Transform the Ciphex dashboard response to our internal format
// Based on the actual API response structure from the POC
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformDashboardResponse(dashboard: any): PredictionData {
  const blocks: Block[] = [];
  const allPredictions: Horizon[] = [];

  // Build a lookup map from settlement data (keyed by "block_number:horizon_index")
  const settlementMap = new Map<string, { variance_pct: number; in_range: boolean }>();
  for (const settlement of dashboard.settlements?.settlement_data || []) {
    const key = `${settlement.block_number}:${settlement.horizon_index}`;
    settlementMap.set(key, {
      variance_pct: settlement.actual?.variance_pct,
      in_range: settlement.actual?.in_range,
    });
  }

  // Extract predictions from blocks
  for (const block of dashboard.blocks || []) {
    const blockHorizons: Horizon[] = [];
    const blockNumber = block.block_number;

    for (const horizon of block.horizons || []) {
      const pred = horizon.prediction;
      if (!pred) continue;

      const timestamp = new Date(horizon.horizon_end_ts).getTime() / 1000;

      // Look up settlement data for this horizon
      const settlementKey = `${blockNumber}:${horizon.horizon_index}`;
      const settlement = settlementMap.get(settlementKey);

      const h: Horizon = {
        time: Math.floor(timestamp),
        low: pred.low_range,
        close: pred.mid_range, // mid price stored as close
        high: pred.high_range,
        probability: pred.probability,
        signal: pred.signal as Horizon['signal'],
        direction: pred.direction as Horizon['direction'],
        status: horizon.status,
        // Include settlement data if available
        ...(settlement && {
          variance_pct: settlement.variance_pct,
          in_range: settlement.in_range,
        }),
        // TTS hybrid fields
        model_source: pred.model_source,
        remaining_minutes: pred.remaining_minutes ?? null,
        tts_metadata: pred.tts_metadata ?? null,
      };

      blockHorizons.push(h);
      allPredictions.push(h);
    }

    blocks.push({
      label: block.block_type || `Block ${block.block_number}`,
      horizons: blockHorizons,
    });
  }

  // Sort all predictions by time
  allPredictions.sort((a, b) => a.time - b.time);

  // Extract cycle info
  const cycle = {
    cycleStart: dashboard.cycle?.cycle_start
      ? Math.floor(new Date(dashboard.cycle.cycle_start).getTime() / 1000)
      : 0,
    cycleEnd: dashboard.cycle?.cycle_end
      ? Math.floor(new Date(dashboard.cycle.cycle_end).getTime() / 1000)
      : 0,
    currentHorizonIndex: allPredictions.findIndex((p) => p.status === 'pending'),
    totalHorizons: allPredictions.length,
  };

  // If no pending found, set to last index
  if (cycle.currentHorizonIndex === -1) {
    cycle.currentHorizonIndex = allPredictions.length - 1;
  }

  // Extract hybrid metadata if present
  const hybridMetadata = dashboard.hybrid_metadata
    ? {
        tts_eligible: dashboard.hybrid_metadata.tts_eligible,
        tts_hybrid_enabled: dashboard.hybrid_metadata.tts_hybrid_enabled,
        total_horizons: dashboard.hybrid_metadata.total_horizons,
        tts_horizons: dashboard.hybrid_metadata.tts_horizons,
        traditional_horizons: dashboard.hybrid_metadata.traditional_horizons,
        tts_model_version: dashboard.hybrid_metadata.tts_model_version ?? null,
        hybrid_generated_at: dashboard.hybrid_metadata.hybrid_generated_at ?? null,
        asset_type: dashboard.hybrid_metadata.asset_type ?? null,
      }
    : undefined;

  return { blocks, cycle, allPredictions, hybridMetadata };
}

export async function fetchPredictions(assetId: string): Promise<PredictionData> {
  const data = await fetchDashboard(assetId);
  return transformDashboardResponse(data);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchHistory(assetId: string, days: number = 3): Promise<any> {
  const response = await fetch(`${CIPHEX_API_URL}/v2/assets/${assetId}/dashboard/history?days=${days}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': CIPHEX_API_KEY,
    },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`Ciphex History API error: ${response.status}`);
  }

  return response.json();
}

// Transform history response: flatten cycles[].blocks[].horizons[] into HistoricalCycle.horizons[]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformHistoryResponse(history: any): HistoricalBandData {
  const cycles: HistoricalCycle[] = [];
  let totalHorizonsSettled = 0;
  let totalInRange = 0;

  for (const cycle of history.cycles || []) {
    const horizons: HistoricalHorizon[] = [];

    for (const block of cycle.blocks || []) {
      for (const horizon of block.horizons || []) {
        // History endpoint puts prediction fields directly on horizon (no .prediction wrapper)
        if (!horizon.low_range && !horizon.high_range) continue;

        const timestamp = Math.floor(new Date(horizon.horizon_end_ts).getTime() / 1000);
        const settlement = horizon.settlement;

        const h: HistoricalHorizon = {
          time: timestamp,
          low: horizon.low_range,
          high: horizon.high_range,
          mid: horizon.hm_average,
          in_range: settlement?.in_range ?? false,
          variance_pct: settlement?.variance_pct ?? 0,
          actual_price: settlement?.actual_price ?? 0,
        };

        horizons.push(h);
        totalHorizonsSettled++;
        if (h.in_range) totalInRange++;
      }
    }

    horizons.sort((a, b) => a.time - b.time);

    cycles.push({
      cycleId: cycle.cycle_id || '',
      cycleStart: cycle.cycle_start
        ? Math.floor(new Date(cycle.cycle_start).getTime() / 1000)
        : 0,
      cycleEnd: cycle.cycle_end
        ? Math.floor(new Date(cycle.cycle_end).getTime() / 1000)
        : 0,
      horizons,
    });
  }

  cycles.sort((a, b) => a.cycleStart - b.cycleStart);

  return {
    cycles,
    summary: {
      totalCycles: cycles.length,
      totalHorizonsSettled,
      overallInRangePct: totalHorizonsSettled > 0
        ? (totalInRange / totalHorizonsSettled) * 100
        : 0,
    },
  };
}

export async function fetchHistoryData(assetId: string, days: number = 3): Promise<HistoricalBandData> {
  const data = await fetchHistory(assetId, days);
  return transformHistoryResponse(data);
}
