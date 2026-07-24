import type {
  Deal,
  FlyerExtractInput,
  FlyerExtractOptions,
  FlyerExtractionEvent,
  FlyerExtractor,
} from '@/domain/types';
import { makeExtractedDeals } from '@/data/deals';
import { FlyerExtractionError } from './flyerExtractionError';
import { MAX_FILE_BYTES } from './RemoteFlyerExtractor';

// Re-exported for backward compatibility: FlyerExtractionError now lives in its
// own module (see ./flyerExtractionError) to avoid circular imports.
export { FlyerExtractionError };

const VALID_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
]);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface MockFlyerExtractorOptions {
  /** Multiplier on simulated latency. 1 = default; 0 = instant (tests). */
  latencyScale?: number;
}

/**
 * Stand-in for the real server-side flyer parser (Claude/Supabase, Phase 0
 * unvalidated). Mirrors MockDiscoveryAgent's style: streams visible progress,
 * simulates latency, and — critically — fails LOUDLY. It rejects unreadable
 * file types up front and never resolves an empty Deal[] (empty → no_deals_found).
 *
 * The mock NEVER reads `file.uri`; a live implementation would upload/parse it.
 * Sits behind the FlyerExtractor interface so a real extractor drops in unchanged.
 */
export class MockFlyerExtractor implements FlyerExtractor {
  private readonly latencyScale: number;

  constructor(opts: MockFlyerExtractorOptions = {}) {
    this.latencyScale = opts.latencyScale ?? 1;
  }

  async extract(
    input: FlyerExtractInput,
    opts: FlyerExtractOptions = {},
  ): Promise<Deal[]> {
    const { file, storeId, chain } = input;
    const emit = (e: FlyerExtractionEvent) => opts.onEvent?.(e);
    const wait = (ms: number) => delay(ms * this.latencyScale);

    // Loud, immediate failure for a file we can't parse — before any progress.
    if (!VALID_MIME_TYPES.has(file.mimeType)) {
      throw new FlyerExtractionError('unreadable_file', file.name);
    }
    // Mirror the remote extractor's cap so mock and live behave alike.
    if (file.size > MAX_FILE_BYTES) {
      throw new FlyerExtractionError('file_too_large', file.name);
    }

    emit({ type: 'status', message: 'Reading flyer…', progress: 0.2 });
    await wait(500);

    emit({ type: 'status', message: 'Extracting deals…', progress: 0.7 });
    await wait(500);

    // A real extractor reads `file.uri`; the mock derives deterministic deals
    // from the store's chain so the planner gets real ingredient ids/units.
    const deals = makeExtractedDeals(storeId, chain);

    // Never a silent empty success.
    if (deals.length === 0) {
      throw new FlyerExtractionError('no_deals_found', file.name);
    }

    emit({ type: 'status', message: 'Done', progress: 1 });
    return deals;
  }
}
