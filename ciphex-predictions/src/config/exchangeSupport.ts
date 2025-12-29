/**
 * Exchange Support Matrix
 *
 * Defines which exchanges support which assets.
 * This prevents unnecessary WebSocket connections and API errors.
 *
 * Data source: Direct API queries to each exchange (2024-12-29)
 *
 * INDEX formula: (Bitstamp + Coinbase + Bitfinex + Kraken) / 4
 * Source: https://www.tradingview.com/support/solutions/43000659124-how-is-the-btc-index-being-calculated/
 */

export type ExchangeKey =
  | 'bitstamp'
  | 'coinbase'
  | 'bitfinex'
  | 'kraken'
  | 'gemini'
  | 'htx'
  | 'crypto_com_usd'
  | 'crypto_com_usdt';

// INDEX component exchanges
export const INDEX_EXCHANGES: ExchangeKey[] = ['bitstamp', 'coinbase', 'bitfinex', 'kraken'];

// All exchange overlays (non-INDEX)
export const OVERLAY_EXCHANGES: ExchangeKey[] = [
  'htx',
  'coinbase',
  'gemini',
  'kraken',
  'bitstamp',
  'bitfinex',
  'crypto_com_usd',
  'crypto_com_usdt',
];

/**
 * Exchange support matrix
 * Key: Base symbol (e.g., 'BTC', 'ETH')
 * Value: Set of supported exchange keys
 */
const EXCHANGE_SUPPORT: Record<string, Set<ExchangeKey>> = {
  BTC: new Set(['bitstamp', 'coinbase', 'bitfinex', 'kraken', 'gemini', 'htx', 'crypto_com_usd', 'crypto_com_usdt']),
  ETH: new Set(['bitstamp', 'coinbase', 'bitfinex', 'kraken', 'gemini', 'htx', 'crypto_com_usd', 'crypto_com_usdt']),
  SOL: new Set(['bitstamp', 'coinbase', 'bitfinex', 'kraken', 'gemini', 'htx', 'crypto_com_usd', 'crypto_com_usdt']),
  BNB: new Set(['bitstamp', 'coinbase', 'kraken', 'gemini', 'htx']), // No Bitfinex, Crypto.com
  XRP: new Set(['bitstamp', 'coinbase', 'bitfinex', 'kraken', 'gemini', 'htx', 'crypto_com_usd', 'crypto_com_usdt']),
  ADA: new Set(['bitstamp', 'coinbase', 'bitfinex', 'kraken', 'htx', 'crypto_com_usd', 'crypto_com_usdt']), // No Gemini
  DOT: new Set(['bitstamp', 'coinbase', 'bitfinex', 'kraken', 'gemini', 'htx', 'crypto_com_usd', 'crypto_com_usdt']),
  ATOM: new Set(['coinbase', 'kraken', 'gemini', 'htx', 'crypto_com_usd', 'crypto_com_usdt']), // No Bitstamp, Bitfinex
  TON: new Set(['bitstamp', 'coinbase', 'kraken', 'gemini', 'htx', 'crypto_com_usd', 'crypto_com_usdt']), // No Bitfinex
  TRX: new Set(['bitfinex', 'kraken', 'htx']), // No Bitstamp, Coinbase, Gemini, Crypto.com
  ZEC: new Set(['coinbase', 'bitfinex', 'kraken', 'gemini', 'htx']), // No Bitstamp, Crypto.com
};

/**
 * Check if an exchange supports a given asset
 */
export function isExchangeSupported(baseSymbol: string, exchange: ExchangeKey): boolean {
  const supported = EXCHANGE_SUPPORT[baseSymbol.toUpperCase()];
  return supported ? supported.has(exchange) : false;
}

/**
 * Get all supported exchanges for an asset
 */
export function getSupportedExchanges(baseSymbol: string): ExchangeKey[] {
  const supported = EXCHANGE_SUPPORT[baseSymbol.toUpperCase()];
  return supported ? Array.from(supported) : [];
}

/**
 * Get INDEX component exchanges that support an asset
 */
export function getIndexExchanges(baseSymbol: string): ExchangeKey[] {
  return INDEX_EXCHANGES.filter(ex => isExchangeSupported(baseSymbol, ex));
}

/**
 * Check if INDEX is available for an asset
 *
 * INDEX requires ALL 4 component exchanges (Bitstamp, Coinbase, Bitfinex, Kraken)
 * to maintain formula integrity: (Bitstamp + Coinbase + Bitfinex + Kraken) / 4
 *
 * Assets without full coverage should not show INDEX to avoid misleading prices.
 */
export function isIndexAvailable(baseSymbol: string): boolean {
  return getIndexExchanges(baseSymbol).length === INDEX_EXCHANGES.length;
}

/**
 * Get exchange support info for UI display
 */
export interface ExchangeSupportInfo {
  exchange: ExchangeKey;
  supported: boolean;
  label: string;
  quoteCurrency: 'USD' | 'USDT';
}

export function getExchangeSupportInfo(baseSymbol: string): ExchangeSupportInfo[] {
  const symbol = baseSymbol.toUpperCase();

  return [
    { exchange: 'htx', supported: isExchangeSupported(symbol, 'htx'), label: 'HTX', quoteCurrency: 'USDT' },
    { exchange: 'coinbase', supported: isExchangeSupported(symbol, 'coinbase'), label: 'Coinbase', quoteCurrency: 'USD' },
    { exchange: 'gemini', supported: isExchangeSupported(symbol, 'gemini'), label: 'Gemini', quoteCurrency: 'USD' },
    { exchange: 'kraken', supported: isExchangeSupported(symbol, 'kraken'), label: 'Kraken', quoteCurrency: 'USD' },
    { exchange: 'bitstamp', supported: isExchangeSupported(symbol, 'bitstamp'), label: 'Bitstamp', quoteCurrency: 'USD' },
    { exchange: 'bitfinex', supported: isExchangeSupported(symbol, 'bitfinex'), label: 'Bitfinex', quoteCurrency: 'USD' },
    { exchange: 'crypto_com_usd', supported: isExchangeSupported(symbol, 'crypto_com_usd'), label: 'Crypto.com', quoteCurrency: 'USD' },
    { exchange: 'crypto_com_usdt', supported: isExchangeSupported(symbol, 'crypto_com_usdt'), label: 'Crypto.com', quoteCurrency: 'USDT' },
  ];
}

/**
 * Kraken special symbol mapping
 * Kraken uses XBT instead of BTC and has different pair naming conventions
 */
export function getKrakenSymbol(baseSymbol: string): string {
  const symbol = baseSymbol.toUpperCase();
  // Kraken uses XBT for Bitcoin
  if (symbol === 'BTC') return 'XBT';
  return symbol;
}
