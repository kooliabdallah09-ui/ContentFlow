create table if not exists data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  confirmation_code text unique not null,
  provider text not null,
  provider_user_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','completed','failed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text
);

create index if not exists data_deletion_requests_provider_user_idx
  on data_deletion_requests (provider, provider_user_id);
