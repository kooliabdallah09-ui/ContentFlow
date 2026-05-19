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

-- User Credits
create table public.user_credits (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade unique,
  balance integer default 0,
  plan text default 'free' check (plan in ('free', 'starter', 'pro', 'agency')),
  monthly_credits integer default 50,
  reset_date timestamp,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Credit Transactions
create table public.credit_transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  amount integer,
  transaction_type text check (transaction_type in ('generation', 'purchase', 'refund', 'monthly_reset', 'bonus')) default 'generation',
  content_type text,
  related_content_id uuid references public.content(id) on delete set null,
  description text,
  created_at timestamp default now()
);

-- Credit Pricing (cost per generation type)
create table public.credit_pricing (
  id uuid default uuid_generate_v4() primary key,
  content_type text unique check (content_type in ('blog', 'social', 'email', 'image', 'video', 'voice')),
  base_cost integer,
  description text,
  updated_at timestamp default now()
);

-- UGC Content (User Generated Content - Images, Videos, etc)
create table public.ugc_content (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  content_type text check (content_type in ('image', 'video', 'voice')),
  title text,
  description text,
  source_api text,
  external_id text,
  storage_url text,
  metadata jsonb default '{}'::jsonb,
  credit_cost integer,
  status text check (status in ('generating', 'completed', 'failed')) default 'generating',
  error_message text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Create indexes
create index content_user_id on public.content(user_id);
create index calendar_user_id on public.content_calendar(user_id);
create index integrations_user_id on public.integrations(user_id);
create index brand_user_id on public.brand_profiles(user_id);
create index analytics_user_id on public.content_analytics(user_id);
create index analytics_content_id on public.content_analytics(content_id);
create index analytics_platform on public.content_analytics(platform);
create index user_credits_user_id on public.user_credits(user_id);
create index credit_transactions_user_id on public.credit_transactions(user_id);
create index credit_transactions_type on public.credit_transactions(transaction_type);
create index ugc_content_user_id on public.ugc_content(user_id);
create index ugc_content_type on public.ugc_content(content_type);
