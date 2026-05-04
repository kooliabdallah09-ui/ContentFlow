-- Migration: Fix foreign key references to use auth.users directly
-- This migration updates all user_id foreign keys from public.profiles(id) to auth.users(id)

-- Drop existing foreign keys
ALTER TABLE public.brand_profiles DROP CONSTRAINT IF EXISTS brand_profiles_user_id_fkey;
ALTER TABLE public.content DROP CONSTRAINT IF EXISTS content_user_id_fkey;
ALTER TABLE public.content_calendar DROP CONSTRAINT IF EXISTS content_calendar_user_id_fkey;
ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_user_id_fkey;
ALTER TABLE public.content_analytics DROP CONSTRAINT IF EXISTS content_analytics_user_id_fkey;

-- Add new foreign keys to auth.users
ALTER TABLE public.brand_profiles
  ADD CONSTRAINT brand_profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.content
  ADD CONSTRAINT content_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.content_calendar
  ADD CONSTRAINT content_calendar_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.integrations
  ADD CONSTRAINT integrations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.content_analytics
  ADD CONSTRAINT content_analytics_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
