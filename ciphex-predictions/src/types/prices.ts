export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type Interval = '15s' | '1m' | '15m' | '1h';

export interface PriceDataRequest {
  symbol: string;
  interval: Interval;
  limit?: number;
}
