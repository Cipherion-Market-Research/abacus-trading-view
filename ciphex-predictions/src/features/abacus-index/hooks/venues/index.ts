/**
 * Venue Hooks
 *
 * Re-exports all venue WebSocket hooks.
 * Import from here for cleaner imports.
 */

// POC-0 venues
export { useBinanceSpot } from './useBinanceSpot';
export { useBinancePerp } from './useBinancePerp';
export { useCoinbaseSpot } from './useCoinbaseSpot';

// POC-1 venues
export { useOKXSpot } from './useOKXSpot';
export { useOKXPerp } from './useOKXPerp';
export { useBybitPerp } from './useBybitPerp';

// POC-2 venues
export { useKrakenSpot } from './useKrakenSpot';
