export interface Horizon {
  status: 'settled' | 'pending';
  signal: 'Favorable' | 'Ideal' | 'Certain';
  direction: 'Up' | 'Down' | 'Neutral';
  time: number; // Unix timestamp in seconds
  low: number;
  close: number; // mid price
  high: number;
  probability: number;
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
