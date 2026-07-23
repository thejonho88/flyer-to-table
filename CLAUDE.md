# Flyer to Table

Meal-planning app that pulls local grocery flyer deals and generates weekly meal plans built around what's on sale, with a consolidated shopping list. Pilot market: Montreal.

## Reference documents — consult before implementing features
- `Reference Files/meal-plan-app-spec.md` — full product spec (P0/P1/P2 requirements, acceptance criteria, success metrics)
- `Reference Files/context.md` — roadmap, phasing (Phase 0–3), current status, open questions
- `Reference Files/F2T_WebUX.pdf` — web UX mockups (sidebar dashboard, meal plan grid, preferences drawer, shopping list)
- `Reference Files/Flyer2Table_mobileUX.pdf` — mobile UX mockups (onboarding funnel: zip → discovery → store selection → preferences → plan → swap → cost → list). Mockups use placeholder branding "TablePlan"; the real product name is Flyer to Table.

## Tech stack
- Client: React Native + React Native Web (Expo), shared codebase for web/iOS/Android. Web ships first.
- Backend: Supabase (Postgres, auth, storage, edge functions)
- Discovery agent runs server-side, never on-device

## Current phase
Phase 1 (Web MVP, P0 scope only). Phase 0 (Montreal flyer-discovery spike) has NOT been completed — the real discovery agent is unvalidated. All discovery-agent code must sit behind a swappable interface with mock/seeded Montreal data until the spike resolves the data-sourcing question.

## Non-negotiable product rules
- Pantry staples (salt, pepper, basic spices, oil) are excluded from shopping list and cost estimates BY DEFAULT. Do not let scope cuts remove this.
- Dietary restrictions are hard constraints — no suggested recipe may violate them.
- The discovery flow must always show visible progress, and must fail loudly ("no local flyers found"), never silently.
- Keep the web build working even after native targets exist.
- Montreal context: postal codes (not US zips), French-first flyer content ("circulaires"), target chains Metro / IGA / Provigo / Maxi / Super C / Walmart Canada.
