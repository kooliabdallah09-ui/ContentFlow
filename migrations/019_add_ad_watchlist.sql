-- Competitor Ad Radar — the watchlist.
--
-- The Ad Teardown is one-shot today: analyse an ad, read the breakdown, lose it.
-- This turns it into a standing record, because the interesting signal isn't
-- what a competitor's ad SAYS — it's how long they keep paying to run it.
--
-- Commercial ads disappear from Meta's Ad Library the moment a brand stops
-- running them. So an ad still live after weeks is one that's working; an ad
-- that vanishes in days failed. That gives a performance signal without anyone
-- reporting their numbers — which matters, because nobody ever fills those in.
--
-- The asset here is the timeline, and it can only be built by starting early:
-- a competitor's ad history can't be bought or backfilled after the fact.

CREATE TABLE IF NOT EXISTS user_watched_ads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  competitor        text NOT NULL,              -- brand this ad belongs to
  platform          text NOT NULL DEFAULT 'meta',   -- meta | tiktok | other
  source_url        text,                       -- Ad Library permalink, when known

  -- The full teardown, stored so "make my version" doesn't re-analyse (and
  -- re-charge) an ad we've already broken down.
  teardown          jsonb NOT NULL,
  thumb_url         text,                       -- a sampled frame, for the card

  -- Longevity. first_seen is when the user started watching, not when the ad
  -- actually launched — an ad may already have been running a while, so the
  -- number is a floor, not an exact age.
  first_seen_at     timestamptz NOT NULL DEFAULT now(),
  last_confirmed_at timestamptz NOT NULL DEFAULT now(),
  -- NULL means still running. Set when the user (or a checker) reports it gone.
  died_at           timestamptz,
  check_count       integer NOT NULL DEFAULT 0,

  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- The main view: my watchlist, live ones first, longest-running at the top.
CREATE INDEX IF NOT EXISTS idx_watched_ads_user
  ON user_watched_ads (user_id, died_at NULLS FIRST, first_seen_at);

-- "Which of my watched ads haven't been checked lately?"
CREATE INDEX IF NOT EXISTS idx_watched_ads_stale
  ON user_watched_ads (last_confirmed_at)
  WHERE died_at IS NULL;

ALTER TABLE user_watched_ads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own watched ads"   ON user_watched_ads;
DROP POLICY IF EXISTS "Users insert their own watched ads" ON user_watched_ads;
DROP POLICY IF EXISTS "Users update their own watched ads" ON user_watched_ads;
DROP POLICY IF EXISTS "Users delete their own watched ads" ON user_watched_ads;
CREATE POLICY "Users read their own watched ads"   ON user_watched_ads FOR SELECT USING  (auth.uid() = user_id);
CREATE POLICY "Users insert their own watched ads" ON user_watched_ads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own watched ads" ON user_watched_ads FOR UPDATE USING  (auth.uid() = user_id);
CREATE POLICY "Users delete their own watched ads" ON user_watched_ads FOR DELETE USING  (auth.uid() = user_id);
