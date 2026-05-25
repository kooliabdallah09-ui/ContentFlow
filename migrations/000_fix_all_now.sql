-- Drop the problematic FK constraint
ALTER TABLE public.brand_profiles DROP CONSTRAINT IF EXISTS brand_profiles_user_id_fkey;

-- Re-add pointing to auth.users (correct target)
ALTER TABLE public.brand_profiles
  ADD CONSTRAINT brand_profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Also fix other tables in case they have the same issue
ALTER TABLE public.content DROP CONSTRAINT IF EXISTS content_user_id_fkey;
ALTER TABLE public.content ADD CONSTRAINT content_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_monthly_plans DROP CONSTRAINT IF EXISTS user_monthly_plans_user_id_fkey;
ALTER TABLE public.user_monthly_plans ADD CONSTRAINT user_monthly_plans_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add unique constraint on brand_profiles.user_id (needed for upsert)
ALTER TABLE public.brand_profiles DROP CONSTRAINT IF EXISTS brand_profiles_user_id_unique;
ALTER TABLE public.brand_profiles ADD CONSTRAINT brand_profiles_user_id_unique UNIQUE (user_id);

-- Add new columns for extended brand info
ALTER TABLE public.brand_profiles
  ADD COLUMN IF NOT EXISTS product_type text,
  ADD COLUMN IF NOT EXISTS unique_value_prop text,
  ADD COLUMN IF NOT EXISTS brand_mission text,
  ADD COLUMN IF NOT EXISTS customer_pain_points text,
  ADD COLUMN IF NOT EXISTS brand_colors text,
  ADD COLUMN IF NOT EXISTS posting_frequency text,
  ADD COLUMN IF NOT EXISTS logo_url text;
