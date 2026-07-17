-- Product Studio: persistent products with multi-angle reference photos
-- (the "product sheet") and an AI-generated aesthetic photo gallery.

CREATE TABLE IF NOT EXISTS user_studio_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,                       -- drink / candy / skincare / apparel…
  description text,                    -- what it is, 1-2 sentences
  appearance_prompt text NOT NULL,     -- canonical visual description for image models
  photo_urls jsonb NOT NULL DEFAULT '[]'::jsonb,  -- uploaded reference angles
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_studio_product_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES user_studio_products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept text NOT NULL,               -- short label of the shot concept (variety tracking)
  prompt text,                         -- full prompt used
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_studio_products_user ON user_studio_products(user_id, last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_product_photos ON user_studio_product_photos(product_id, created_at DESC);
