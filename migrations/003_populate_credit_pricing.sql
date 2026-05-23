-- Populate credit pricing table with actual costs
DELETE FROM public.credit_pricing WHERE content_type IN ('blog', 'social', 'email', 'image', 'video', 'voice');

INSERT INTO public.credit_pricing (content_type, base_cost, description) VALUES
  ('blog', 1, 'Text generation via Claude'),
  ('social', 1, 'Social media text generation'),
  ('email', 1, 'Email sequence generation'),
  ('image', 5, 'AI image generation via Flux Pro'),
  ('voice', 3, 'Voice synthesis 30s via ElevenLabs'),
  ('video', 100, 'UGC video 30s standard via HeyGen')
ON CONFLICT (content_type) DO UPDATE SET
  base_cost = EXCLUDED.base_cost,
  description = EXCLUDED.description;
