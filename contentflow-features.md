# ContentFlow — Complete Feature Reference

> Use this document as a comprehensive briefing for competitive analysis. It covers every feature, tool, generator, integration, AI model, and credit cost in the platform.

---

## What ContentFlow Is

ContentFlow is an AI-powered content marketing platform for brands, agencies, and creators. It generates videos, images, voiceovers, scripts, social posts, and full ad campaigns from a product description or brand context. Every output is production-ready and ready to publish.

---

## AI Models & Services Used

| Model / Service | Purpose |
|---|---|
| Claude (Anthropic) | Scripts, captions, briefs, campaign plans, prompt rewriting, analysis |
| Seedance 2.0 (ByteDance via Replicate) | Primary AI video generation |
| Seedance 2.0 Mini (Replicate) | Cheaper/faster AI video |
| Veo 3.1 Fast / Omni Flash (Google Vertex) | Admin-only video alternative |
| Nano Banana Pro (Google Vertex) | Premium portrait & frame generation |
| Nano Banana 2 (Google Vertex) | Cheaper image alternative |
| ElevenLabs (via Replicate) | Text-to-speech / voiceover |
| Sora (OpenAI, optional) | B-roll / cinematic video alternative |
| Replicate | Model hosting / API routing |
| Shopify API | Product catalog import |
| YouTube / TikTok / Instagram / Facebook / X APIs | Publishing |
| Google Drive API | Asset sync |
| Supabase | Auth + database + storage |
| Stripe / Paddle / Polar | Billing |

---

## Credit System

Credits are the in-app currency. Every generation costs a predictable number of credits.

| Feature | Credits |
|---|---|
| Social caption | 5 cr |
| Social image (NB2) | 3 cr |
| Image — NB2 | 5 cr |
| Image — NB Pro 2K | 10 cr |
| Image — NB Pro 4K | 18 cr |
| Carousel slide — NB2 | 3 cr/slide |
| Carousel slide — NB Pro | 5 cr/slide |
| Voice / TTS | ceil(chars ÷ 80), min 5 cr |
| AI Video — Seedance Mini | 3–7 cr/sec × duration |
| AI Video — Seedance 2.0 | 6–72 cr/sec × duration (480p–4K) |
| AI Video — Omni Flash (admin) | 12–20 cr/sec |
| AI Video — native audio off | −15% |
| Director Mode | +15 cr (added to video cost) |
| CineMotion | +14 cr |
| UGC script | ~20 cr |
| UGC video | ~80–150+ cr |
| Influencer creation | ~20 cr |
| Photoshoot (per scene) | ~10 cr |
| Brand Launch full setup | ~50–100 cr |
| Screen Demo | 20+ cr |
| Podcast Ad (6-shot) | ~30–50 cr |

**Subscription Plans:**

| Plan | Monthly | Annual | Credits/Month |
|---|---|---|---|
| Free | $0 | $0 | 30 one-time signup credits (~6 images) |
| Lite | $6/mo | $5/mo ($60/yr) | 200 credits/month |
| Starter | $19/mo | $16/mo ($190/yr) | 800 credits/month |
| Pro | $49/mo | $41/mo ($490/yr) | 2,000 credits/month |
| Agency | $149/mo | $124/mo ($1,490/yr) | 6,500 credits/month |

**What each plan's credits gets you (approximate):**
- Starter (800 cr/mo): ~6 UGC videos at 5s, ~160 product images, ~100 AI influencer photos
- Pro (2,000 cr/mo): ~16 UGC videos at 5s, ~400 product images, ~250 AI influencer photos
- Agency (6,500 cr/mo): ~52 UGC videos at 5s, ~1,300 product images, ~800 AI influencer photos

**One-time credit packs (never expire, survive plan changes):**

| Pack | Price | Per Credit |
|---|---|---|
| 250 credits | $8 | $0.032/cr |
| 500 credits | $15 | $0.030/cr |
| 1,500 credits | $45 | $0.030/cr |
| 5,000 credits | $120 | $0.024/cr |

**Free trial:** 30 credits on sign-up, no credit card required.

**Billing providers:** Stripe, Paddle, Polar

---

## Content Generators

### 1. AI Video Generator (`/generate/video`)

Full cinematic video generation. Multiple models, resolutions, and creative modes.

**Models:**
- **Seedance 2.0** — default; up to 4K, up to 60 seconds, native audio, character consistency from reference photos
- **Seedance Mini** — ~50% cheaper; up to 720p
- **Omni Flash (admin-only)** — Veo 3.1 Fast on Vertex; 4–8 second clips; 720p/1080p

**Features:**
- Text prompt → video
- Reference image upload (up to 4; first image used as opening keyframe)
- Format picker: Portrait (9:16), Tall (3:4), Square (1:1), Landscape (16:9)
- Native audio toggle (−15% when disabled)
- AI prompt rewriter (Claude rewrites your prompt into a cinematic shot description)
- Shopify product import (scrapes product images automatically)
- **Director Mode** — write one line of intent, Claude generates a full shot list + storyboard preview, then renders each shot
- **CineMotion** — drop a product photo, AI writes and renders an Apple-style CGI product commercial with physics, lighting, and camera choreography

---

### 2. UGC Package Generator (`/generate/ugc`)

End-to-end talking-head ad: script → actor → voice → captions → B-roll → stitched video.

**Features:**
- Product/topic description + URL scraper (auto-fill from competitor ads)
- Hook style picker: Problem/Solution, Before/After, Curiosity, Social Proof, Question, Mini-story
- AI script generation (Claude) + user edit + regeneration
- Actor/influencer gallery picker (including Influencer Studio characters)
- Scene/setting picker (from saved scenes)
- Brand context auto-prefill
- Scroll-stop hook: AI-generated eye-catching opening frame
- Motion B-roll: AI-animated background footage between script lines
- Video stitching: talking head + B-roll + music → final MP4
- **Batch Mode** — generate multiple hook variations simultaneously with different actors
- **Multi-shot mode** — split script across multiple actors

**AI models used:** Claude (script), Seedance 2.0 (video), NB Pro (frames), ElevenLabs (voiceover)

---

### 3. Image Generator (`/generate/image`)

Creative images and editorial product photography.

**Features:**
- Prompt → image
- Model: Nano Banana Pro (best) or NB2 (cheaper)
- Resolution: 2K or 4K (Pro only)
- Aspect ratios: 1:1, 3:4, 4:5, 9:16, 16:9
- Batch: 1–4 images per request
- Optional reference image for style/identity consistency
- Persistent gallery with download + delete

---

### 4. Social Content Generator (`/generate/social`)

Platform-native captions and image carousels.

**Features:**
- **Caption generator** — Instagram, Facebook, X/Twitter with platform character limits
- **Carousel generator** — multi-slide posts (3–10 slides) for Instagram/LinkedIn
- Tone: Bold, Conversational, Professional, Storytelling
- Optional AI-generated image per post
- Optional influencer/product embedding in carousel slides
- Reference image for visual style consistency
- Background music selection (Upbeat, Chill, Cinematic, Bold/Dramatic, Trending)

---

### 5. Voice / Voiceover Generator (`/generate/voice`)

Text-to-speech in 30+ languages.

**Features:**
- 7 pre-built voices: Drew, Paul, James, Rachel, Hope, Sarah, Aria
- Language support: 30+ languages
- Speed: 0.5×–2.0×
- Max 2,000 characters per request
- ElevenLabs Turbo v2.5 model via Replicate

---

### 6. Podcast Ad Generator (`/generate/podcast-ad`)

6-shot dialogue-driven premium studio ad.

**Features:**
- Setup form: product, benefit, hook, scene descriptions
- AI script generation (Claude) + user edit
- Frame preview for each shot (NB Pro)
- Parallel Seedance job submission (all 6 shots at once)
- Real-time polling and progress display
- Final stitched MP4

---

### 7. Screen Demo Generator (`/generate/screen-demo`)

App/product walkthrough with cursor, voiceover, and screen recordings.

**Features:**
- Script input or AI generation from product description
- Voiceover synthesis with timing sync (ElevenLabs)
- Cursor overlay + animation
- Screen region cropping
- Video stitching to final output

---

### 8. Vox Studio — Narrated Explainer Videos (`/generate/vox`)

Editorial narrated videos with auto-generated visuals and synced voiceover.

**Features (admin-gated alpha):**
- Topic → Claude writes script + beat map
- Frame generation at each beat point (NB Pro)
- Voiceover synthesis (ElevenLabs)
- Auto-stitch with timing sync

---

### 9. Email Writer (`/generate/email`) — Coming Soon

Welcome sequences, product launches, abandoned-cart flows, subject line A/B variants.

---

### 10. Blog Post Writer (`/generate/blog`) — Coming Soon

Long-form posts in brand voice, SEO-optimized, with auto-generated images.

---

## Studio Features (Persistent AI Assets)

### Influencer Studio (`/influencers`)

Create and manage persistent AI characters that can be reused across all generators.

**Features:**
- Character creation from freeform description or structured trait picker (ethnicity, hair, eye color, hairstyle, face features, style aesthetics)
- Reference photo upload (up to 3 real photos — AI locks face/look to them)
- AI identity generation: name, handle, bio, personality, niche
- Portrait generation (NB Pro)
- Character sheet (visual reference PDF/image)
- Photoshoot: 8 preset scenes — beach, café, city night, gym, reading nook, rooftop, farmers market, hiking trail
- Photo gallery per character with download
- Quick-cast into UGC generator
- **Regenerate look** — reroll portrait/sheet preserving identity
- Admin-gated

---

### Product Studio (`/generate/products`)

Persistent products with multi-angle reference photos for consistent AI video generation.

**Features:**
- Product onboarding (name, description, category)
- Multi-angle photoshoots (AI-directed aesthetic styles)
- Reference sheet gallery
- One-click import into video/UGC generators

---

### Scene/Setting Manager (`/scenes`)

Saved backdrops and environments for UGC videos.

**Features:**
- Create scenes with text description and optional reference image
- NB Pro scene visualization
- Quick-select in UGC builder

---

## Campaign & Planning Features

### Campaign Planner (`/campaigns`)

Multi-shot campaign orchestration — from brief to production schedule.

**Features:**
- Campaign creation: name, brief, product, goal, duration, platforms
- AI shot planning (Claude generates full shot list from brief)
- Per-shot: hook type, actor, scene, setting
- Batch generation triggers
- Shot status tracking (draft → generating → complete)
- Pre-fill UGC generator from any shot

---

### Brand Launch Wizard (`/brand-launch`)

Full brand identity setup through a guided questionnaire.

**Features:**
- Brand name, niche, product catalog, messaging, voice/tone
- Logo generation (NB Pro)
- Content brief generation
- Auto-populate brand context across all generators
- Admin-gated

---

## Post-Production & Editor

### Video Editor (`/editor`)

Frame-by-frame editing and export.

**Features:**
- Trim/cut video segments
- Adjust clip duration
- Aspect ratio conversion
- Transitions
- Export to MP4
- Free — no credits consumed

---

## Intelligence & Automation

### Brand Intelligence

Auto-complete and recommend content strategy.

**Features:**
- Website scraping → auto-fill brand fields
- Product catalog import (Shopify)
- Trend fetching (web search)
- Competitor analysis
- Content recommendations ("What should we create next?")
- Routes: `/api/intelligence/ai-fill`, `/api/intelligence/plan`, `/api/intelligence/trends`

---

### Competitor Ad Analyzer (`/generate/analyzer`)

Paste a competitor ad URL → AI extracts hook, script, CTA, visual style → prefills UGC generator.

---

### AI Studio Chat (`/studio`)

Conversational Claude interface inside ContentFlow. Delegates generation tasks through chat. Backed by MCP (Model Context Protocol).

---

## Library & Asset Management

### Library (`/library`)

Complete history of all generated content.

**Features:**
- Filter: UGC, Video, Image, Social, Voice, Screen Demo, Carousel, Podcast Ad
- Search + sort by date
- Per-item: credit cost, generation time, source metadata
- Preview modal with autoplay (video) or full-size (image)
- Download + delete + "Edit in Editor" actions
- Backed by Supabase `ugc_content` table

---

### Batch Generation (`/batch`)

Queue multiple generation jobs in parallel.

**Features:**
- Multiple UGC/Video job submission
- Real-time status polling per job
- Download all results when complete

---

## Publishing & Integrations

### Social Platforms

| Platform | Integration Level |
|---|---|
| YouTube | Upload + auto-publish scheduling |
| TikTok | Draft export + direct upload |
| Instagram | Draft export |
| Facebook | Draft export |
| X / Twitter | Draft export |

---

### Google Drive

Auto-save generated assets to a Google Drive folder. Bidirectional sync.

---

### Shopify

Import product catalog + images. Auto-prefill video/UGC generators with product context.

---

### WordPress

Publish blog posts/articles directly to a connected WordPress site.

---

## Analytics

### Analytics Dashboard (`/analytics`)

- Total generated (count by type)
- Total credits used
- Credits by content type
- Recent activity feed
- Credit balance + reset date

---

## User & Account Features

### Authentication

- Email/password signup + login
- Password reset
- Account deletion
- Supabase JWT

### Onboarding (`/onboarding/`)

3-step wizard: brand setup → campaign intent → trend loading. Auto-populates brand context everywhere.

### Settings (`/settings/`)

- **Account** — name, email, password reset
- **Brand** — brand profile editing
- **Billing** — Stripe/Paddle portal
- **Integrations** — connect/disconnect social + Drive
- **API Keys** — generate tokens for programmatic API access

---

## Platform Architecture

- **Framework:** Next.js 16 App Router (TypeScript)
- **Database:** Supabase (Postgres + Storage + Auth)
- **Hosting:** Vercel (Fluid Compute, maxDuration 300s on heavy routes)
- **API Routes:** 161 endpoints
- **Admin-gated features:** Influencer Studio, Brand Launch, Vox, Omni Flash video, POV formats
- **Free first influencer:** First character creation is always free

---

## Quick Differentiators Summary

1. **Full ad pipeline in one tool** — script + actor + voice + B-roll + music → final MP4, no switching apps
2. **Persistent AI characters** — Influencer Studio creates reusable AI personas for photoshoots, UGC, and social
3. **Director Mode** — one-line intent → Claude writes the shot list + renders each shot
4. **CineMotion** — Apple-style CGI product commercial from a single product photo
5. **Campaign Planner** — orchestrate multi-shot ad campaigns with AI-generated shot lists
6. **Brand context everywhere** — set your brand once, it auto-populates every generator
7. **Multi-model flexibility** — NB Pro vs NB2, Seedance vs Omni Flash — user picks quality/cost tradeoff
8. **Competitor ad scraper** — paste a URL, AI extracts the script and hook structure
9. **Scroll-stop hooks** — eye-catching AI-generated opening frames for UGC ads
10. **Batch mode** — generate multiple hook variations simultaneously
