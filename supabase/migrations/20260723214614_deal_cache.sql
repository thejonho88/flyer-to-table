-- deal_cache: shared, cross-user cache of a discovery run's result, written by
-- the discover-deals edge function (service role only). Keyed by FSA (first 3
-- chars of the postal code, upper-cased) + the Thursday that starts the current
-- Thu–Wed flyer week, so every user in a sortation area shares one live fetch
-- for the week. RLS on, no policies: the anon/authenticated roles have no
-- access; only the service role (which bypasses RLS) reads/writes it.
create table public.deal_cache (
  postal_area text not null,
  week_of date not null,
  result jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (postal_area, week_of)
);

alter table public.deal_cache enable row level security;
