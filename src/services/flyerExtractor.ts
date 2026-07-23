import type { FlyerExtractor } from '@/domain/types';
import { MockFlyerExtractor } from './MockFlyerExtractor';
import { RemoteFlyerExtractor } from './RemoteFlyerExtractor';

// FlyerExtractionError is re-exported here so consumers only need one import.
export { FlyerExtractionError } from './flyerExtractionError';

/**
 * Config seam: pick the real (Supabase-backed) extractor when the public
 * Supabase env vars are present, otherwise fall back to the deterministic mock.
 *
 * - EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY -> RemoteFlyerExtractor
 * - either missing -> MockFlyerExtractor
 * - EXPO_PUBLIC_FLYER_EXTRACTOR=mock -> force the mock (escape hatch)
 *
 * Jest runs with none of these env vars set, so tests transparently get the
 * mock and the existing suite is unaffected.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const forceMock = process.env.EXPO_PUBLIC_FLYER_EXTRACTOR === 'mock';

export const flyerExtractor: FlyerExtractor =
  !forceMock && url && anonKey
    ? new RemoteFlyerExtractor({ url, anonKey })
    : new MockFlyerExtractor();
