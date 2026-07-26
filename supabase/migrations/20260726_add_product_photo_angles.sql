-- Per-photo angle labels for Product Studio references. Parallel to
-- photo_urls: photo_angles[i] describes what photo_urls[i] shows
-- (e.g. 'landing page', 'mobile view', 'dashboard', 'front', 'label
-- close-up', or a user-entered custom label). Empty string when the
-- user didn't pick one. Downstream UGC picks the right screenshot per
-- format (POV → mobile, everything else → landing page).
ALTER TABLE user_studio_products
  ADD COLUMN IF NOT EXISTS photo_angles TEXT[];
