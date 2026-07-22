-- Scene Studio — reusable environments that appear as picker options in the
-- Influencer Studio composer and the UGC Package Builder. Each Scene has a
-- Sonnet-written location brief, a rendered hero photo of the empty scene
-- (used as a location anchor for downstream shoots), and optional original
-- reference photos so downstream shoots can re-anchor to real photos rather
-- than the AI's interpretation (same drift-prevention pattern we use for
-- influencer identity refs).

CREATE TABLE IF NOT EXISTS user_scenes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  category        text,           -- interior | exterior | studio | other
  description     text,           -- Sonnet-generated short summary
  scene_prompt    text not null,  -- rich prompt used as scene anchor for renders
  hero_image_url  text,           -- empty-scene hero rendered by NB Pro
  reference_urls  text[],         -- user's original uploads (drift anchor)
  last_used_at    timestamptz,
  created_at      timestamptz default now()
);

CREATE INDEX IF NOT EXISTS user_scenes_user_id_idx ON user_scenes(user_id);

ALTER TABLE user_scenes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own scenes"      ON user_scenes;
DROP POLICY IF EXISTS "Users insert their own scenes"    ON user_scenes;
DROP POLICY IF EXISTS "Users update their own scenes"    ON user_scenes;
DROP POLICY IF EXISTS "Users delete their own scenes"    ON user_scenes;

CREATE POLICY "Users read their own scenes"   ON user_scenes FOR SELECT USING  (auth.uid() = user_id);
CREATE POLICY "Users insert their own scenes" ON user_scenes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own scenes" ON user_scenes FOR UPDATE USING  (auth.uid() = user_id);
CREATE POLICY "Users delete their own scenes" ON user_scenes FOR DELETE USING  (auth.uid() = user_id);
