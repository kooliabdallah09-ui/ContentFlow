-- Adds a `products` JSONB column to brand_profiles so a single brand can hold
-- multiple products (t-shirt brand, etc.). Schema for each product entry:
--   { id: string, name: string, image_url: string | null, created_at: string }
-- We pick JSONB instead of a separate table to keep queries simple and avoid
-- joining on every UGC build — the brand profile is loaded as one row anyway.
--
-- Run this once in the Supabase SQL editor.

ALTER TABLE brand_profiles
  ADD COLUMN IF NOT EXISTS products JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill from the existing logo_url so users who already saved a single
-- product photo keep it as their first product entry.
UPDATE brand_profiles
SET products = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'name', COALESCE(company_name, 'Product'),
    'image_url', logo_url,
    'created_at', NOW()::text
  )
)
WHERE logo_url IS NOT NULL
  AND logo_url <> ''
  AND (products IS NULL OR jsonb_array_length(products) = 0);
