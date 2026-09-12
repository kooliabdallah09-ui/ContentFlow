-- Per-product B-roll cache.
--
-- Real UGC cuts away to the product constantly; a single continuous
-- talking-head shot is the most obvious tell that an ad is AI. This table
-- holds short product cutaways that get overlaid into finished UGC videos.
--
-- Clips are generated LAZILY (the first ad that needs a cutaway makes one) and
-- reused across every later ad for that product, so the library fills up as a
-- side effect of making ads rather than costing a batch upfront.
--
-- `source` distinguishes the cheap path from the expensive one:
--   kenburns — a Shotstack pan/zoom over an existing product still. No model
--              cost at all, which is why it's the default.
--   seedance — generated motion video. Reserved for cases where the still
--              version reads poorly.

CREATE TABLE IF NOT EXISTS user_product_brolls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES user_studio_products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'kenburns',       -- kenburns | seedance
  clip_url text NOT NULL,
  source_image_url text,                          -- still the clip was built from
  motion text,                                    -- zoomIn / zoomOut / slideLeft…
  duration_seconds numeric NOT NULL DEFAULT 1.5,
  -- Rotation: prefer the least-recently-used clip so consecutive ads for the
  -- same product don't reuse the same cutaway.
  use_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_brolls_pick
  ON user_product_brolls(product_id, last_used_at NULLS FIRST, created_at);

CREATE INDEX IF NOT EXISTS idx_product_brolls_user
  ON user_product_brolls(user_id, created_at DESC);

ALTER TABLE user_product_brolls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own product brolls"   ON user_product_brolls;
DROP POLICY IF EXISTS "Users insert their own product brolls" ON user_product_brolls;
DROP POLICY IF EXISTS "Users update their own product brolls" ON user_product_brolls;
DROP POLICY IF EXISTS "Users delete their own product brolls" ON user_product_brolls;
CREATE POLICY "Users read their own product brolls"   ON user_product_brolls FOR SELECT USING  (auth.uid() = user_id);
CREATE POLICY "Users insert their own product brolls" ON user_product_brolls FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own product brolls" ON user_product_brolls FOR UPDATE USING  (auth.uid() = user_id);
CREATE POLICY "Users delete their own product brolls" ON user_product_brolls FOR DELETE USING  (auth.uid() = user_id);
