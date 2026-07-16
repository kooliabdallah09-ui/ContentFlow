-- Saved actors — reusable AI characters the user can pick up on future
-- UGC generations for consistent identity across ads.
--
-- Populated by /api/ugc/saved-actors POST once the user picks a hero
-- frame + gives it a nickname. Consumed by /api/ugc/hero-frames when
-- the client passes a savedActorId — skips the Haiku + Sonnet character
-- prompt chain and uses the stored image prompt verbatim so every render
-- lands on the same character.

CREATE TABLE IF NOT EXISTS user_saved_actors (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  text NOT NULL,                         -- user-provided nickname
  hero_frame_url        text NOT NULL,                         -- Supabase Storage public URL of the picked frame
  character_image_prompt text NOT NULL,                        -- Sonnet's Nano Banana Pro prompt (identity anchor)
  character_idea        text,                                  -- Haiku's one-liner (kept for the card subtitle)
  persona_locks         jsonb DEFAULT '{}'::jsonb,             -- CharacterProfile fields the user locked in
  created_at            timestamptz NOT NULL DEFAULT now(),
  last_used_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_saved_actors_user_id_idx
  ON user_saved_actors(user_id, last_used_at DESC);

COMMENT ON TABLE  user_saved_actors               IS 'Reusable AI characters saved by users for UGC identity consistency.';
COMMENT ON COLUMN user_saved_actors.character_image_prompt IS 'Sonnet-drafted Nano Banana Pro image prompt used verbatim on reuse.';
