# Devlog — Flyer to Table

Newest entries first. One entry per completed task/change set.

## 2026-07-23 — Real Claude-backed flyer extractor (Phase 0.5, first half)
- MockFlyerExtractor swapped for the real thing: new `extract-flyer` Supabase edge function (deployed, v3) runs claude-opus-4-8 with structured outputs over the uploaded PDF/PNG/JPEG — French-fluent prompt embeds the 70-ingredient catalog, ingredientId constrained to catalog ids via schema enum.
- Model output is never trusted raw: server-side validator (Jest-tested, shared pure module) drops unknown ids, clamps sale ≤ regular, falls back regular=sale (no invented savings), converts Quebec per-100g fish pricing to the app's per-gram convention (÷100, deterministic — found live when salmon came back 100× high), rounds to 4 decimals, defaults dates to the Mon–Sun week, dedupes per ingredient keeping cheapest, stamps id/storeId/provenance:'extracted'. Empty after filtering → loud `no_deals_found`.
- Client `RemoteFlyerExtractor` behind the existing FlyerExtractor seam: blob→base64, POST with anon key, synthetic progress ramp, 180s timeout, 10MB fail-fast, error-reason mapping. Env-driven factory (`EXPO_PUBLIC_SUPABASE_URL/_ANON_KEY`) picks remote; Jest and no-env builds keep the mock. Browser-only bug found in live verification: unbound `fetch` throws "Illegal invocation" — fixed with `fetch.bind(globalThis)` (mock-based tests can't catch this class of bug).
- Accumulating French label→ingredient dictionary is live: new `label_mappings` table (RLS on, service-role only), fire-and-forget upsert after each successful extraction — 9 mappings recorded from the first real run.
- Verified end-to-end: curl with a generated French Super C flyer (9/9 food deals, detergent skipped, flyer dates parsed, ~10–19s) AND full in-browser flow (drop → visible progress → confirm/edit panel → apply → overlay persisted, seeded Super C deals replaced with provenance 'extracted').
- Tests: 67 → 96. Pipeline: scoper → code-builder → reviewer (pass; reviewer's one minor finding — client-side size pre-check — applied).
- Deployed site now uses the real extractor (deploy.yml exports the public Supabase config at export time).

## 2026-07-23 — "Add a store" from the Shopping List
- Requested: a way to add an area store directly from the Shopping List (previously onboarding-only).
- Dashed "Add a store" row after the last store group → modal listing addable chains (shared `addableChains` helper with onboarding) → `addStoreAndSelect` appends the store's deals AND persists it into selected stores (without which pricing ignores it — scoper caught this).
- Fixed a real reactivity bug: the list memo never recomputed after store changes (deps didn't subscribe to discovery/prefs state). Verified live: adding Walmart re-routed Bell Peppers to its cheaper sale price instantly ($9.60 → $7.12).
- Plan totals intentionally stay as-generated; transient banner suggests regenerating. Checklist state preserved for non-re-routed rows.
- Tests +7 (addStoreFromList.test.ts). Pipeline: scoper → code-builder → reviewer. Reviewer flagged working-tree entanglement with the parallel discover-deals session's uncommitted edits — resolved by surgically committing only this feature's hunks (the import-swap hunk and parallel files stay uncommitted for that session to land).

## 2026-07-23 — Supabase provisioned (setup)
- Project "Flyer 2 Table" created (ref dnkzhrladfjuyvwnhxrb); ANTHROPIC_API_KEY set as an Edge Function secret (dashboard-verified); Supabase MCP added to project config and OAuth-authenticated; official Supabase agent skills installed.
- Everything is staged for Phase 0.5 (real Claude-backed FlyerExtractor) — build starts in the next session, where the MCP tools load.

## 2026-07-23 — "Bring Your Own Flyer" hybrid discovery (MVP upload path)
- Product decision (brainstormed): sidestep scraping/legal entirely for the pilot — user downloads their own weekly flyer (per-store links) and uploads it (PDF/PNG/JPG); extraction behind a new swappable `FlyerExtractor` seam. Mock extractor ships now; real Claude extraction arrives via Supabase edge function later (API key can't live in a static site).
- New onboarding step 4 of 5 "Bring Your Own Flyer": per-store download links, drag-and-drop upload slots, per-file progress + loud failures, confirm/edit panel (editable sale price clamped ≤ regular, include toggles, remove) before deals apply. Upload always optional — demo prices remain the fallback.
- Uploaded deals REPLACE that store's seeded deals, persist via a separately-versioned overlay (`ftt:flyerOverlay:v1`), and survive reload + forced re-discovery (never silently dropped). Deal provenance tracked (seeded/extracted/edited) — doubles as labeled data for measuring real extraction quality later.
- Verified in-browser end-to-end: drop → confirm → apply → v2 cache shows replaced deals, clamp enforced, overlay persisted without blob URIs.
- Tests: 55 → 67. Pipeline: scoper → code-builder → reviewer (pass, zero findings).
- Next: Supabase project + Anthropic API key → swap MockFlyerExtractor for the real Claude-backed edge function.

## 2026-07-23 — Phase 0 flyer-discovery spike (Montreal) — COMPLETE
- Ran the Montreal data-sourcing spike (research, not code): 6 parallel research agents — one per chain plus aggregators/legal.
- **Exit criteria MET**: all 5 target chains have structured/semi-structured weekly data (well past the 3-of-5 bar). Scores: IGA 4/5, Metro/Super C/Provigo/Maxi 3/5, Walmart 2/5.
- Key findings: data is more structured than feared (JSON APIs / HTML price attributes, not just images); French fully solved (all bilingual + Claude fluent); uniform Thu–Wed cadence. Real obstacles are bot protection (Akamai/Cloudflare/PerimeterX) and uniform "personal, non-commercial use" ToS (gray zone under Canadian browsewrap case law — needs a legal read before production).
- **Decision: Flipp-first hybrid.** Pilot sources real data via a managed Flipp aggregator scraper (Apify, ~$5/1k results, covers all 6 chains, one schema); Claude extraction stays for PDF fallback + French label→ingredient mapping (accumulating dictionary in Postgres); send Flipp NativeX partnership inquiry; keep per-retailer scraping as documented fallback.
- Full writeup: `Reference Files/phase0-flyer-discovery-findings.md` (kept private, not in public repo).
- Resolves the "Flyer data sourcing approach" open question. Unblocks Phase 0.5 (real DiscoveryAgent + Supabase).

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
- **Phase 0 flyer-discovery spike: DONE (2026-07-23)** — decision is Flipp-first hybrid; see the dated entry above and `Reference Files/phase0-flyer-discovery-findings.md`.
- **Phase 0.5 — real DiscoveryAgent: HALF done (2026-07-23)** — the Claude extraction half is live (see the "Real Claude-backed flyer extractor" entry): uploads now produce real deals, and the label→ingredient dictionary is accumulating in Postgres. Remaining half: wire Flipp/Apify fetch behind the DiscoveryAgent interface + shared deal cache, so real Montreal prices arrive WITHOUT the user uploading anything. Store discovery itself is still mocked.
- Get a legal read on the chains' "personal, non-commercial use" terms before production scale-up.
- Business model decision (needed before Phase 2 monetization work).
- Recipe database: build vs license decision.
- Real recipe images (placeholder art currently).
- Packaging-aware quantity display (e.g. "10 bunch broccoli" reads oddly for large households).
