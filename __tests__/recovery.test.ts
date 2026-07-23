import type { PlanPreferences } from '@/domain/types';
import { recoveryRouteFor } from '@/domain/recovery';

function prefs(overrides: Partial<PlanPreferences> = {}): PlanPreferences {
  return {
    postalCode: 'H2X 1Y4',
    selectedStoreIds: [],
    householdSize: 4,
    dietaryRestrictions: [],
    maxCookTimeMinutes: null,
    leftoversForLunch: false,
    dinnersPerWeek: 7,
    ...overrides,
  };
}

describe('recoveryRouteFor', () => {
  it('re-runs discovery when a saved postal code exists', () => {
    expect(recoveryRouteFor(prefs())).toBe('/onboarding/discovery');
  });

  it('falls back to postal entry when there is no postal code', () => {
    expect(recoveryRouteFor(prefs({ postalCode: '' }))).toBe('/onboarding/postal');
    expect(recoveryRouteFor(null)).toBe('/onboarding/postal');
  });
});
