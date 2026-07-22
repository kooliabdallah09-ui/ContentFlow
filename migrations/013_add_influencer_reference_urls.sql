-- Persist the ORIGINAL user-uploaded reference photos for each influencer.
-- Previously they only anchored the very first NB Pro portrait render; every
-- subsequent photoshoot inherited whatever drift crept into that portrait
-- (and again into the character sheet). By saving the originals we can pass
-- them into every future photoshoot as the primary identity anchor.

ALTER TABLE user_influencers ADD COLUMN IF NOT EXISTS reference_urls text[];
