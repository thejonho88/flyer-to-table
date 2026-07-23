# Flyer to Table — Phase 1 Web MVP

Meal planning built around this week's local grocery flyer deals, with a
consolidated shopping list. Pilot market: Montreal. This is the **Phase 1 Web
MVP** (P0 scope), built on Expo + React Native Web so the same codebase can
target iOS/Android later.

> The flyer **discovery agent is mocked** (Phase 0 is unvalidated). All
> discovery code sits behind a swappable `DiscoveryAgent` interface with seeded
> Montreal data — the app runs fully offline on local mocks. No Supabase
> dependency is wired in yet; persistence sits behind adapters so a Supabase
> backend can drop in later.

## Stack

- **Expo SDK 57** + React Native + **React Native Web**, TypeScript (strict)
- **Expo Router** (file-based routing) — `app/`
- **zustand** for state; pure functions for all domain logic
- Persistence via `AsyncStorage` (localStorage on web) behind a
  `PersistenceAdapter`
- **jest / jest-expo** for unit tests of the domain logic

## Prerequisites

- Node 18+ and npm
- Dependencies are already installed (`node_modules/` present). If needed:
  `npm install`

## Run (development)

```bash
npm run web        # start the web app (primary target) at http://localhost:8081
npm run start      # start Metro; press w/i/a for web/iOS/Android
npm run ios        # iOS simulator (native targets are forward-looking)
npm run android    # Android emulator
```

Open the web app in a browser. First run drops you into onboarding:

1. **Postal code** — enter a Canadian postal code. Pilot market is Montreal, so
   **any `H`-prefixed postal code** returns seeded flyer data (try `H4A 2Z9` or
   `H2X 1Y4`). Any non-`H` postal code (e.g. `R3T 2N2`, `M5V 2T6`) deliberately
   triggers the loud **"No local flyers found"** failure state.
2. **Discovery** — a simulated agent streams progress (searching stores →
   fetching circulaires → extracting deals) with a progress bar and skeleton
   cards.
3. **Store selection** — pick which discovered stores to include.
4. **Preferences** — household size, dietary restrictions, max cook time,
   dinners/week, leftovers toggle, budget guidance.
5. Land on the **weekly meal plan**, generate a **shopping list**, and **swap**
   individual meals.

State persists to local storage, so a reload returns you to your plan.

## Test & typecheck

```bash
npm test           # jest unit tests (planner invariants + discovery agent)
npm run typecheck  # tsc --noEmit
```

## Static web export

```bash
npm run export:web # outputs a static site to ./dist
```

Serve `./dist` with any static host (e.g. `npx serve dist`).

## Project map

```
app/                         Expo Router routes
  _layout.tsx                root layout + state hydration gate
  index.tsx                  redirect: onboarding vs. home
  (app)/                     authenticated shell (sidebar + header)
    _layout.tsx  home.tsx  meal-plan.tsx  shopping-list.tsx  settings.tsx
  onboarding/                postal → discovery → stores → preferences
src/
  domain/                    pure, platform-free logic
    types.ts                 canonical contracts (single source of truth)
    filters.ts               hard-constraint predicates (never violated)
    costing.ts               pricing resolver, per-meal cost, servings scaling
    planner.ts               generatePlan / getSwapAlternatives / applySwap
    shoppingList.ts          buildShoppingList (dedupe, grouping, staples out)
    context.ts  dates.ts  postal.ts
  data/                      seeded catalogs
    ingredients.ts           ingredient catalog + pantry staples
    pricing.ts               base regular prices per ingredient
    deals.ts                 seeded Montreal stores + deals, keyed by FSA
    recipes.ts               ~29 recipes with guaranteed constraint coverage
  services/                  swappable adapters (mock now, Supabase later)
    MockDiscoveryAgent.ts    DiscoveryAgent impl (progress, cache, loud fail)
    LocalRecipeSource.ts     RecipeSource impl
    LocalPersistenceAdapter.ts / storage.ts
    share.ts                 Web Share / clipboard export
  state/                     zustand stores + bootstrap hydration
  ui/                        shared primitives (Button, Chip, Badge, Stepper,
                             SegmentedSlider, Toggle, Checkbox, Modal, Drawer…)
  components/                app shell + feature components
  screens/                   MealPlan / ShoppingList / Settings screens
  theme/tokens.ts            green/white design tokens
__tests__/                   jest tests
```

## Non-negotiable product rules enforced

- **Pantry staples** (salt, pepper, spices, oil) are excluded from the shopping
  list and cost estimate by default — enforced in `costing.ts` and covered by
  tests.
- **Dietary restrictions and max cook time are hard constraints** — never
  violated in any generated or swapped plan (`filters.ts`, tested across every
  restriction × cook-time combination).
- **Discovery always shows visible progress and fails loudly** ("no local
  flyers found") for unseeded areas — never silently.

## Swapping in a real backend later

- Replace `MockDiscoveryAgent` with a live `DiscoveryAgent` implementation.
- Replace `LocalPersistenceAdapter` with a Supabase-backed `PersistenceAdapter`.
- Replace `LocalRecipeSource` with a remote `RecipeSource`.

Nothing in `domain/`, `state/`, or the UI needs to change — they depend only on
the interfaces in `src/domain/types.ts`.
