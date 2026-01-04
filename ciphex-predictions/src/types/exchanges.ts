// Exchange types for multi-exchange price comparison

export type ExchangeId = 'binance' | 'htx' | 'coinbase' | 'gemini' | 'crypto_com';

export interface ExchangeInfo {
  id: ExchangeId;
  name: string;
  color: string;
  quoteCurrency: 'USDT' | 'USD' | 'USDC';
}

// Exchange configuration with display properties
export const EXCHANGES: Record<ExchangeId, ExchangeInfo> = {
  binance: {
    id: 'binance',
    name: 'Binance',
    color: '#F0B90B', // Binance yellow
    quoteCurrency: 'USDT',
  },
  htx: {
    id: 'htx',
    name: 'HTX',
    color: '#00D1B2', // HTX teal
    quoteCurrency: 'USDT',
  },
  coinbase: {
    id: 'coinbase',
    name: 'Coinbase',
    color: '#0052FF', // Coinbase blue
    quoteCurrency: 'USD',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    color: '#00DCFA', // Gemini cyan
    quoteCurrency: 'USD',
  },
  crypto_com: {
    id: 'crypto_com',
    name: 'Crypto.com',
    color: '#103F68', // Crypto.com navy - will use both USD and USDT
    quoteCurrency: 'USD',
  },
};

// Exchange price data point (close price only for overlay)
export interface ExchangePricePoint {
  time: number; // Unix timestamp in seconds
  price: number;
}

// Real-time exchange price state
export interface ExchangePriceState {
  exchange: ExchangeId;
  price: number | null;
  lastUpdate: number | null;
  connected: boolean;
  error: string | null;
}

// Symbol mapping per exchange
export interface ExchangeSymbolMap {
  binance: string;   // e.g., 'BTCUSDT'
  htx: string;       // e.g., 'btcusdt'
  coinbase: string;  // e.g., 'BTC-USD'
  gemini: string;    // e.g., 'btcusd'
  crypto_com: string; // e.g., 'BTC_USD'
}

// Map our asset symbols to exchange-specific formats
export function getExchangeSymbol(baseSymbol: string, exchange: ExchangeId): string {
  // baseSymbol is like 'BTC' or 'ETH' (without quote currency)
  const base = baseSymbol.toUpperCase();

  switch (exchange) {
    case 'binance':
      return `${base}USDT`;
    case 'htx':
      return `${base.toLowerCase()}usdt`;
    case 'coinbase':
      return `${base}-USD`;
    case 'gemini':
      return `${base.toLowerCase()}usd`;
    case 'crypto_com':
      return `${base}_USD`;
    default:
      return `${base}USDT`;
  }
}

// Extract base symbol from our asset symbol (e.g., 'BTC/USDT' -> 'BTC')
export function extractBaseSymbol(assetSymbol: string): string {
  return assetSymbol.split('/')[0].toUpperCase();
}

// Exchange visibility state (persisted in localStorage)
export interface ExchangeVisibility {
  composite_index: boolean;  // TradingView-style INDEX (average of USD exchanges)
  abacus_perp: boolean;      // Abacus:INDEX perp composite
  htx: boolean;
  coinbase: boolean;
  gemini: boolean;
  kraken: boolean;
  bitstamp: boolean;
  bitfinex: boolean;
  crypto_com_usd: boolean;
  crypto_com_usdt: boolean;
}

export const DEFAULT_EXCHANGE_VISIBILITY: ExchangeVisibility = {
  composite_index: true,   // INDEX on by default (TradingView-style composite)
  abacus_perp: false,      // Abacus perp off by default
  htx: false,
  coinbase: false,
  gemini: false,
  kraken: false,
  bitstamp: false,
  bitfinex: false,
  crypto_com_usd: false,
  crypto_com_usdt: false,
};
