-- Content Intelligence Engine — 3 tables + RLS

create table if not exists user_intelligence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  niche text not null,
  product_description text,
  product_type text,
  audience_profile jsonb not null default '{}'::jsonb,
  goal text not null,
  trend_keywords text[] default array[]::text[],
  niche_subreddits text[] default array[]::text[],
  preferred_platforms text[] default array['tiktok','instagram']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists content_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  plan_data jsonb not null default '{}'::jsonb,
  top_formats jsonb not null default '[]'::jsonb,
  hooks jsonb not null default '{}'::jsonb,
  calendar_30d jsonb not null default '[]'::jsonb,
  trend_snapshot jsonb not null default '{}'::jsonb,
  trending_hashtags text[] default array[]::text[],
  refresh_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists trend_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text unique not null,
  data jsonb not null default '{}'::jsonb,
  cached_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists trend_cache_expires_idx on trend_cache (expires_at);

alter table user_intelligence enable row level security;
alter table content_plans enable row level security;
alter table trend_cache enable row level security;

drop policy if exists "own intelligence" on user_intelligence;
create policy "own intelligence" on user_intelligence
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own plans" on content_plans;
create policy "own plans" on content_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- trend_cache is server-only (service role writes it) — no user policy needed
