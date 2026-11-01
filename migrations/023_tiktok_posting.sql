-- TikTok Direct Post: token expiry + avatar on integrations, and a log of posts.

alter table integrations add column if not exists access_expires_at  timestamptz;
alter table integrations add column if not exists refresh_expires_at timestamptz;
alter table integrations add column if not exists avatar_url         text;

create table if not exists social_posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  content_id  uuid not null,
  platform    text not null,
  publish_id  text,
  status      text not null default 'processing',  -- processing | published | failed
  fail_reason text,
  privacy     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists social_posts_user_content on social_posts (user_id, content_id);

alter table social_posts enable row level security;
drop policy if exists "Users read their own posts" on social_posts;
create policy "Users read their own posts" on social_posts for select using (auth.uid() = user_id);
-- Writes happen only from API routes with the service role.
