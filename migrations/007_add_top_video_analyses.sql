-- Add top_video_analyses column to user_intelligence.
-- Stores Gemini's analysis of the top short-form video from each of
-- TikTok / Reels / YT Shorts for the user's niche. Populated once at
-- onboarding and refreshed alongside the trend snapshot.
ALTER TABLE user_intelligence
  ADD COLUMN IF NOT EXISTS top_video_analyses jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN user_intelligence.top_video_analyses IS
  'Array of {platform, sourceUrl, videoUrl, hook, format, pacing, hookVisual, cta, characterOnCamera, captionStyle, transcript, keyMoments, caption, hashtags, views, likes, authorHandle}';
