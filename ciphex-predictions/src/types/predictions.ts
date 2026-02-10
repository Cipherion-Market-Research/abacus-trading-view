export interface Horizon {
  status: 'settled' | 'pending';
  signal: 'Favorable' | 'Ideal' | 'Certain';
  direction: 'Up' | 'Down' | 'Neutral';
  time: number; // Unix timestamp in seconds
  low: number;
  close: number; // mid price
  high: number;
  probability: number;
  // Settlement data (only present for settled horizons)
  variance_pct?: number;
  in_range?: boolean;
  // TTS hybrid fields
  model_source?: 'traditional' | 'tts';
  remaining_minutes?: number | null;
  tts_metadata?: {
    model_version: string;
    original_run_type: string;
    tts_prediction_id: string;
  } | null;
}

export interface Block {
  label: string;
  horizons: Horizon[];
}

export interface CycleInfo {
  cycleStart: number;
  cycleEnd: number;
  currentHorizonIndex: number;
  totalHorizons: number;
}

export interface HybridMetadata {
  tts_eligible: boolean;
  tts_hybrid_enabled: boolean;
  total_horizons: number;
  tts_horizons: number;
  traditional_horizons: number;
  tts_model_version: string | null;
  hybrid_generated_at: string | null;
  asset_type: string | null;
}

export interface PredictionData {
  blocks: Block[];
  cycle: CycleInfo;
  allPredictions: Horizon[];
  hybridMetadata?: HybridMetadata;
}

// Historical prediction data (completed cycles)
export interface HistoricalHorizon {
  time: number;
  low: number;
  high: number;
  mid: number;        // from hm_average
  in_range: boolean;
  variance_pct: number;
  actual_price: number;
}

export interface HistoricalCycle {
  cycleId: string;
  cycleStart: number;
  cycleEnd: number;
  horizons: HistoricalHorizon[];  // flattened from all blocks
}

export interface HistoricalBandData {
  cycles: HistoricalCycle[];
  summary: {
    totalCycles: number;
    totalHorizonsSettled: number;
    overallInRangePct: number;
  };
}

// Horizon marker model for x-axis markers
export interface HorizonMarkerModel {
  id: string;                    // `${blockIndex}:${horizonIndex}`
  time: number;                  // Original horizon time (unix seconds)
  timeSnapped: number;           // Snapped to chart grid
  blockIndex: number;            // 0, 1, 2
  blockLabel: string;            // 'Outlook', 'Continuation', 'Persistence'
  status: 'settled' | 'pending';
  direction: 'Up' | 'Down' | 'Neutral';
  signal: 'Favorable' | 'Ideal' | 'Certain';
  probability: number;
  high: number;
  close: number;                 // Target/mid
  low: number;
  variance_pct?: number;         // Settlement data
  in_range?: boolean;            // Settlement data
  model_source?: 'traditional' | 'tts';
  remaining_minutes?: number | null;
}
