import type { Chain } from '@/domain/types';

/**
 * Per-chain weekly-flyer landing pages. Used as the default `flyerUrl` for a
 * store and the default `sourceUrl` for its deals when the mock discovery agent
 * has no store-specific circulaire page. A real agent would resolve the exact
 * flyer page per store; these chain URLs are the honest stand-in.
 */
export const CHAIN_FLYER_URLS: Record<Chain, string> = {
  metro: 'https://www.metro.ca/en/flyer',
  iga: 'https://www.iga.net/en/flyer',
  provigo: 'https://www.provigo.ca/flyers',
  maxi: 'https://www.maxi.ca/flyers',
  superc: 'https://www.superc.ca/en/flyer',
  loblaws: 'https://www.loblaws.ca/flyers',
  walmart: 'https://www.walmart.ca/en/flyer',
};
