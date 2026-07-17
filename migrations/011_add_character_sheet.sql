-- Character turnaround sheet per influencer: a multi-angle reference grid
-- (full-body front/side/back + head close-ups) used as the primary identity
-- anchor for photoshoots and UGC hero frames.

ALTER TABLE user_influencers ADD COLUMN IF NOT EXISTS character_sheet_url text;
