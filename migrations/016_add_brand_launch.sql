CREATE TABLE IF NOT EXISTS user_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  niche text NOT NULL DEFAULT '',
  niche_angle text,
  name text,
  logo_url text,
  colors jsonb DEFAULT '{}',
  voice jsonb DEFAULT '{}',
  products jsonb DEFAULT '[]',
  content jsonb DEFAULT '{}',
  wizard_step integer DEFAULT 1,
  status text DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_brands_user ON user_brands(user_id, created_at DESC);
