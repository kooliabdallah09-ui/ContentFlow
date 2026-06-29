-- YouTube Publish Queue
-- Run this in Supabase SQL Editor

create table if not exists youtube_publish_queue (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  calendar_date   date,                      -- links back to the calendar day (e.g. 2026-07-01)
  video_url       text not null,             -- Supabase storage or any public URL
  title           text not null,
  description     text not null default '',
  tags            text[] not null default '{}',
  privacy         text not null default 'public' check (privacy in ('public','unlisted','private')),
  scheduled_at    timestamptz not null,      -- exact UTC datetime to publish
  status          text not null default 'queued' check (status in ('queued','uploading','published','failed')),
  yt_video_id     text,                      -- filled after successful publish
  yt_video_url    text,                      -- e.g. https://youtu.be/abc123
  error_message   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Index for the cron job: quickly find due queued items
create index if not exists idx_yt_queue_status_scheduled
  on youtube_publish_queue (status, scheduled_at)
  where status = 'queued';

-- Index for per-user lookups
create index if not exists idx_yt_queue_user_id
  on youtube_publish_queue (user_id, scheduled_at desc);

-- Auto-update updated_at
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists yt_queue_updated_at on youtube_publish_queue;
create trigger yt_queue_updated_at
  before update on youtube_publish_queue
  for each row execute function update_updated_at_column();

-- RLS: users can only see their own queue
alter table youtube_publish_queue enable row level security;

create policy "Users manage their own queue"
  on youtube_publish_queue for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
