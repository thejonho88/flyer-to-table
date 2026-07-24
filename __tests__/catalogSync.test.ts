import {
  CATALOG,
  CATALOG_IDS,
  CATALOG_ID_SET,
  getCatalogEntry,
} from '../supabase/functions/extract-flyer/catalog';
import {
  CATALOG as DISCOVER_CATALOG,
  CATALOG_IDS as DISCOVER_CATALOG_IDS,
  getCatalogEntry as getDiscoverCatalogEntry,
} from '../supabase/functions/discover-deals/catalog';
import { INGREDIENTS } from '@/data/ingredients';

/**
 * Both edge functions carry a hand-off copy of the app ingredient catalog
 * (MCP deploys are per-function bundles, so extract-flyer and discover-deals
 * each need their own copy). If any copy drifts, the model's enum + the
 * validator/mapper would reject valid ids (or accept stale ones). These tests
 * are the guardrail for BOTH copies.
 */
describe('edge catalogs stay in sync with the app ingredient catalog', () => {
  it('extract-flyer covers exactly the same ids (all 70, including staples)', () => {
    const appIds = INGREDIENTS.map((i) => i.id).sort();
    const edgeIds = [...CATALOG_IDS].sort();
    expect(edgeIds).toEqual(appIds);
    expect(CATALOG_IDS).toHaveLength(70);
  });

  it('discover-deals covers exactly the same ids (all 70, including staples)', () => {
    const appIds = INGREDIENTS.map((i) => i.id).sort();
    const edgeIds = [...DISCOVER_CATALOG_IDS].sort();
    expect(edgeIds).toEqual(appIds);
    expect(DISCOVER_CATALOG_IDS).toHaveLength(70);
  });

  it('has matching nameFr for every id in both edge copies', () => {
    for (const ing of INGREDIENTS) {
      expect(getCatalogEntry(ing.id)?.nameFr).toBe(ing.nameFr);
      expect(getDiscoverCatalogEntry(ing.id)?.nameFr).toBe(ing.nameFr);
    }
  });

  it('has matching defaultUnit for every id in both edge copies', () => {
    for (const ing of INGREDIENTS) {
      expect(getCatalogEntry(ing.id)!.defaultUnit).toBe(ing.defaultUnit);
      expect(getDiscoverCatalogEntry(ing.id)!.defaultUnit).toBe(ing.defaultUnit);
    }
  });

  it('CATALOG_ID_SET mirrors CATALOG_IDS', () => {
    expect(CATALOG_ID_SET.size).toBe(CATALOG_IDS.length);
    for (const id of CATALOG_IDS) expect(CATALOG_ID_SET.has(id)).toBe(true);
  });

  it('the two edge copies are structurally identical', () => {
    expect(DISCOVER_CATALOG).toEqual(CATALOG);
  });

  it('CATALOG entries expose no isPantryStaple flag (both copies)', () => {
    for (const entry of [...CATALOG, ...DISCOVER_CATALOG]) {
      expect(Object.keys(entry).sort()).toEqual([
        'category',
        'defaultUnit',
        'id',
        'name',
        'nameFr',
      ]);
    }
  });
});
