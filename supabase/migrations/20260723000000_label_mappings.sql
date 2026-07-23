-- label_mappings: learned French-flyer-label -> catalog-ingredient associations,
-- written best-effort by the extract-flyer edge function (service role only).
-- Feeds future extraction heuristics. Service-role writes only; RLS on, no
-- policies, so the anon/authenticated roles have no access.
create table public.label_mappings (
  id bigint generated always as identity primary key,
  label_fr text not null,
  ingredient_id text not null,
  chain text not null,
  confidence real,
  created_at timestamptz default now(),
  unique (label_fr, ingredient_id, chain)
);

alter table public.label_mappings enable row level security;
