# Devlog — Flyer to Table

Newest entries first. One entry per completed task/change set.

## 2026-07-23 — Unit model (kg/lb), CAD currency, flyer corroboration links
- Proper mass-unit domain model (`g`/`kg`/`lb`, 1 lb = 453.592 g): meats now seeded and displayed per-lb like real Quebec flyers ($8.99/lb · $19.82/kg dual display), fish keep per-100 g convention.
- Fixed a latent bug: cost math multiplied quantity × unit price with no unit check; deal comparison now normalizes per-gram so mixed-unit deals compare like-for-like.
- All money rendering goes through one CAD formatter (en-CA); "All prices in CAD" notes on shopping list, specials modal, and share export.
- Store specials modal deals link out to the chain's real public flyer page (superc.ca, metro.ca, iga.net, provigo.ca, maxi.ca, loblaws.ca, walmart.ca) for visual price corroboration; "View full flyer" footer button.
- Discovery cache bumped to v2 so stale old-unit deals can't mix with new math.
- Follow-up fix (found in browser verification): "Generate Meal Plan" silently no-op'd when discovery data was missing (expired/invalidated cache); now routes into the visible discovery flow instead.
- Tests: 39 → 55. Recovery flow verified in browser (dead button now re-runs discovery; added stores re-merge correctly).

## 2026-07-23 — Four UI enhancements (pushed: 827526e)
- Onboarding step dots are tappable with flanking left/right arrows; unreachable steps gated on real state; transient discovery step skipped.
- "Add more stores" on Select Stores: full chain catalog incl. new Loblaws and Walmart chains, each with seeded deals; added stores persist and survive re-discovery.
- Shopping list store names open a "This week's flyer specials" modal (sale vs regular, discount %, validity, sorted by depth).
- Per-unit cost shown on every shopping list row (per-100 g for gram-priced items).
- Tests: 21 → 39.

## 2026-07-23 — GitHub + live deployment
- Public repo github.com/thejonho88/flyer-to-table (Reference Files/ deliberately excluded — product spec stays private).
- GitHub Actions workflow: on push to main → run tests → Expo static export → deploy to GitHub Pages.
- Live at https://thejonho88.github.io/flyer-to-table/
- Standing rule adopted: after each completed change set, commit + push (auto-redeploys).

## 2026-07-23 — Montreal-wide postal coverage (pushed: efb918e, amended)
- Any H-prefix FSA now resolves to seeded flyer data (deterministic hash onto 5 seeded areas, per-FSA distance jitter); pilot user's H4A 2Z9 verified working.
- Non-H postal codes still hit the loud "No local flyers found" state.
- Tests: 18 → 21.

## 2026-07-22 — Phase 1 Web MVP built (pushed: efb918e)
- Full P0 scope on Expo + React Native Web + TypeScript: postal entry → mock discovery agent (progress events, 7-day cache, loud failure) → store selection → preferences (hard dietary/cook-time constraints, leftovers scaling) → sale-weighted 5–7 dinner plan → per-store shopping list (staples excluded by default) → single-meal swap.
- All external dependencies behind swappable interfaces (DiscoveryAgent, RecipeSource, PersistenceAdapter) — Supabase and the real discovery agent slot in later without touching the planner/UI.
- 29 seeded recipes (guaranteed coverage for strictest constraint combos), 5 seeded Montreal chains, CAD mock pricing.
- 18 unit tests; pipeline: scoper → code-builder → reviewer (passed).

## Backlog / not done
- **Phase 0 flyer-discovery spike (Montreal): NOT started** — the highest-risk open question. All flyer data is still mocked.
- Business model decision (needed before Phase 2 monetization work).
- Recipe database: build vs license decision.
- Real recipe images (placeholder art currently).
- Packaging-aware quantity display (e.g. "10 bunch broccoli" reads oddly for large households).
