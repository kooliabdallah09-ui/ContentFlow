# ContentFlow — Full App Workflow

> The end-to-end map of every route, generator, API call, database write, and
> external service. Read top to bottom for the newcomer path (signup → first
> render). Jump to a section header for a specific piece.

---

## Table of contents

1. [Stack + Environment](#1-stack--environment)
2. [Domain model & DB schema](#2-domain-model--db-schema)
3. [Signup → Onboarding](#3-signup--onboarding)
4. [Dashboard & Calendar](#4-dashboard--calendar)
5. [Prompt Enhancement Layer](#5-prompt-enhancement-layer)
6. [Generators](#6-generators)
7. [UGC Package Pipeline (Flagship)](#7-ugc-package-pipeline-flagship)
8. [Video Generator](#8-video-generator)
9. [App Demo Composite (Format Library)](#9-app-demo-composite-format-library)
10. [Library & Google Drive](#10-library--google-drive)
11. [Credits & Billing](#11-credits--billing)
12. [Ask AI + MCP](#12-ask-ai--mcp)
13. [External services & required env vars](#13-external-services--required-env-vars)
14. [Recent architecture decisions](#14-recent-architecture-decisions)

---

## 1. Stack + Environment

| Layer | Tech |
|---|---|
| Framework | Next.js 15 App Router + TypeScript |
| Auth + DB | Supabase (Postgres + Auth + Storage) |
| Hosting | Vercel (`contentflow-web.com`) |
| Prompting / LLM | Anthropic (Sonnet 4.6, Haiku 4.5) |
| Video gen | Replicate — Seedance 2.0, Kling v3, RVM |
| Image gen | Replicate — Nano Banana (google/nano-banana-2) |
| Compositor | Shotstack (stage / edge) |
| Transcription | Replicate — openai/whisper (pinned version) |
| Voice | ElevenLabs |
| Trend scraping | Apify (TikTok + Instagram actors) |
| Trend data | Google Trends via SerpAPI, Reddit public JSON |

Full env-var list at the bottom of this file.

---

## 2. Domain model & DB schema

**Auth-owned tables** (managed by Supabase Auth): `auth.users`.

**App tables** (`public`):

| Table | Purpose |
|---|---|
| `profiles` | 1:1 with `auth.users`. Email, display name. |
| `brand_profiles` | Company info collected in Brand step 1: `company_name`, `description`, `product_type`, `unique_value_prop`, `brand_mission`, `target_audience`, `customer_pain_points`, `tone_of_voice`, `brand_colors`, `posting_frequency`, `logo_url`, `products` (jsonb). |
| `user_intelligence` | Structured niche profile from intelligence onboarding: `niche`, `product_type`, `audience_profile` (jsonb), `goal`, `trend_keywords[]`, `niche_subreddits[]`, `preferred_platforms[]`, `posting_frequency`, `format_preferences` (jsonb), `top_video_analyses` (jsonb array). |
| `content_plans` | The 30-day calendar from Intelligence generate-plan. `plan_data` (jsonb), `top_formats`, `hooks`, `calendar_30d` (jsonb), `trend_snapshot`, `trending_hashtags`, `refresh_date`. |
| `user_monthly_plans` | Legacy Brand-only calendar (still readable, no longer written to). |
| `trend_cache` | Google/Reddit/TikTok trend snapshots keyed by `niche:platform`, 24-hr TTL. |
| `ugc_content` | Every generation persists here. `content_type`, `external_id` (Replicate prediction ID), `storage_url`, `metadata` (jsonb), `credit_cost`, `status`. |
| `user_credits` | `balance` (monthly), `pack_credits` (top-up), `pack_credits_expires_at`. |
| `credit_transactions` | Audit log for every deduct / grant. |
| `integrations` | OAuth tokens per platform (google-drive, youtube). |
| `mcp_keys` | User-scoped keys for MCP server access from Claude Desktop. |
| `brand_products` | Multi-product catalog for brands with a lineup (t-shirt companies etc.). |

**Migrations** (run in Supabase SQL editor in order):
`000_fix_all_now.sql` → `008_user_intelligence_prefs.sql`.

---

## 3. Signup → Onboarding

### 3.1 Signup

`app/auth/signup/page.tsx` → creates Supabase user → `router.push('/onboarding/brand')`.

### 3.2 Brand Step 1 — Company profile

Route: **`/onboarding/brand`** (step 1 of 2).

Layout: quick-description textarea + AI-fill button at the top, then 9
individual fields.

- **AI-fill** (`POST /api/brand/ai-fill`) — Claude Haiku expands a one-line
  product description into all 9 fields: `companyName`, `description`,
  `productType`, `uniqueValue`, `brandMission`, `targetAudience`,
  `customerPainPoints`, `toneOfVoice`, `brandColors`.
- **Save** (`POST /api/brand/save`) — upserts `brand_profiles` row.
- On success → `setStep(2)`.

### 3.3 Brand Step 2 — Platforms & frequency

- Platform toggles (Instagram / TikTok / X / YouTube / Facebook)
- Frequency chip (`light` / `moderate` / `heavy`)
- Per-format frequency dials (`ugc`, `video`, `image`, `social`, `voice`,
  `screen-demo`)

**Continue** button stashes prefs into `sessionStorage['cf-onboarding-prefs']`
and routes to `/onboarding/intelligence`.

### 3.4 Intelligence — 3-question flow

Route: **`/onboarding/intelligence`**. Three-step wizard.

Fields: product · audience · goal (`brand_awareness` / `drive_sales` /
`build_community` / `get_ugc_creators`).

**"✨ Fill from my brand"** button (`GET /api/intelligence/ai-fill`) reads
the user's `brand_profiles` row, derives the goal via Haiku, and returns
`{ product, audience, goal }` — user jumps to the last step to confirm.

On submit — three phases:

1. **`profiling`** — `POST /api/intelligence/onboard` — Haiku turns the 3
   answers into structured profile: `niche`, `product_type`, `audience_profile`,
   `trend_keywords`, `niche_subreddits`, `preferred_platforms`. Merges the
   sessionStorage prefs (platforms, frequency, format_preferences) as
   overrides. Upserts `user_intelligence`.

2. **`scanning`** — `POST /api/intelligence/analyze-top-videos` — parallel:
   - Apify TikTok scraper (`APIFY_TIKTOK_ACTOR_ID`) → top #1 by playCount
   - Apify Instagram scraper (`APIFY_INSTAGRAM_ACTOR_ID`, `resultsType: reels`)
     → top #1 by views
   - Each mp4 URL → Gemini 2.5 Flash (via Replicate `google/gemini-2.5-flash`)
     → extracts `hook`, `format`, `pacing`, `hookVisual`, `cta`,
     `characterOnCamera`, `captionStyle`, `transcript`, `keyMoments`.
   - Saved to `user_intelligence.top_video_analyses` (jsonb array).
   - Fail-soft: any missing key / API error just returns an empty array,
     onboarding continues.

3. **`planning`** — `POST /api/intelligence/generate-plan` — Sonnet 4.6 gets:
   - profile
   - `gatherTrends()` snapshot (Google via SerpAPI + Reddit public JSON)
   - `top_video_analyses`

   Returns a JSON plan with `top_formats[]` (scored 0–100), `hooks` (5 per
   top-3 format), `calendar_30d` (12–16 posts per month across 4 weekly
   themes), `trending_hashtags`. Written to `content_plans`.

Redirect → `/dashboard?plan=ready&onboarded=1`.

---

## 4. Dashboard & Calendar

### 4.1 Dashboard — `/dashboard`

- Credits card
- Today's task pill
- Quick-create shortcuts (UGC / Video / Image / Social)
- **Content Plan Section** — `components/ContentPlanSection.tsx`
  - Reads `GET /api/intelligence/plan` — returns `plan` + `productType`
    (pulled from `brand_profiles`) + `needsRefresh`.
  - Renders top-3 formats + first 6 upcoming calendar entries.
  - **"Refresh trends"** button re-runs `gatherTrends` (`POST
    /api/intelligence/refresh`).
- Made-with-ContentFlow showcase cards for other generators.

### 4.2 Generate button flow (dashboard → generator)

The critical path for "click Generate on D3 UNBOXING":

```
[dashboard] user clicks Generate
    ↓
1. formatToContentType(entry.format, productType)  // lib/format-to-route.ts
    ↓ picks 'video' for unboxing/before_after, 'ugc' for hot_take/etc,
    ↓ 'screen-demo' only if productType is software
    ↓
2. POST /api/content/enhance-prompt with { hook, format, target, platform }
    ↓ Claude Haiku, 8s timeout budget
    ↓ Returns a production-ready prompt tailored to the target generator
    ↓
3. savePrefill({ contentType, title: hook, description: enhancedPrompt,
                 platforms, suggestedTime, reason: 'Week N: format' })
    ↓ sessionStorage['calendarPrefill']
    ↓
4. router.push(formatToRoute(entry.format, productType))
    ↓
5. Target generator's page reads sessionStorage synchronously in useState
   initializers → all fields filled on first paint, zero flash.
```

### 4.3 Calendar — `/calendar`

Loads via `GET /api/planner/get-monthly-plan?month=X&year=Y`.

Fallback chain inside that route:
1. Try `user_monthly_plans` (legacy).
2. Fall back to `content_plans.calendar_30d`, converted to `DailySuggestion`
   shape.
3. Anchor day 1 to `content_plans.created_at` — a plan created July 12 covers
   July 12 → Aug 11, not July 1 → July 31.
4. Fill empty days in the 30-day window with `contentType: 'rest'` entries so
   the calendar grid reads as an intentional cadence.

**"Create now"** button on a day entry does the same enhance-prompt →
savePrefill → route dance as the dashboard.

**No sessionStorage cross-account leak** — calendar page nukes
`generatedPlan` on load to prevent one account's cached plan from bleeding
into another logged-in session in the same tab.

---

## 5. Prompt Enhancement Layer

Two Claude Haiku endpoints translate a raw hook into a production-ready
prompt for the target generator. Both are fail-soft: on any error they
return the raw hook so the user flow never blocks.

### 5.1 `POST /api/content/enhance-prompt`

Called by the dashboard "Generate" button + calendar "Create now" button.

Inputs: `{ hook, format, target, platform, duration? }`.

Per-target rules:
- `video` — advertising-tone paragraph, hook-first, product visible, beat
  budget scaled to `duration` (1 beat under 5s → 5–7 beats + reset for 41–60s).
- `ugc` — character + setting + verbatim opening line + delivery notes.
- `image` — composition + lighting + palette + hero product.
- `social` — one-line post idea + 5–8 hashtags.
- `voice` — verbatim VO script, ~2.4 words/sec.
- `screen-demo` — 3–5 recording beats with on-screen actions + one-line VO.

Loads `brand_profiles` + `user_intelligence` for niche + audience so the
prompt echoes real product context, not generic marketing speak.

### 5.2 `POST /api/video/rewrite-prompt`

Called by the **"✨ Enhance prompt"** button in `/generate/video`. Rewrites
whatever the user typed in advertising voice, grounded in their brand
profile, paced to the selected duration.

Strict system rules:
- Preserve subject/product/character verbatim
- Pace beats to duration (same budget as above)
- Advertising priorities: LEAD with the hook → show product → land benefit → CTA-worthy close
- UGC / social aesthetic default (handheld, natural light, real skin)
- No captions / text overlays / watermarks
- **NEVER ask the user for more info** — infer from brand context or invent on-brand defaults

---

## 6. Generators

`/generate/*` — 14 generators. Each reads sessionStorage prefill in
`useState` initializers so fields arrive filled with no animation.

| Route | Content type | Backend | Model |
|---|---|---|---|
| `/generate/ugc` | ugc | `POST /api/ugc/orchestrate` (or hero-frames → animate) | Nano Banana + Kling v3 omni |
| `/generate/video` | video | `POST /api/video/generate` | Seedance 2.0 (default), Kling v3 |
| `/generate/image` | image | `POST /api/content/generate/image` | Nano Banana |
| `/generate/voice` | voice | `POST /api/content/generate/voice` | ElevenLabs |
| `/generate/social` | social | `POST /api/content/generate/social` | Sonnet |
| `/generate/screen-demo` | screen-demo | multi-step | Nano Banana + Kling |
| `/generate/business-card` | image | inline | Nano Banana |
| `/generate/carousel` | image (batch) | multi-step | Nano Banana |
| `/generate/pov` | video | `POST /api/pov/generate` | Sora 2 / Kling |
| `/generate/analyzer` | (read-only) | `POST /api/analyzer/analyze` | Whisper + Sonnet vision |
| `/generate/formats/*` | (varies) | see §9 | varies |
| `/generate/blog`, `/generate/email`, `/generate/social`, `/generate/website`, `/generate/ads`, `/generate/from-calendar` | text | Anthropic direct | Sonnet / Haiku |

### 6.1 Format → Generator mapping (canonical)

`lib/format-to-route.ts` is the single source of truth.

| Content plan format | Generator | Rationale |
|---|---|---|
| `hot_take`, `review`, `pov`, `storytime`, `grwm` | `/generate/ugc` | Talking-head native |
| `unboxing`, `before_after` | `/generate/video` | Product-forward, needs visual weight |
| `tutorial` | `/generate/screen-demo` if `productType` is software; else `/generate/ugc` | Physical products get walkthrough UGC, not screen recordings |
| everything else | `/generate/ugc` | Safe default |

Both `ContentPlanSection` (dashboard) and `get-monthly-plan` (calendar API)
call `formatToContentType(format, productType)` — routing and calendar
labels stay in lockstep.

---

## 7. UGC Package Pipeline (Flagship)

Route: **`/generate/ugc`** — component `UGCPackageBuilder.tsx`. The "one
product photo → finished talking-head UGC ad" flagship.

### Inputs

1. Duration chip (5 / 10 / 15 / 20 / 30 seconds)
2. Aspect (portrait / square / landscape)
3. Product name + description + benefits + CTA (prefilled from brand or
   sessionStorage on first paint)
4. Product photo (**recommended, not required** — a custom persona alone is
   enough)
5. Character:
   - Actor library (pre-built portraits in `public/actors/`)
   - Custom persona (gender / age / ethnicity / hair / unique feature /
     scene / mood / wearing / accessories) — saved as reusable "Personas"
   - Custom uploaded photo
6. Custom instructions (free text — carries the Claude-enhanced prompt
   when arriving from calendar)

### Pipeline (two-step, with a picker in the middle)

**Step A — Hero frames**

`POST /api/ugc/hero-frames`. Fires **four** parallel Nano Banana renders,
each with slightly different noise, so the user picks from 4 distinct
first-frame candidates.

Three branches inside `hero-frames`:
- **`generateCharacterInFrontOfUI`** — software product + product screenshot.
- **`generateCharacterWithProduct`** — has a product photo (physical).
- **`ugcifyPortrait`** — no product but an actor / uploaded portrait.
- **NEW: `generateTextToImage`** — no product AND no portrait. Character
  described entirely by the custom persona dropdowns; Nano Banana
  generates from text. This fixed the "Invalid base64" crash when only a
  custom persona was provided.

All 4 successful frames are resized + uploaded to Supabase storage
(`ugc-assets/hero-frames/`). Public URLs returned.

**Step B — User picks a frame → animate**

`POST /api/ugc/animate` (or the legacy `orchestrate` route). Takes the
chosen frame URL, runs `submitKlingV3OmniJob` — Kling v3 omni renders the
talking-head video WITH native synced voice (the model picks the voice
from the character's appearance in the hero frame).

Script generation happens earlier via `POST /api/ugc/script` (Claude Sonnet)
using the beat template `[BACKGROUND] [HOOK] [BODY] [CTA]`. The user can
revise with `POST /api/ugc/revise-script` before Step B fires.

Result written to `ugc_content` (status: processing → completed via polling
at `GET /api/ugc/video-status?videoId=X&provider=kling-v3-omni`). Auto-saved
to Google Drive via `useDriveSync` hook on the client.

---

## 8. Video Generator

Route: **`/generate/video`**. Cleaner, prompt-first cinematic generator.

### Models

| Model | Use case | Durations |
|---|---|---|
| **Seedance 2.0 (default)** — cinematic, native audio, image-to-video with character consistency | Any product-forward video | 3–60 seconds (presets 5 / 10 / 15 / 30 / 60) |
| Kling v3 | Talking-head fallback | 5 / 10 / 15s |

Sora 2 was removed from the picker.

### Resolution selector (Seedance only)

Per-second credit rate based on ByteDance's non_video_in pricing × 1.8 markup:

| Resolution | Credits/sec | Approx / 10s |
|---|---|---|
| 480p | 6 | 60 cr |
| 720p (default) | 13 | 130 cr |
| 1080p | 33 | 330 cr |
| 4k | 72 | 720 cr |

### Prompt flow

1. On mount:
   - Reads `sessionStorage['calendarPrefill']` — hydrates the prompt from
     the Claude-enhanced text (description) with `useState` initializer.
   - **Auto-loads brand product photo** from `GET /api/brand/load` in the
     background — first `products[].image_url`, else `product_image_url`,
     else `logo_url`. Base64 encodes it and drops it into the reference-
     image slot if the user hadn't uploaded one.
2. User can hit **"✨ Enhance prompt"** any time — sends the current text
   to `POST /api/video/rewrite-prompt` with `duration` + `aspect`. Claude
   rewrites in advertising voice, brand-grounded, duration-paced.
3. Submit → `POST /api/video/generate`:
   - Model dispatch: `submitSeedanceJob({ prompt, durationSeconds, aspectRatio, startImageUrl, resolution })` or `submitKlingV3OmniJob(…)`.
   - Reference image (if any) uploaded to Supabase Storage first.
   - Credit cost debited from `user_credits`.
   - Row written to `ugc_content` as `status: processing`.
4. Frontend polls `GET /api/ugc/video-status?videoId=X&provider=seedance-2`
   every few seconds until `completed`.

---

## 9. App Demo Composite (Format Library)

The Arcads-style app-demo composite lives at `/generate/formats/app-demo`.
Admin-gated via `canAccessFormats(email)`.

Pipeline (`POST /api/formats/app-demo/render`):

1. **Whisper transcription** — `lib/whisper.ts` uses a pinned `openai/whisper`
   version at `/v1/predictions` (`WHISPER_VERSION` hardcoded so we don't
   depend on Replicate resolving latest_version.id). Returns
   `{ text, words[] }` with per-word timings.
2. **Background removal** — `submitBackgroundRemovalJob` with
   `arielreplicate/robust_video_matting`, `output_type: green-screen`.
   Polls `getBackgroundRemovalStatus`. 150s budget.
3. **Shotstack composite** — `lib/formats/app-demo-renderer.ts` builds:
   - **Track 0**: Emoji triggers (`💰 🎮 📱` on keyword matches, HTML)
   - **Track 1**: Word-by-word captions (HTML title clips matching Video
     Editor style — Inter 900, uppercase, dark backing pill, per-segment
     colour from state machine)
   - **Track 2**: Chroma-keyed avatar clip pinned bottom-right / bottom-left
     (`avatarSide` toggle)
   - **Track 3**: Background — b-roll for hook, app-UI for demo, fullscreen
     Kling for pivot
   - **Track 4 (audio only)**: Raw Kling clip full-length with `volume: 1`,
     visually covered by tracks above so its audio plays continuously
     across overlay + pivot segments.

Uses `/edge` if `SHOTSTACK_ENV=production` else `/stage`. Auto-save to
Google Drive via `POST /api/formats/app-demo/save`.

---

## 10. Library & Google Drive

Route: **`/library`** — reads from Google Drive as source-of-truth.

### Auto-save on generation

- **Screen-demo** — `lib/useDriveSync.ts` hook fires client-side after
  render completes. Downloads the generated URL, uploads via multipart to
  Drive (`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`).
- **App-demo** — dedicated `/api/formats/app-demo/save` route (server-side)
  because Shotstack MP4 URLs can be slow to fetch client-side.
- Other generators (UGC, Video, Image, Voice, Social, Blog, Email,
  Carousel, Business Card, POV, Ads, Website, From-Calendar) — **not yet
  wired to auto-save**. `useDriveSync` is a 3-line addition per page.

### Library endpoint

`GET /api/library` — reads Drive files in the user's ContentFlow folder,
returns them mapped to `LibraryItem` shape. If Drive isn't connected
returns `{ items: [], driveConnected: false }`.

Drive integration setup: user connects via `/settings/integrations` OAuth
flow → tokens stored in `integrations` table.

---

## 11. Credits & Billing

### Table

`user_credits` — `balance` (monthly subscription), `pack_credits` (top-up
that stacks on subscription), `pack_credits_expires_at`.

### Deducting

`lib/deduct-credits.ts` — atomic. Every generation route calls it with the
pre-computed cost. Writes an entry to `credit_transactions`.

### Pricing per model (all with 1.8× markup)

| Model | Raw cost | Credits |
|---|---|---|
| Seedance 2.0 · 480p | $0.08/s | 6 cr/s |
| Seedance 2.0 · 720p | $0.18/s | 13 cr/s |
| Seedance 2.0 · 1080p | $0.45/s | 33 cr/s |
| Seedance 2.0 · 4k | $1.00/s | 72 cr/s |
| _(BytePlus direct — see `pricing/byteplus-seedance.md`: 63% cheaper at 4K, 58% at 1080p)_ | | |
| Kling v3 omni | $0.224/s | 16 cr/s (flat, 5/10/15s) |
| Nano Banana image | ~$0.03/img | ~5 cr |
| ElevenLabs voice | ~$0.30/1k chars | ~1 cr / 50 chars |
| Whisper | $0.006/min | negligible |
| Gemini 2.5 Flash (video read) | ~$0.0026/video | ~1 cr |

### Stripe

`/pricing` page + `/api/stripe/*` routes handle subscription (`Basic`,
`Pro`) + credit packs. Webhook updates `user_credits` on
`invoice.payment_succeeded`.

---

## 12. Ask AI + MCP

### Ask AI panel — `/ask`

Multi-agent chat. `POST /api/assistant/chat` dispatches to specialist
agents (image, video, ugc, planner, calendar). Response schema:

```json
{ "reply": "text to render", "action": { "href": "/generate/…", "label": "Open UGC Generator" }, "results": [ … ] }
```

The `cleanReply` helper handles three JSON shapes:
1. Bare JSON object
2. Fenced ` ```json { … } ``` ` block
3. Bare `{ "reply": … }` block anywhere

Parses each, extracts `reply` + `action`, renders. If nothing parses,
strips fences and shows prose.

### MCP server — `/api/mcp`

Model Context Protocol server for Claude Desktop integration. Users
generate a key at `/settings/api-keys`; Claude Desktop config points at
`https://contentflow-web.com/api/mcp?key=…`.

Exposed tools:
- `get_credit_balance`
- `list_library`
- `generate_social_captions`
- `generate_image`

---

## 13. External services & required env vars

### Required (hard errors without these)

| Env var | Where used |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | everything |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | server routes |
| `ANTHROPIC_API_KEY` | profile extraction, plan gen, enhance-prompt, rewrite-prompt, script gen, revise script, MCP tools, Ask AI |
| `REPLICATE_API_TOKEN` | Nano Banana, Kling, Sora, Seedance, Whisper, RVM, Gemini video read |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | billing |

### Recommended (features degrade gracefully without these)

| Env var | Feature |
|---|---|
| `APIFY_TOKEN` | Top-video scraping |
| `APIFY_TIKTOK_ACTOR_ID` (`clockworks~tiktok-scraper`) | TikTok discovery |
| `APIFY_INSTAGRAM_ACTOR_ID` (`apify~instagram-hashtag-scraper`) | Reels discovery |
| `SERPAPI_KEY` | Google Trends rising queries |
| `GOOGLE_GEMINI_API_KEY` | Legacy direct Gemini path (now routed through Replicate — this is optional) |
| `ELEVENLABS_API_KEY` | Voice generation |
| `SHOTSTACK_API_KEY` + `SHOTSTACK_ENV` | Video composition (App Demo Composite, Video Editor exports) |
| `HEYGEN_API_KEY` | Avatar library (auxiliary UGC path) |
| `GOOGLE_OAUTH_CLIENT_ID` + `GOOGLE_OAUTH_CLIENT_SECRET` | Drive + YouTube integrations |
| `YOUTUBE_API_KEY` | (Not currently used — YT Shorts scan was removed) |

### Fail-soft behaviour

- Missing Apify → onboarding video scan returns empty array, plan
  generator falls back to Claude's own niche knowledge.
- Missing SerpAPI → `gatherTrends` returns `google: null`, plan generator
  works from Reddit + video analyses.
- Missing Reddit access → `gatherTrends` returns `reddit: null`.
- Missing Gemini video read → each video row keeps its scraped metadata
  but `gemini: null`.
- Missing Shotstack → App Demo Composite errors out; other generators
  unaffected.

---

## 14. Recent architecture decisions

Chronological, most recent first.

- **Video generator = Seedance 2.0 only** (Sora 2 removed). Kling v3 kept
  as talking-head alternate. Duration expanded to 60s; resolution selector
  drives cost.
- **Prompt enhancers are duration-aware** — explicit beat + cut budget
  scaled to the target clip length, sent to Claude as a hard constraint.
- **Prompt enhancers grounded in brand** — `rewrite-prompt` loads
  `brand_profiles` and rewrites in the user's product / audience / tone.
  Rule: never ask the user for missing info; infer or invent on-brand.
- **Advertising voice**, not cinematographer — Seedance prompts now
  hook-first / product-visible / benefit-landing, NOT moody cinema.
- **UGC prefill lands on first paint** — `readPrefill('ugc')` moved into
  `UGCPackageBuilder`'s `useState` initializers. No flash, no animation.
  `customInstructions` field hydrates from the Claude-enhanced prompt.
- **Video prefill auto-loads brand product photo** as the first reference
  image, background fetch after prompt lands.
- **Custom persona is a valid character source** — Nano Banana can render
  from text alone. Product photo demoted to "recommended".
- **Gemini video analysis routed through Replicate** (`google/gemini-2.5-flash`).
  Consolidates dependencies on `REPLICATE_API_TOKEN` alone.
- **Format → generator routing centralised** in `lib/format-to-route.ts`,
  context-aware on `product_type` (screen-demo only for software).
- **Calendar reads `content_plans.calendar_30d`** — legacy `user_monthly_plans`
  still checked first for backward compat. Empty days filled with "Rest Day".
  Plan anchored to `created_at`, so it spans creation-day → +30 days.
- **Toast container is inline-styled** — the Tailwind classes had no CSS
  behind them; now pinned to `bottom-right` with the app's own CSS
  variables, drop shadow, slide-in animation.
- **Onboarding = brand → intelligence**, not brand-only. Intelligence
  handles the plan generation now; the legacy brand step 3 plan is gone
  from the auto flow.
- **Toast + Ask-AI JSON parsing** — three candidate blob patterns (whole
  message, fenced json, bare `{"reply":…}`) so structured responses
  render correctly instead of dumping raw JSON.
- **Cross-account plan leak fixed** — calendar page nukes
  `sessionStorage['generatedPlan']` on load.
- **Auto-memory + auto-deploy** — every code change is committed and
  `vercel --prod` deployed by convention (per user's standing rule).

---

_Last synced: workflow reflects state at the top of the current branch._
