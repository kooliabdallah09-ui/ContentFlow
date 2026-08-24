-- Page visits tracking table for the /admin/visits panel. Every non-admin,
-- non-api pageview writes one row. Owner reads via the admin-only API.
-- RLS: nobody reads directly; the API endpoint uses the service-role key.

create table if not exists page_visits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ip text,
  path text not null,
  referrer text,
  user_agent text,
  country text,
  city text,
  device text,   -- Mac / iPhone / Android / Windows / …
  browser text   -- Chrome / Safari / Firefox / …
);

create index if not exists page_visits_created_idx on page_visits (created_at desc);
create index if not exists page_visits_ip_idx on page_visits (ip);
create index if not exists page_visits_path_idx on page_visits (path);

alter table page_visits enable row level security;
-- No policies — only the service-role key can read/write. Client never
-- touches this table directly.
