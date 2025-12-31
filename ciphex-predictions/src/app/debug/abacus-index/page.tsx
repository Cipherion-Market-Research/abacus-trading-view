'use client';

/**
 * Abacus:INDEX Debug Route
 *
 * POC-0 validation harness for monitoring venue connections,
 * composite calculations, and data quality metrics.
 *
 * Access at: /debug/abacus-index
 */

import { AbacusIndexDebug } from '@/features/abacus-index/components/AbacusIndexDebug';

export default function AbacusIndexDebugPage() {
  return <AbacusIndexDebug />;
}
