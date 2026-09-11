# ContentFlow — Master Product Reference

Last audited: 2026-09-11
Code-verified where possible. Sections marked *inferred* were derived from usage patterns and should be double-checked before treating as authoritative.

---

## 1. Every Page & Route

### Public routes (no auth)

| Route | Title / H1 | What it does |
|---|---|---|
| `/` | "Ads that don't look AI. For stores that ship every week." | Landing hero + inline `/try` preview + feature tabs + features grid + pricing preview + closing CTA |
| `/try` | "See your product as a UGC ad in 60 seconds." | No-signup preview generator; rate-limited 1 per IP per week; Seedance Mini 480p 5s |
| `/pricing` | "Pricing that doesn't punish testing." | 5 plan cards + trust bar + plan recommender + credit packs + competitor comparison + FAQ + anti-audience "Skip us if / We're for you if" + closing CTA |
| `/vs` | Index of competitor comparisons | Public |
| `/vs/higgsfield` | "ContentFlow vs Higgsfield — different tools for different people" | Full comparison + feature table |
| `/vs/arcads` | "ContentFlow vs Arcads — cheaper, complete, and non-expiring credits" | Full comparison + feature table |
| `/vs/heygen` | "ContentFlow vs HeyGen — different jobs" | Full comparison + feature table |
| `/vs/runway` | "ContentFlow vs Runway — creative sandbox vs. ad engine" | Full comparison + feature table |
| `/blog` | Blog index | Post listing |
| `/blog/why-your-ai-ugc-ad-looks-like-an-ai-ugc-ad` | "Why your AI UGC ad looks like an AI UGC ad — and how to fix it" | Deep essay on the six tells of AI-written UGC scripts |
| `/about` | About | Company background |
| `/help` | Help / Docs | Help section |
| `/contact` | Contact | Support form |
| `/terms` | Terms of Service | Legal T&C |
| `/privacy` | Privacy Policy | GDPR + data handling |
| `/refunds` | Refund Policy | Credit refund terms |
| `/cookies` | Cookie Policy | Cookie disclosure |
| `/data-deletion` | Data Deletion | GDPR right-to-be-forgotten form |
| `/report` | Report Abuse | User content reporting form |
| `/auth/login` | Sign in | Supabase auth |
| `/auth/signup` | Get started | Supabase auth + 30-credit bonus |
| `/presentation` | Presentation deck | Pitch/demo view |
| `/landing` | Alt landing | Marketing route |

Public-page whitelist lives in `app/layout.tsx`. If a route isn't in `publicPages`, the layout redirects unauthenticated visitors to `/auth/login`.

### Authenticated routes (must be signed in)

| Route | What it does |
|---|---|
| `/dashboard` | User home, credit balance, recent content |
| `/library` | Full generation library, filterable |
| `/generate/ugc` | UGC package builder (flagship — script → hero frame → animation) |
| `/generate/image` | Image generator (Nano Banana Pro / NB2) |
| `/generate/video` | Standalone Seedance video (no talking head) |
| `/generate/voice` | ElevenLabs TTS (30+ languages) |
| `/generate/social` | Multi-platform social captions |
| `/generate/email` | Email sequence copy |
| `/generate/blog` | Long-form blog post |
| `/generate/carousel` | Multi-slide social carousel |
| `/generate/business-card` | Business card generator |
| `/generate/screen-demo` | Screen recording + AI voiceover composite |
| `/generate/podcast-ad` | Podcast/audio ad copy |
| `/influencers` | Influencer Studio — save reusable AI creators |
| `/scenes` | Saved background/scene library |
| `/campaigns` | Campaign planner + batch generation |
| `/editor` | Video editor |
| `/ask` | Chat / assistant |
| `/onboarding` | First-run flow (brand → goals → intelligence) |
| `/settings` | Settings hub |
| `/settings/brand` | Brand kit |
| `/settings/billing` | Plan + credit packs |
| `/settings/account` | Email, password, notifications |
| `/settings/integrations` | Third-party auth (Drive, Shopify) |
| `/analytics` | Traffic / campaign analytics |

### Admin-only routes

Gated by `lib/pov-access.ts`. Admin emails: `abdallah.kooli@icloud.com`, `abdallah@icloud.com`, `kooliabdallah09@gmail.com`, plus anything in `ADMIN_EMAILS` env.

| Route | What it does |
|---|---|
| `/generate/analyzer` | Reel Analyzer — competitor ad breakdown + recreate |
| `/generate/vox` | POV Studio — narrated explainer video (alpha) |
| `/generate/formats` | Format templates hub |
| `/generate/formats/app-demo` | App demo composite pipeline |
| `/brand-launch` | AI brand kit builder (alpha) |
| `/studio` | Unified creative workspace (alpha) |
| `/admin` | Admin dashboards (actors, reports, visits) |

---

## 2. Every Feature — Grounded in Code

### UGC Package — the flagship

**Route**: `/generate/ugc`
**Component**: `components/UGCPackageBuilder.tsx` (large — the primary UI)
**API**: `/api/ugc/script`, `/api/ugc/hero-frames`, `/api/ugc/animate`, `/api/ugc/video-status`

**Inputs**: product name + hook + tone + AI creator + duration (5/10/15/20/30s) + resolution (480/720/1080/4K) + aspect ratio (9:16 default, 16:9, 1:1, 3:4) + audio on/off + CineMotion toggle
**Outputs**: MP4 rendered by BytePlus Seedance, stored URL saved in `ugc_content.storage_url`

**Models**:
- Video → **BytePlus Seedance** (2.0, 2.5, or Mini)
- Hero frame → **Google Nano Banana Pro** (`google/nano-banana-pro`)
- Script → **Claude Sonnet 4.6** (`claude-sonnet-4-6`)
- Voice → **ElevenLabs**

**Credit math** — from `lib/ugc-pricing.ts`:
- 1 credit = $0.025 USD
- Formula: `(seedance_per_s × duration + NB_pro 0.075 + Claude 0.010) × 1.4 markup / 0.025`
- At 720p 9:16, Seedance 2.0 raw = ~$0.1512/s
- Table (cr/s, ceiling): 480p ~3, 720p ~9, 1080p ~21, 4K ~44
- Silent renders get 15% discount (NO_AUDIO_MULTIPLIER = 0.85)
- CineMotion adds +14 cr (Sonnet direction + NB Pro opening frame)

**Access**: all signed-in users; Free tier limited by credit cap

### Video Generator (standalone)

**Route**: `/generate/video`
**API**: `/api/video/generate`, `/api/video/direct`, `/api/video/ai-edit`, `/api/video/rewrite-prompt`, `/api/video/transcribe`, `/api/video/editor-export`

**Inputs**: prompt text (up to 4000 chars) + optional 1-4 reference images + duration (3-60s) + resolution + aspect + audio toggle + engine (Seedance 2.0/2.5/Mini) + HyperMotion mode (pure CGI product commercial)
**Outputs**: MP4 from BytePlus, saved to library
**Models**: Seedance-only; provider constant is `'seedance'`. HyperMotion uses Sonnet vision + NB Pro opening frame.

**Credit table** (`app/api/video/generate/route.ts`):
- Seedance 2.0: 6/13/33/72 cr per second (480p/720p/1080p/4K)
- Seedance Mini: 3/7 cr per second (480p/720p only)
- Seedance 2.5: 6/13/32 cr per second (480p/720p/1080p; 4K falls back to 1080p)
- CineMotion adds +14 cr

### Influencer Studio

**Route**: `/influencers`
**API**: `/api/influencers` (list), `/api/ugc/saved-actors` (CRUD via `user_saved_actors` table)
**Models**: NB Pro for portraits + character sheets, Claude Sonnet for character direction

Stores name, character prompt, hero-frame URL. Reusable across future UGC shoots. This is Marco Vell's home.

### Product Studio

**Route**: `/generate/products` (via `components/ProductStudio.tsx`, 67 KB)
**API**: `/api/products-studio`
**What**: upload product photos once from every angle → shoot infinite AI product photoshoots in different styles
**Model**: Nano Banana Pro for compositions

### Image Generator

**Route**: `/generate/image`
**API**: `/api/content/generate` (image branch)
**Inputs**: prompt + style + model (NB Pro or NB2) + resolution (2K or 4K NB Pro only) + ratio (1:1, 3:4, 4:5, 9:16, 16:9) + count (1-4) + up to 3 reference images
**Credit**: 5 cr (NB2), 10 cr (NB Pro 2K), 18 cr (NB Pro 4K)

### Voiceover

**Route**: `/generate/voice`
**API**: `/api/voiceover`, `/api/voice-preview`
**Model**: ElevenLabs Turbo v2.5
**Credit**: `max(5, ceil(chars/80))` — 5 cr minimum

### Social captions + Image posts

**Route**: `/generate/social`
**API**: `/api/social/*`
**Model**: Claude for captions, NB2/NB Pro for images
**Credit**: 5 cr text; +3 cr for image

### Carousel

**Route**: `/generate/carousel`
**API**: `/api/carousel/*`
**Credit**: `slides × 3` (NB2) or `slides × 5` (NB Pro)

### Screen Demo

**Route**: `/generate/screen-demo`
**API**: `/api/screen-demo/*`
**What**: upload screen recording → AI voiceover + music → polished demo
**Models**: Whisper for transcription, ElevenLabs for voice, Shotstack for composition
**Credit**: `max(20, ceil(chars/80))`

### Business Card

**Route**: `/generate/business-card`
**What**: pure client-side canvas render — no AI cost
**Credit**: 0

### Campaign Planner

**Route**: `/campaigns`, `/campaigns/[id]`
**API**: `/api/campaigns/*`
**What**: plan a month of shots — each shot has hook, format, scene, caption, CTA, actor, aspect. One-click render all. Shots auto-mark done after render.

### Video Editor

**Route**: `/editor`
**What**: trim, caption, music-add on rendered videos
**API**: `/api/video/editor-export`

### Reel Analyzer (admin)

**Route**: `/generate/analyzer`
**API**: `/api/analyzer/analyze`
**Model**: Claude Sonnet 4.6 vision + Whisper transcription
**What**: upload a Reel → get format breakdown + captions + recreate-prompt for UGC

### POV Studio / Vox Studio (admin, alpha)

**Route**: `/generate/vox`
**Model**: legacy references to Kling omni exist in comments; current pipeline uses Seedance
**What**: narrated explainer videos with editorial visuals

### Brand Launch Wizard (admin, alpha)

**Route**: `/brand-launch`
**Component**: `BrandLaunchWizard.tsx` (34 KB)
**What**: AI-guided brand kit setup

### Studio (admin, alpha)

**Route**: `/studio`
**API**: `/api/studio/*`
**What**: unified creative workspace for UGC refinement

---

## 3. Pricing — Verbatim from Code

### Plans (from `lib/credits.ts` + `app/pricing/page.tsx`)

| Plan | Monthly | Annual | Credits/mo | Signup bonus | Notes |
|---|---|---|---|---|---|
| **Free** | $0 | $0 | 0 | **30 cr** | Watermarked, `/try` preview allowed |
| **Lite** | $8 | $7 | 300 | 0 | Watermark still on some outputs |
| **Starter** | $19 | $16 | 800 | 0 | No watermark, editor included |
| **Pro** ⭐ | $49 | $41 | 2,000 | 0 | Hero plan — "Ship 20 ads per week" |
| **Agency** | $149 | $124 | 6,500 | 0 | Multi-brand |

Enterprise ($605/25k cr) exists in old memory but is **hidden from public pricing page** as of positioning lock. Replaced with "contact us" mailto card.

### Credit packs (Starter+ only)

| Pack | Credits | Price | $/cr |
|---|---|---|---|
| Small | 350 | $8 | $0.023 |
| Medium | 700 | $15 | $0.021 |
| Large | 2,000 | $45 | $0.023 |
| Extra Large | 6,000 | $130 | $0.022 |

### Credit economics

- **1 credit = $0.025 USD**
- **Markup**: 1.4× on video (see `lib/ugc-pricing.ts` line 20)
- **Image tiers**: 1× (NB2), 1.8× (NB Pro 2K), 3.6× (NB Pro 4K)
- **Static costs**: Social 5cr, Email 10cr, Blog 20cr, Voice `max(5, chars/80)`

### Pricing page trust bar

Three claims sit right under the hero:
- ✓ Credits never expire
- ✓ Cancel anytime · one click
- ✓ No hidden fees · no dark patterns

---

## 4. Landing Page Copy — Verbatim

### Hero

**Eyebrow**: `The AI ad engine for dropshippers`
**H1**: `Ads that don't look AI. For stores that ship every week.` (with "don't look AI" in italic red)
**Subhead**: `Paste your Shopify, TikTok Shop, or Amazon URL. Get a week's worth of platform-safe UGC ads — script, hero frame, actor, voice, captions. One wallet. Every language. Credits that don't expire.`

**Inline component**: `<PreviewGenerator compact />` — the `/try` preview lives here.

**Secondary link row**: "Skip preview → create free account" · "See how it works"

### Feature tab section H2

`Every tool your brand needs. One place.`

### Feature tabs (4)

1. **Influencer Studio** — H3 "Build your AI creator in minutes"
   Body: Pick a name, niche, look, and aesthetic from chips — or just describe them. ContentFlow generates a photorealistic portrait and 4K character sheet.
   Tags: `NB Pro 4K`, `Character sheets`, `Reference upload`
   Portrait: Marco Vell (male, penthouse-life persona)
   Chips: Penthouse / Lifestyle / Dry humor / Dark hair / 25-29 / Brown eyes / Clean shave / Male
   Right-column pills: Photorealistic · 4K, NB Pro

2. **Video Generator** — Card title "UGC ads that look real"
   Body: Drop a product photo, pick your AI creator, choose a hook. Get a finished 9:16 UGC ad with voice, captions, and b-roll — ready to post.
   Tags: `Seedance 2.0`, `Seedance 2.5`, `9:16 & 16:9`

3. **Image Generator** — "Studio-quality photos"

4. **Product Studio** — cards:
   - `Phone photo → editorial shot` — Upload casual phone photos. Get magazine-worthy product shots — splashes, flat lays, hero stacks. (Tags: Remove background, Custom scenes, Batch export)
   - `Physics-driven motion` — Turn your product shot into a premium CGI ad with real motion and lighting.
   - `Feed every format` — Product photos feed your UGC ads, captions, blog posts, and emails automatically.

### Features grid (6 cards, always visible below tabs)

1. **UGC video packages** — One product photo in, a finished UGC ad out: script, character, voice, captions and b-roll, ready to post.
2. **AI influencers** — Your AI creator remembers your brand across every shoot — same face, same voice, same identity, forever. No other tool does this.
3. **Product Studio** — Upload phone photos and get editorial product shots — splashes, flat lays, hero stacks. Those same photos feed your UGC ads, captions, and blog posts automatically.
4. **CineMotion ads** — Premium CGI product ads from your product photos — physics-driven motion, designed environments, native audio.
5. **Voices & captions** — Natural AI narration plus word-synced captions burned straight into the video — no external editor needed.
6. **Built-in editor & library** — Trim, caption, and score your clips in the browser — every render backs up automatically to your own Google Drive.

### Made with ContentFlow marquee

Conditionally shown when `DEMO_VIDEOS.length > 0` from `lib/demo-gallery.ts`. Currently displays if populated. H2: "Made with ContentFlow"

### Closing CTA

`Get started free` → `/auth/signup`

### Footer

- **Product**: Features, Pricing, Docs
- **Company**: About, Blog, Contact
- **Compare**: vs Higgsfield, vs Arcads, vs HeyGen, vs Runway
- **Legal**: Privacy, Terms, Refund policy, Cookies

---

## 5. Pricing Page Copy — Verbatim

**Eyebrow**: `The AI ad engine for dropshippers`
**H1**: `Pricing that doesn't punish testing.` ("punish testing" in italic red)
**Subhead**: `One wallet. Every format your store needs. Credits that don't expire — no matter how many hooks you kill.`

**Trust bar** (three ✓ claims — see above).

**Plan taglines** (shown under plan name):
- Free: `Try one ad. No card.`
- Lite: `One product a week. Test the tool.`
- Starter: `Test 20 hooks per month.`
- Pro: `Ship 20 ads per week.` (Most Popular)
- Agency: `Multiple brands. Multiple stores.`

**Comparison table headers**: ContentFlow · Arcads · Creatify · HeyGen · Higgsfield
Rows: credits never expire, URL → 20 variants, UGC talking-head ads, Product Studio, 30+ language voice, complete stack, cancel anytime.

**FAQ questions** (7):
1. Do credits expire?
2. Will these ads get my Meta or TikTok account banned?
3. Can I cancel anytime?
4. What languages do you support?
5. Do I need to know how to edit video?
6. How many ads can I actually make?
7. What if I need more than Agency?

**Anti-audience section**:
- Skip us if: filmmaker, Fortune 500 marketing, corporate training, full timeline editor, product isn't a physical thing
- We're for you if: sell physical products anywhere, URL OR product photo works, founder/marketer/agency operator/one-person brand, test ad hooks weekly, been burned by credit-based tools, want one wallet not four subscriptions

**Contact card**: "Higher volume, multiple seats, or white-label? Custom pricing for real usage." → mailto `hello@contentflow-web.com`

**Bottom CTA H2**: `Ship your first ad in 60 seconds`

---

## 6. Positioning-Related Docs (Repo Root)

Four load-bearing markdown files:

- **`POSITIONING.md`** — locked positioning. Category = "The AI ad engine for dropshippers". Tagline = "Ads that don't look AI. For stores that ship every week." Four claims, three enemies, words to use/kill, ICP, anti-audience.
- **`BUSINESS.md`** — financials. 1 credit = $0.025, 1.4× markup, blended margin ~45%, LTV ~$80, CAC ~$6, LTV:CAC ~13:1, break-even at ~15-20 paying users.
- **`ARCHITECTURE.md`** — technical reference. Vercel + Supabase + BytePlus + Vertex + Anthropic + ElevenLabs + Dodo. Full user-flow walkthroughs.
- **`MARKETING.md`** — 6-month organic launch plan. TikTok, Twitter, affiliate, Product Hunt, cold DMs. Priority order + weekly checklist.

---

## 7. Data Model (Supabase)

**Confirmed tables** (grep'd from API routes):

| Table | Purpose |
|---|---|
| `auth.users` | Supabase-managed accounts |
| `user_credits` | `{user_id, plan, balance, pack_credits}` — one row per user |
| `credit_transactions` | Audit trail of every credit change |
| `ugc_content` | The Library — every generated video/image/thing |
| `brand_profiles` | Brand kit per user |
| `campaigns` + `campaign_shots` | Campaign planner |
| `user_saved_actors` | Reusable AI creators (Marco Vell lives here) |
| `user_influencers` + `user_influencer_photos` | Newer influencer storage |
| `user_studio_products` + `user_studio_product_photos` | Product Studio |
| `user_scenes` | Saved backgrounds |
| `integrations` | Google Drive, Shopify, YouTube OAuth tokens |
| `page_visits` | Traffic analytics |
| `user_subscriptions` | Dodo/Stripe/Paddle subscription state |
| `data_deletion_requests` | GDPR |
| `abuse_reports` | User-reported content |

**Row-level security**: every table filtered by `user_id`. Service-role bypass used only in server API routes.

---

## 8. External Services

| Service | What it does | Wrapper file | Model IDs pinned |
|---|---|---|---|
| **BytePlus** (Seedance) | Video generation | `lib/seedance.ts` | `dreamina-seedance-2-0-260128`, `dreamina-seedance-2-5-260628`, `dreamina-seedance-2-0-mini-260128` |
| **Google Vertex** | Nano Banana Pro / NB2 images, Veo 3.1 admin video | `lib/nanobanana.ts`, `lib/vertex-video.ts` | `google/nano-banana-pro`, `google/nano-banana-2`, Veo 3.1 Fast for admin |
| **Anthropic** | Claude scripts + prompts + analysis | inline in many routes | `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`, `claude-opus-4-7` |
| **ElevenLabs** | Voice + Speech-to-text | `lib/elevenlabs.ts`, `lib/scribe.ts` (if present) | Turbo v2.5 |
| **Dodo Payments** | Subscription + credit pack billing | `app/api/dodo/*` | webhooks for `subscription.*` + `payment.*` |
| **Shotstack** | Video render composition (screen-demo) | `lib/shotstack.ts` | ~$0.06/min rendered |
| **Fal.ai** | Background removal | `lib/fal.ts` | replaced Replicate bg-removal |
| **Google Drive** | User-side backup | `lib/drive.ts` | OAuth 2.0 |
| **Shopify** | Product URL scraping | `lib/preview-scraper.ts` handles OG scrape generally | Storefront API for full imports |
| **YouTube** | Auto-publish (cron) | `app/api/youtube/*` | Data API v3 |

---

## 9. Storage — `ugc-assets` bucket

**Intermediate prefixes** — daily cleanup via cron at 04:00 UTC (`lib/storage-cleanup.ts`):

| Prefix | Max age | Reason |
|---|---|---|
| `preview-refs/` | 7 days | `/try` product images |
| `preview-output/` | 7 days | `/try` output (currently unused — Seedance URLs are direct) |
| `video-ref/` | 14 days | `/generate/video` reference frames |
| `hero-frames/` | 30 days | Nano Banana keyframes for UGC |
| `kling-source/` | 30 days | Legacy name for hero-frames used by motion-broll |

**Never touched**: `omni-output/`, `sora-output/`, `demo/`, `influencers/` (creator portraits and character sheets).

Cron endpoint: `GET /api/cron/cleanup-storage`, guarded by `Authorization: Bearer $CRON_SECRET`.

---

## 10. Credits — how it works

**Signup bonus**: **30 credits** (source of truth: `lib/credits.ts:21`).

**Deduction flow**:
1. API route computes cost (e.g. 91 cr for 5s UGC)
2. `deductCredits(userId, cost, ...)` in `lib/deduct-credits.ts` — atomic, prevents race conditions
3. Writes to `credit_transactions` for audit trail

**Refill**:
- Monthly subscription resets `balance` on billing anniversary
- Pack purchases: added to a separate `pack_credits` column that carries over independently
- **Credits never expire**

---

## 11. Admin / alpha features

Gated by `lib/pov-access.ts`. Admin emails: `abdallah.kooli@icloud.com`, `abdallah@icloud.com`, `kooliabdallah09@gmail.com`. Overridable via `ADMIN_EMAILS` / `NEXT_PUBLIC_ADMIN_EMAILS` env vars.

| Feature | Route | Gate function |
|---|---|---|
| POV Studio | `/generate/vox` | `canAccessPovStudio()` |
| Multi-Agent Chat | `/api/assistant/chat` | `canAccessMultiAgentChat()` |
| Reel Analyzer | `/generate/analyzer` | `canAccessReelAnalyzer()` |
| Formats Hub | `/generate/formats/*` | `canAccessFormats()` |
| Scroll-Stop Hook | UGC option | `canAccessScrollStopHook()` |
| Omni Flash Video | `/api/video/generate` fallback | `canAccessOmniFlashVideo()` |
| Brand Launch Wizard | `/brand-launch` | `canAccessBrandLaunch()` |
| Studio (unified) | `/studio` | `canAccessStudio()` |

---

## 12. Legal / policy pages

All exist at their routes. Contents are early/boilerplate — real legal review pending.

- `/terms` — service description (rewritten to drop "AI-powered platform" language on 2026-09-11)
- `/privacy`
- `/refunds`
- `/cookies`
- `/data-deletion` — functional GDPR form
- `/report` — functional abuse form

---

## 13. Marketing surfaces

### `/vs/*` competitor pages

Data-driven from `app/vs/[competitor]/page.tsx`. Rewritten 2026-09-11 to match locked positioning. Four covered:
1. `higgsfield` — reframed as "different tools for different people"
2. `arcads` — leads with price + non-expiring credits + editor-included
3. `heygen` — reframed as "different jobs" (enterprise vs. e-com)
4. `runway` — "sandbox vs. ad engine"

### `/blog`

- `why-your-ai-ugc-ad-looks-like-an-ai-ugc-ad` — analytical piece on the six tells of AI-written UGC scripts. Reinforces positioning (AI ads are recognizable → we fix that).

### Sitemap (`app/sitemap.ts`)

Prioritized for SEO — landing 1.0, pricing 0.9, `/vs/*` 0.8, blog 0.8, about/help 0.7, legal 0.3.

---

## 14. Environment variables

**Required for prod**:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `BYTEPLUS_API_KEY`, `BYTEPLUS_REGION` (default `johor`)
- `GOOGLE_VERTEX_SA_JSON`, `GOOGLE_VERTEX_REGION`, `GOOGLE_NANO_BANANA_MODEL`, `GOOGLE_NANO_BANANA_PRO_MODEL`
- `ELEVENLABS_API_KEY`
- `DODO_*` (webhook secret + API keys)
- `CRON_SECRET` (used by Vercel Cron)
- `ADMIN_EMAILS` (optional; fallback list hardcoded)

**Optional / legacy**:
- `OPENAI_API_KEY` (Whisper legacy)
- `STRIPE_SECRET_KEY` (Stripe legacy)
- `SHOTSTACK_API_KEY`, `FAL_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Drive OAuth)

---

## 15. Recent milestone changes (since 2026-08)

- **Positioning locked** (`a7be2af`): category + tagline + POSITIONING.md
- **Pricing page rewritten** (`ac8dbb5`): plan taglines, anti-audience, trust bar, Enterprise hidden
- **`/try` preview generator** (`a75ef04` + `f7aa293`): public no-signup demo wired into landing hero
- **Powered-by section removed** (`7319f73`): contradicted the anti-AI tagline
- **Storage cleanup cron** (`a270123`): daily 04:00 UTC janitor
- **BUSINESS.md, ARCHITECTURE.md, MARKETING.md, POSITIONING.md, PRODUCT.md** committed as repo-root reference docs
- **Sidebar sticky fix** (`124d8f1`): `align-self: flex-start` fix
- **Kling/Sora dead code ripped** (`c7fbbe9`): Seedance-only
- **Marco Vell portrait** (`e7600f2`): swapped Influencer Studio hero to the male creator
- **`/vs/*` full rewrite** (2026-09-11): all four competitor pages reframed as "different tools for different people" honesty

---

## 16. Model versions pinned (as of 2026-09-11)

| Domain | Model | ID |
|---|---|---|
| Video | Seedance 2.0 | `dreamina-seedance-2-0-260128` |
| Video | Seedance 2.5 | `dreamina-seedance-2-5-260628` |
| Video | Seedance Mini | `dreamina-seedance-2-0-mini-260128` |
| Image | Nano Banana Pro | `google/nano-banana-pro` |
| Image | Nano Banana 2 | `google/nano-banana-2` |
| Text | Claude Sonnet 4.6 | `claude-sonnet-4-6` |
| Text | Claude Haiku 4.5 | `claude-haiku-4-5-20251001` |
| Text | Claude Opus 4.7 | `claude-opus-4-7` (used in `/ask`, admin tools) |
| Voice | ElevenLabs | Turbo v2.5 + v3 |

---

## 17. Doc-writing note

This file is a snapshot. When features ship, prices change, or positioning shifts, edit **POSITIONING.md and PRODUCT.md together** — they're the two the founder should re-read before making a major decision.
