/**
 * Abacus:INDEX Module
 *
 * Multi-venue cryptocurrency price composite for forecasting signals.
 *
 * ## Quick Start
 *
 * ```tsx
 * import {
 *   useBinanceSpot,
 *   useBinancePerp,
 *   useCoinbaseSpot,
 *   useSpotComposite,
 *   usePerpComposite,
 *   useBasisFeatures,
 * } from '@/features/abacus-index';
 *
 * function MyComponent() {
 *   // Connect to venues
 *   const binanceSpot = useBinanceSpot({ asset: 'BTC' });
 *   const coinbaseSpot = useCoinbaseSpot({ asset: 'BTC' });
 *   const binancePerp = useBinancePerp({ asset: 'BTC' });
 *
 *   // Compute composites
 *   const spotComposite = useSpotComposite({
 *     venues: { binance: binanceSpot, coinbase: coinbaseSpot },
 *     asset: 'BTC',
 *   });
 *
 *   const perpComposite = usePerpComposite({
 *     venues: { binance: binancePerp },
 *     asset: 'BTC',
 *   });
 *
 *   // Compute basis
 *   const basis = useBasisFeatures({
 *     spot: spotComposite,
 *     perp: perpComposite,
 *   });
 *
 *   return <div>Basis: {basis.current?.basisBps?.toFixed(2)} bps</div>;
 * }
 * ```
 *
 * ## POC Status
 *
 * - POC-0: Binance spot/perp + Coinbase spot (BTC only)
 * - POC-1: +OKX spot/perp + Bybit perp (BTC)
 * - POC-2: +Kraken spot (BTC + ETH)
 *
 * See README.md for full documentation.
 */

// Types
export * from './types';

// Constants
export {
  OUTLIER_THRESHOLD_BPS,
  QUORUM_POLICIES,
  CURRENT_QUORUM_POLICY,
  getQuorumConfig,
  STALE_THRESHOLDS_MS,
  getStaleThreshold,
  VENUE_CONFIGS,
  POC_PHASES,
  CURRENT_POC_PHASE,
  getEnabledVenues,
  COMPOSITE_COLORS,
  STATUS_COLORS,
} from './constants';

// Symbol mapping
export {
  getSymbol,
  getStreamName,
  venueSupportsMarket,
  venueSupportsAsset,
  getSupportedCombinations,
  buildSubscriptionMessage,
  parseVenueSymbol,
} from './symbolMapping';

// Utilities
export * from './utils';

// Hooks
export * from './hooks';
