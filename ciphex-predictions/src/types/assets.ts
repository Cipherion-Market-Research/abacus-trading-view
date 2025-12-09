export type AssetType = 'crypto' | 'stock' | 'dex';

export interface Asset {
  id: string; // Ciphex UUID
  symbol: string; // e.g., "BTC/USDT", "AAPL"
  displayName: string;
  type: AssetType;
  binanceSymbol?: string; // e.g., "BTCUSDT"
  databentoSymbol?: string; // e.g., "AAPL"
}

export interface AssetGroup {
  label: string;
  assets: Asset[];
}
