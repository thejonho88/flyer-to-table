import type { FlyerExtractionFailure } from '@/domain/types';

/**
 * Loud, typed failure for flyer extraction. Lives in its own module so both the
 * mock and remote extractors (and the config seam) can share it without a
 * circular import. MockFlyerExtractor re-exports it for backward compatibility.
 */
export class FlyerExtractionError extends Error {
  constructor(
    public reason: FlyerExtractionFailure,
    public fileName: string,
  ) {
    super(`Flyer extraction failed (${reason}) for ${fileName}`);
    this.name = 'FlyerExtractionError';
  }
}
