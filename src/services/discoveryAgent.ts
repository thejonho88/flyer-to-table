import type { DiscoveryAgent } from '@/domain/types';
import { MockDiscoveryAgent } from './MockDiscoveryAgent';
import { RemoteDiscoveryAgent } from './RemoteDiscoveryAgent';

// DiscoveryError is re-exported here so consumers only need one import.
export { DiscoveryError } from './discoveryError';

/**
 * Config seam: pick the real (Supabase-backed) discovery agent when the public
 * Supabase env vars are present, otherwise fall back to the deterministic mock.
 *
 * - EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY -> RemoteDiscoveryAgent
 * - either missing -> MockDiscoveryAgent
 * - EXPO_PUBLIC_DISCOVERY=mock -> force the mock (escape hatch)
 *
 * Jest runs with none of these env vars set, so tests transparently get the
 * mock and the existing suite is unaffected.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const forceMock = process.env.EXPO_PUBLIC_DISCOVERY === 'mock';

export const discoveryAgent: DiscoveryAgent =
  !forceMock && url && anonKey
    ? new RemoteDiscoveryAgent({ url, anonKey })
    : new MockDiscoveryAgent();
