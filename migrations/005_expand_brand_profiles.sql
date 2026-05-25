-- Expand brand_profiles table with additional onboarding fields
ALTER TABLE public.brand_profiles
ADD COLUMN IF NOT EXISTS product_type text,
ADD COLUMN IF NOT EXISTS unique_value_prop text,
ADD COLUMN IF NOT EXISTS brand_mission text,
ADD COLUMN IF NOT EXISTS customer_pain_points text,
ADD COLUMN IF NOT EXISTS brand_colors text,
ADD COLUMN IF NOT EXISTS posting_frequency text,
ADD COLUMN IF NOT EXISTS logo_url text;
