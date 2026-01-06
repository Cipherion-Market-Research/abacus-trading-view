import { PredictionData, Horizon, Block } from '@/types';

const CIPHEX_API_URL = process.env.CIPHEX_API_URL || 'https://api.ciphex.io';
const CIPHEX_API_KEY = process.env.CIPHEX_API_KEY || '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchDashboard(assetId: string): Promise<any> {
  const response = await fetch(`${CIPHEX_API_URL}/v2/assets/${assetId}/dashboard`, {
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

  return { blocks, cycle, allPredictions };
}

export async function fetchPredictions(assetId: string): Promise<PredictionData> {
  const data = await fetchDashboard(assetId);
  return transformDashboardResponse(data);
}
