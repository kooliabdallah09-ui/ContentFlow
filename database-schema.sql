-- Enable auth
create extension if not exists "uuid-ossp";

-- Users table (Supabase auth_users already exists)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text unique,
  full_name text,
  created_at timestamp default now()
);

-- Brand profiles
create table public.brand_profiles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  company_name text,
  description text,
  target_audience text,
  tone_of_voice text,
  voice_samples text[],
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Content
create table public.content (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  content_type text check (content_type in ('blog', 'social', 'email', 'website', 'ads')),
  title text,
  body text,
  metadata jsonb default '{}'::jsonb,
  published boolean default false,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Content calendar
create table public.content_calendar (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  content_id uuid references public.content(id) on delete cascade,
  scheduled_date timestamp,
  published_date timestamp,
  platforms text[] default '{}',
  status text check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed')) default 'scheduled',
  error_message text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Integrations
create table public.integrations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  platform text,
  access_token text,
  refresh_token text,
  connected_at timestamp default now()
);

-- Content Analytics
create table public.content_analytics (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  content_id uuid references public.content(id) on delete cascade,
  platform text,
  views integer default 0,
  clicks integer default 0,
  shares integer default 0,
  comments integer default 0,
  likes integer default 0,
  impressions integer default 0,
  engagement_rate decimal default 0,
  fetched_at timestamp default now(),
  created_at timestamp default now()
);

-- Create indexes
create index content_user_id on public.content(user_id);
create index calendar_user_id on public.content_calendar(user_id);
create index integrations_user_id on public.integrations(user_id);
create index brand_user_id on public.brand_profiles(user_id);
create index analytics_user_id on public.content_analytics(user_id);
create index analytics_content_id on public.content_analytics(content_id);
create index analytics_platform on public.content_analytics(platform);
