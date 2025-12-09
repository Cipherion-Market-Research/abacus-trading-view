import { Asset, AssetGroup } from '@/types';

// Ciphex UUID to asset config mapping
// Real UUIDs from Ciphex API (confirmed from webapp POC)
export const ASSETS: Record<string, Asset> = {
  // CEX Crypto (11 assets) - Real Ciphex UUIDs
  '5d9a8088-6bcc-4956-9535-1175091fa9e2': {
    id: '5d9a8088-6bcc-4956-9535-1175091fa9e2',
    symbol: 'BTC/USDT',
    displayName: 'Bitcoin',
    type: 'crypto',
    binanceSymbol: 'BTCUSDT',
  },
  'f7114ef2-077d-450d-be53-e45d2b7abb38': {
    id: 'f7114ef2-077d-450d-be53-e45d2b7abb38',
    symbol: 'ETH/USDT',
    displayName: 'Ethereum',
    type: 'crypto',
    binanceSymbol: 'ETHUSDT',
  },
  'b957624a-b741-491a-8843-d3fb066116a4': {
    id: 'b957624a-b741-491a-8843-d3fb066116a4',
    symbol: 'SOL/USDT',
    displayName: 'Solana',
    type: 'crypto',
    binanceSymbol: 'SOLUSDT',
  },
  'ec972bb7-7912-4808-929a-d2d1356fc65e': {
    id: 'ec972bb7-7912-4808-929a-d2d1356fc65e',
    symbol: 'BNB/USDT',
    displayName: 'Binance Coin',
    type: 'crypto',
    binanceSymbol: 'BNBUSDT',
  },
  'feb17d4e-a8d5-4e8f-8ec7-1c90e66989c3': {
    id: 'feb17d4e-a8d5-4e8f-8ec7-1c90e66989c3',
    symbol: 'XRP/USDT',
    displayName: 'Ripple',
    type: 'crypto',
    binanceSymbol: 'XRPUSDT',
  },
  '6eaaf1e9-079e-452f-a193-5d08347276b1': {
    id: '6eaaf1e9-079e-452f-a193-5d08347276b1',
    symbol: 'ADA/USDT',
    displayName: 'Cardano',
    type: 'crypto',
    binanceSymbol: 'ADAUSDT',
  },
  'df3fdfb1-5522-4569-a437-d4a03f81fa3d': {
    id: 'df3fdfb1-5522-4569-a437-d4a03f81fa3d',
    symbol: 'DOT/USDT',
    displayName: 'Polkadot',
    type: 'crypto',
    binanceSymbol: 'DOTUSDT',
  },
  'b1bfc010-94aa-46ab-970a-474eacfb3cca': {
    id: 'b1bfc010-94aa-46ab-970a-474eacfb3cca',
    symbol: 'ATOM/USDT',
    displayName: 'Cosmos',
    type: 'crypto',
    binanceSymbol: 'ATOMUSDT',
  },
  'f2362093-b5f6-45a1-96ad-f7953711369e': {
    id: 'f2362093-b5f6-45a1-96ad-f7953711369e',
    symbol: 'TON/USDT',
    displayName: 'Toncoin',
    type: 'crypto',
    binanceSymbol: 'TONUSDT',
  },
  '0fc7ccce-d076-434c-ad90-94952eba437d': {
    id: '0fc7ccce-d076-434c-ad90-94952eba437d',
    symbol: 'TRX/USDT',
    displayName: 'Tron',
    type: 'crypto',
    binanceSymbol: 'TRXUSDT',
  },
  '6db93b59-9dad-463c-9300-504b7e502f4a': {
    id: '6db93b59-9dad-463c-9300-504b7e502f4a',
    symbol: 'ZEC/USDT',
    displayName: 'Zcash',
    type: 'crypto',
    binanceSymbol: 'ZECUSDT',
  },

  // DEX Tokens (2 assets) - Real Ciphex UUIDs
  '422a0e5a-cc7f-4394-b7c9-dcdc9947df95': {
    id: '422a0e5a-cc7f-4394-b7c9-dcdc9947df95',
    symbol: 'TRUMP',
    displayName: 'TRUMP',
    type: 'dex',
    binanceSymbol: 'TRUMPUSDT',
  },
  '310d32b6-8e25-44f8-996f-bf0b1192fe16': {
    id: '310d32b6-8e25-44f8-996f-bf0b1192fe16',
    symbol: 'FARTCOIN',
    displayName: 'Fartcoin',
    type: 'dex',
  },

  // Stocks & ETFs (18 assets) - Real Ciphex UUIDs
  'bc0c573c-976e-45d9-b6e8-b2e2c04fadc2': {
    id: 'bc0c573c-976e-45d9-b6e8-b2e2c04fadc2',
    symbol: 'AAPL',
    displayName: 'Apple',
    type: 'stock',
    databentoSymbol: 'AAPL',
  },
  '42c21c74-b7d6-410f-a3e1-8b2e1ab3ab07': {
    id: '42c21c74-b7d6-410f-a3e1-8b2e1ab3ab07',
    symbol: 'AMZN',
    displayName: 'Amazon',
    type: 'stock',
    databentoSymbol: 'AMZN',
  },
  'bfa3477f-2e55-4708-a050-935f97ba8732': {
    id: 'bfa3477f-2e55-4708-a050-935f97ba8732',
    symbol: 'NVDA',
    displayName: 'NVIDIA',
    type: 'stock',
    databentoSymbol: 'NVDA',
  },
  '06d0eb31-c195-4694-b1b7-62bb1b2e6853': {
    id: '06d0eb31-c195-4694-b1b7-62bb1b2e6853',
    symbol: 'TSLA',
    displayName: 'Tesla',
    type: 'stock',
    databentoSymbol: 'TSLA',
  },
  '2ead698c-9469-4d5d-9a37-4a6bb40e14cf': {
    id: '2ead698c-9469-4d5d-9a37-4a6bb40e14cf',
    symbol: 'META',
    displayName: 'Meta',
    type: 'stock',
    databentoSymbol: 'META',
  },
  '3bce27cf-1bc6-4fd2-8941-ce93ae2c1d8c': {
    id: '3bce27cf-1bc6-4fd2-8941-ce93ae2c1d8c',
    symbol: 'MSFT',
    displayName: 'Microsoft',
    type: 'stock',
    databentoSymbol: 'MSFT',
  },
  'e21ccaf5-c182-4b05-9c46-dd0d1ad5fa2e': {
    id: 'e21ccaf5-c182-4b05-9c46-dd0d1ad5fa2e',
    symbol: 'GOOGL',
    displayName: 'Alphabet A',
    type: 'stock',
    databentoSymbol: 'GOOGL',
  },
  '9d860abf-b4d7-49a3-86f9-2ca1c08bd225': {
    id: '9d860abf-b4d7-49a3-86f9-2ca1c08bd225',
    symbol: 'GOOG',
    displayName: 'Alphabet C',
    type: 'stock',
    databentoSymbol: 'GOOG',
  },
  'f5bd9c14-eedb-47bd-9a7c-b6c4fce0c323': {
    id: 'f5bd9c14-eedb-47bd-9a7c-b6c4fce0c323',
    symbol: 'SPY',
    displayName: 'S&P 500 ETF',
    type: 'stock',
    databentoSymbol: 'SPY',
  },
  'f1383a5b-ca43-4000-8981-ce514ebd1372': {
    id: 'f1383a5b-ca43-4000-8981-ce514ebd1372',
    symbol: 'QQQ',
    displayName: 'Nasdaq ETF',
    type: 'stock',
    databentoSymbol: 'QQQ',
  },
  '4abab537-d868-4dba-90af-1af3d17b174d': {
    id: '4abab537-d868-4dba-90af-1af3d17b174d',
    symbol: 'DIA',
    displayName: 'Dow Jones ETF',
    type: 'stock',
    databentoSymbol: 'DIA',
  },
  '18c90ae6-48a8-499c-a27a-71c57e8f48ca': {
    id: '18c90ae6-48a8-499c-a27a-71c57e8f48ca',
    symbol: 'IWM',
    displayName: 'Russell 2000 ETF',
    type: 'stock',
    databentoSymbol: 'IWM',
  },
  'c0288a4b-cef3-41c7-b1ce-d79de9ee579b': {
    id: 'c0288a4b-cef3-41c7-b1ce-d79de9ee579b',
    symbol: 'XLK',
    displayName: 'Technology Select',
    type: 'stock',
    databentoSymbol: 'XLK',
  },
  'c2425baf-6cbd-457a-b190-67260ed85408': {
    id: 'c2425baf-6cbd-457a-b190-67260ed85408',
    symbol: 'XLF',
    displayName: 'Financial Select',
    type: 'stock',
    databentoSymbol: 'XLF',
  },
  '02daafa0-52af-4cca-9838-dddb0f7a8258': {
    id: '02daafa0-52af-4cca-9838-dddb0f7a8258',
    symbol: 'XLE',
    displayName: 'Energy Select',
    type: 'stock',
    databentoSymbol: 'XLE',
  },
  'a7ba8921-98a5-4594-960e-3b1d963171ae': {
    id: 'a7ba8921-98a5-4594-960e-3b1d963171ae',
    symbol: 'XLI',
    displayName: 'Industrial Select',
    type: 'stock',
    databentoSymbol: 'XLI',
  },
  'ccb3f930-1fb1-4e4e-bc20-7e9022837148': {
    id: 'ccb3f930-1fb1-4e4e-bc20-7e9022837148',
    symbol: 'XLP',
    displayName: 'Consumer Staples',
    type: 'stock',
    databentoSymbol: 'XLP',
  },
  '44c9ac4a-2822-4399-8039-05b84a478919': {
    id: '44c9ac4a-2822-4399-8039-05b84a478919',
    symbol: 'XLV',
    displayName: 'Health Care Select',
    type: 'stock',
    databentoSymbol: 'XLV',
  },
};

// Group assets by type
export const ASSET_GROUPS: AssetGroup[] = [
  {
    label: 'Crypto',
    assets: Object.values(ASSETS).filter((a) => a.type === 'crypto'),
  },
  {
    label: 'DEX Tokens',
    assets: Object.values(ASSETS).filter((a) => a.type === 'dex'),
  },
  {
    label: 'Stocks & ETFs',
    assets: Object.values(ASSETS).filter((a) => a.type === 'stock'),
  },
];

// Default asset (Bitcoin)
export const DEFAULT_ASSET_ID = '5d9a8088-6bcc-4956-9535-1175091fa9e2';

// Get asset by symbol
export function getAssetBySymbol(symbol: string): Asset | undefined {
  return Object.values(ASSETS).find(
    (a) =>
      a.symbol.toLowerCase() === symbol.toLowerCase() ||
      a.binanceSymbol?.toLowerCase() === symbol.toLowerCase() ||
      a.databentoSymbol?.toLowerCase() === symbol.toLowerCase()
  );
}

// Get asset by ID
export function getAssetById(id: string): Asset | undefined {
  return ASSETS[id];
}
