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

export interface PredictionData {
  blocks: Block[];
  cycle: CycleInfo;
  allPredictions: Horizon[];
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
}
