/**
 * Loud, typed failure for flyer discovery. Lives in its own module so both the
 * mock and remote discovery agents (and the config seam) can share it without a
 * circular import. MockDiscoveryAgent re-exports it for backward compatibility.
 */
export class DiscoveryError extends Error {
  constructor(
    public reason: 'no_flyers_found' | 'error',
    public postalCode: string,
  ) {
    super(`Discovery failed (${reason}) for ${postalCode}`);
    this.name = 'DiscoveryError';
  }
}
