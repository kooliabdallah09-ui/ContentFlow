-- Influencer Studio: persistent AI characters with an identity sheet,
-- a canonical portrait, and a photo gallery. Gated to admin accounts.

CREATE TABLE IF NOT EXISTS user_influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  handle text,                        -- @style social handle, generated
  bio text,                           -- 1-2 sentence public-facing bio
  personality text,                   -- vibe notes used in prompts
  niche text,                         -- what they post about
  appearance_prompt text NOT NULL,    -- canonical Nano Banana identity prompt
  portrait_url text NOT NULL,         -- canonical face reference image
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_influencer_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES user_influencers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scene text NOT NULL,                -- the scene description used
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_influencers_user ON user_influencers(user_id, last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_influencer_photos ON user_influencer_photos(influencer_id, created_at DESC);
