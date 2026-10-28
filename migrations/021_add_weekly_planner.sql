-- Content Planner: a weekly plan of posts (UGC video, carousel, image) the user
-- approves, edits and generates one by one. Nothing here spends credits; credits
-- are only taken by the existing generators when the user presses Generate.

CREATE TABLE IF NOT EXISTS weekly_plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  week_start       date NOT NULL,                       -- Monday of the planned week
  product_name     text NOT NULL,
  product_description text NOT NULL DEFAULT '',
  goal             text NOT NULL DEFAULT 'sales',       -- sales | awareness | launch
  platforms        text[] NOT NULL DEFAULT '{}',
  posts_per_week   integer NOT NULL DEFAULT 5,
  credits_at_plan  integer,                             -- balance when the plan was built
  status           text NOT NULL DEFAULT 'draft',       -- draft | approved

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weekly_plans_user
  ON weekly_plans (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS weekly_plan_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  position    integer NOT NULL,
  day_offset  integer NOT NULL,                         -- 0 = Monday of week_start
  time_of_day text NOT NULL DEFAULT '18:00',            -- local time, HH:MM
  platform    text NOT NULL,
  kind        text NOT NULL,                            -- video | carousel | image
  format      text NOT NULL,                            -- the proven format being copied
  stage       text NOT NULL,                            -- attention | trust | sale
  hook        text NOT NULL,
  alts        jsonb NOT NULL DEFAULT '[]'::jsonb,       -- other hook options
  visual      text NOT NULL DEFAULT '',                 -- the first frame / the idea
  duration_s  integer,                                  -- videos only
  quality     text NOT NULL DEFAULT 'full',             -- videos only: draft | full
  slides      integer,                                  -- carousels only
  enabled     boolean NOT NULL DEFAULT true,

  status      text NOT NULL DEFAULT 'idle',             -- idle | generating | ready | failed
  result      jsonb,                                    -- what the generator returned
  is_winner   boolean NOT NULL DEFAULT false,           -- marked after posting

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weekly_plan_items_plan ON weekly_plan_items (plan_id, position);
-- Hooks that worked, for reuse.
CREATE INDEX IF NOT EXISTS idx_weekly_plan_items_winners ON weekly_plan_items (user_id) WHERE is_winner;

ALTER TABLE weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_plan_items    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own plans"   ON weekly_plans;
DROP POLICY IF EXISTS "Users insert their own plans" ON weekly_plans;
DROP POLICY IF EXISTS "Users update their own plans" ON weekly_plans;
DROP POLICY IF EXISTS "Users delete their own plans" ON weekly_plans;
CREATE POLICY "Users read their own plans"   ON weekly_plans FOR SELECT USING  (auth.uid() = user_id);
CREATE POLICY "Users insert their own plans" ON weekly_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own plans" ON weekly_plans FOR UPDATE USING  (auth.uid() = user_id);
CREATE POLICY "Users delete their own plans" ON weekly_plans FOR DELETE USING  (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read their own plan items"   ON weekly_plan_items;
DROP POLICY IF EXISTS "Users insert their own plan items" ON weekly_plan_items;
DROP POLICY IF EXISTS "Users update their own plan items" ON weekly_plan_items;
DROP POLICY IF EXISTS "Users delete their own plan items" ON weekly_plan_items;
CREATE POLICY "Users read their own plan items"   ON weekly_plan_items FOR SELECT USING  (auth.uid() = user_id);
CREATE POLICY "Users insert their own plan items" ON weekly_plan_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own plan items" ON weekly_plan_items FOR UPDATE USING  (auth.uid() = user_id);
CREATE POLICY "Users delete their own plan items" ON weekly_plan_items FOR DELETE USING  (auth.uid() = user_id);
