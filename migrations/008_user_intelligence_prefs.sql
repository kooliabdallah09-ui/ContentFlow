-- Add posting_frequency + format_preferences to user_intelligence so the
-- brand-step-2 selections (frequency chip, per-format frequency dial) are
-- honoured by the intelligence plan generator.
ALTER TABLE user_intelligence
  ADD COLUMN IF NOT EXISTS posting_frequency text,
  ADD COLUMN IF NOT EXISTS format_preferences jsonb DEFAULT '{}'::jsonb;
