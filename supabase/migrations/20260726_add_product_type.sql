-- Product Studio: distinguish physical products from app / website products.
-- product_type = 'physical' (default, existing rows) or 'app'.
-- website_url is only populated when product_type = 'app' and the user
-- entered a URL at creation time (still optional — screenshots-only is
-- valid too).

ALTER TABLE user_studio_products
  ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'physical',
  ADD COLUMN IF NOT EXISTS website_url TEXT;
