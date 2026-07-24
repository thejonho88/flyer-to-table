import { FLYER_EXTRACTION_FAILURES } from '@/domain/types';
import { FAILURE_COPY } from '@/domain/flyerFailureCopy';

describe('FAILURE_COPY', () => {
  it('has non-empty copy for every FlyerExtractionFailure member', () => {
    for (const reason of FLYER_EXTRACTION_FAILURES) {
      const copy = FAILURE_COPY[reason];
      expect(typeof copy).toBe('string');
      expect(copy.length).toBeGreaterThan(0);
    }
  });

  it('has no copy entries beyond the known failure reasons', () => {
    expect(Object.keys(FAILURE_COPY).sort()).toEqual(
      [...FLYER_EXTRACTION_FAILURES].sort(),
    );
  });

  it('gives file_too_large its own distinct message', () => {
    expect(FAILURE_COPY.file_too_large).toContain('20 MB');
    expect(FAILURE_COPY.file_too_large).not.toBe(FAILURE_COPY.unreadable_file);
  });
});
