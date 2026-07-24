-- Campaign Planner — one product + one brief → Sonnet-generated shot table.
-- The user reviews the table (inline-editable), ticks the shots they want,
-- and clicks Generate. Each row fans out to an existing generator
-- (UGC video, hero image, product photo, interview two-person, etc.).

CREATE TABLE IF NOT EXISTS user_campaigns (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  brief           text,                     -- the user's freeform prompt
  product_id      uuid,                     -- brand_products.id — one product per campaign
  goal            text,                     -- launch | awareness | conversion | evergreen
  duration_label  text,                     -- '1 week' | '2 weeks' | '1 month'
  status          text not null default 'planned',   -- planned | generating | done | archived
  meta            jsonb not null default '{}'::jsonb, -- trends payload, cost totals, etc.
  created_at      timestamptz default now()
);

CREATE INDEX IF NOT EXISTS user_campaigns_user_id_idx ON user_campaigns(user_id);

CREATE TABLE IF NOT EXISTS user_campaign_shots (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references user_campaigns(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  position        int not null,                 -- 1..N, sort order in the table
  format_key      text not null,                -- must match a lib/formats.ts id
  pipeline        text not null,                -- ugc-video | product-photo | hero-image | interview
  spec            jsonb not null default '{}'::jsonb,
  -- spec fields (all optional):
  --   aspect, duration, hook, caption, setting, preset,
  --   influencer_id, scene_id, extraNotes
  credit_hint     int not null default 0,
  selected        boolean not null default true,
  status          text not null default 'planned',   -- planned | queued | generating | done | failed
  library_asset_id uuid,                             -- filled once render lands in library
  error           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

CREATE INDEX IF NOT EXISTS user_campaign_shots_campaign_idx ON user_campaign_shots(campaign_id);
CREATE INDEX IF NOT EXISTS user_campaign_shots_user_idx ON user_campaign_shots(user_id);

ALTER TABLE user_campaigns       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_campaign_shots  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own campaigns"       ON user_campaigns;
DROP POLICY IF EXISTS "Users insert their own campaigns"     ON user_campaigns;
DROP POLICY IF EXISTS "Users update their own campaigns"     ON user_campaigns;
DROP POLICY IF EXISTS "Users delete their own campaigns"     ON user_campaigns;
CREATE POLICY "Users read their own campaigns"   ON user_campaigns FOR SELECT USING  (auth.uid() = user_id);
CREATE POLICY "Users insert their own campaigns" ON user_campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own campaigns" ON user_campaigns FOR UPDATE USING  (auth.uid() = user_id);
CREATE POLICY "Users delete their own campaigns" ON user_campaigns FOR DELETE USING  (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read their own campaign shots"   ON user_campaign_shots;
DROP POLICY IF EXISTS "Users insert their own campaign shots" ON user_campaign_shots;
DROP POLICY IF EXISTS "Users update their own campaign shots" ON user_campaign_shots;
DROP POLICY IF EXISTS "Users delete their own campaign shots" ON user_campaign_shots;
CREATE POLICY "Users read their own campaign shots"   ON user_campaign_shots FOR SELECT USING  (auth.uid() = user_id);
CREATE POLICY "Users insert their own campaign shots" ON user_campaign_shots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own campaign shots" ON user_campaign_shots FOR UPDATE USING  (auth.uid() = user_id);
CREATE POLICY "Users delete their own campaign shots" ON user_campaign_shots FOR DELETE USING  (auth.uid() = user_id);
