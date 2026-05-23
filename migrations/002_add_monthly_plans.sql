-- Monthly Plans Table
create table if not exists public.user_monthly_plans (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  month integer check (month >= 1 and month <= 12),
  year integer,
  plan_data jsonb,
  industry text,
  audience text,
  platforms text[],
  frequency text check (frequency in ('light', 'moderate', 'heavy')),
  status text check (status in ('draft', 'active', 'completed')) default 'active',
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(user_id, month, year)
);

-- Indexes for Monthly Plans
create index if not exists monthly_plans_user_id on public.user_monthly_plans(user_id);
create index if not exists monthly_plans_month_year on public.user_monthly_plans(month, year);
