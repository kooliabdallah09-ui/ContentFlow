create table if not exists mcp_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists mcp_api_keys_user_idx on mcp_api_keys (user_id);
create index if not exists mcp_api_keys_hash_idx on mcp_api_keys (key_hash) where revoked_at is null;
