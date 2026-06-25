-- Add pack_credits column to track one-time purchased credits separately
-- from monthly subscription credits. This allows renewals to reset only
-- the monthly portion while preserving pack credits.

alter table public.user_credits
  add column if not exists pack_credits integer not null default 0;

-- Backfill: for existing users, estimate pack_credits as any balance
-- above their monthly_credits allowance (best approximation we can do
-- without historical data).
update public.user_credits
  set pack_credits = greatest(0, balance - monthly_credits);
