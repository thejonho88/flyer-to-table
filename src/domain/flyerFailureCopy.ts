import type { FlyerExtractionFailure } from './types';

/**
 * User-facing copy for every flyer-extraction failure reason. Lives in a pure
 * module (no React Native imports) so it can be unit-tested for exhaustiveness
 * against FLYER_EXTRACTION_FAILURES. The Record type also enforces exhaustiveness
 * at compile time — a missing reason is a type error.
 */
export const FAILURE_COPY: Record<FlyerExtractionFailure, string> = {
  unreadable_file: "Couldn't read this file. Upload a PDF, PNG, or JPG.",
  file_too_large:
    "This file is over 20 MB. Try the store's PDF download (not a scan) or a smaller file.",
  no_deals_found: 'No deals found in this flyer. Try a clearer copy.',
  error: 'Something went wrong reading this flyer. Please try again.',
};
