import {
  CATALOG,
  CATALOG_IDS,
  CATALOG_ID_SET,
  getCatalogEntry,
} from '../supabase/functions/extract-flyer/catalog';
import { INGREDIENTS } from '@/data/ingredients';

/**
 * The edge-function catalog is a hand-off copy of the app catalog. If they ever
 * drift, the model's enum + the validator would reject valid ids (or accept
 * stale ones). These tests are the guardrail.
 */
describe('edge catalog stays in sync with the app ingredient catalog', () => {
  it('covers exactly the same ids (all 70, including pantry staples)', () => {
    const appIds = INGREDIENTS.map((i) => i.id).sort();
    const edgeIds = [...CATALOG_IDS].sort();
    expect(edgeIds).toEqual(appIds);
    expect(CATALOG_IDS).toHaveLength(70);
  });

  it('has matching nameFr for every id', () => {
    for (const ing of INGREDIENTS) {
      const entry = getCatalogEntry(ing.id);
      expect(entry).toBeDefined();
      expect(entry!.nameFr).toBe(ing.nameFr);
    }
  });

  it('has matching defaultUnit for every id', () => {
    for (const ing of INGREDIENTS) {
      expect(getCatalogEntry(ing.id)!.defaultUnit).toBe(ing.defaultUnit);
    }
  });

  it('CATALOG_ID_SET mirrors CATALOG_IDS', () => {
    expect(CATALOG_ID_SET.size).toBe(CATALOG_IDS.length);
    for (const id of CATALOG_IDS) expect(CATALOG_ID_SET.has(id)).toBe(true);
  });

  it('CATALOG entries expose no isPantryStaple flag (id/name/nameFr/category/defaultUnit only)', () => {
    for (const entry of CATALOG) {
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
