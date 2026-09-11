# ContentFlow — Master Product Reference

Last audited: 2026-09-11
Self-contained. Feed this file to an external reviewer (human or AI) with no prior context and they should understand the product, the positioning, the market, the business model, the constraints, and the gaps between strategy and reality.

---

## 0. Context for the reader — TL;DR

**What ContentFlow is**: An AI web app that turns a product URL (Shopify, TikTok Shop, Amazon, or a raw product photo) into a full week's worth of UGC-style video ads — script, hero frame, AI creator, voice, captions — in one wallet. Built for solo dropshippers and one-person e-com stores, not for enterprises, filmmakers, or agencies.

**Category we position as**: "The AI ad engine for dropshippers"
**Tagline**: "Ads that don't look AI. For stores that ship every week."

**Live production URL**: https://contentflow-web.com
**Tech stack**: Next.js 14 + Supabase (Postgres + Auth + Storage) + Vercel serverless + Dodo Payments + BytePlus Seedance + Google Nano Banana Pro + Anthropic Claude + ElevenLabs

**Founder context**: Solo indie founder, self-taught, launching on a very tight bootstrap budget covering both infrastructure and API prepayments (mid-three-figures total, one-time). This is pre-launch — no paying customers yet. All positioning is theoretical/tested-against-research until real users arrive.

**Currently deployed features**: 20+ generator tools + Influencer Studio + Product Studio + Campaign Planner + Library + Editor + Brand Kit + `/try` no-signup preview + `/vs/*` competitor comparison SEO pages + Dodo billing integration + daily storage cleanup cron.

**What's NOT yet built** (positioning claims not fully backed by product yet, honest):
- Batch mode UI (10-variant one-click generation) — API exists, UI hidden
- Platform-safety review layer (positioning claims platform-safe but there's no actual detection/checker)
- Localized script generation per country (voice supports 30+ langs, but hooks/scripts are English-primary)
- Direct ad-account launcher (Meta/TikTok Ads posting)
- Per-ad cost estimator widget on pricing page

**Critical strategic decision** made 2026-09-11: locked positioning around dropshippers after competitor + buyer-psychology research. Prior positioning was generic "AI content platform." Every landing/pricing surface has been rewritten to enforce the new position.

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

Gated by `lib/pov-access.ts`. Three hardcoded founder admin emails, plus anything in `ADMIN_EMAILS` env var.

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

## 6. Positioning — the strategic center

Locked 2026-09-11 after competitor audit + buyer psychology research. Every marketing surface must reinforce it. If a piece of copy or feature doesn't help sell it, we cut it.

### 6.1 The decision

- **Category**: "The AI ad engine for dropshippers"
- **Tagline**: "Ads that don't look AI. For stores that ship every week."

### 6.2 Who we serve (ICP — ideal customer profile)

Solo dropshippers and one-person e-com stores who:
- Test 10+ ad variants per week
- Sell primarily on TikTok Shop, Shopify, Amazon, TikTok/Meta ads
- Are the founder + operator (not a marketing team)
- Have a $19-$149/mo tool budget and REJECT anything over $200
- Care about margin and unit economics
- Fear ad account bans more than any other loss
- Cannot afford to burn credits on generations they can't use

### 6.3 Who we do NOT serve (anti-audience — stated on pricing page)

- Filmmakers → try Runway
- Enterprise brand teams and Fortune 500 → try Higgsfield
- L&D / corporate training → try Synthesia
- Agencies managing 50+ clients (they need real API + white-label at scale)
- Users who want a full timeline editor → try CapCut
- Anyone whose primary product isn't a physical thing

### 6.4 The positioning statement (long form)

**For** solo dropshippers and one-person e-com stores
**Who** need to ship 20+ ad variants per week without stacking 4 tools or losing their ad account
**ContentFlow is** the AI creative engine that turns any product URL into a full week's worth of platform-safe, human-passing ads — with one wallet, one workflow, and honest pricing.
**Unlike** Arcads (expensive, no editor), Creatify (lip-sync tells, billing complaints), Higgsfield (built for cinema, not conversion), or the 4-tool stack (fragmented),
**Our product** owns the complete creative loop: URL → script → hero frames → talking avatar → product shots → captions → voice → export. In your language. In your brand. At one flat price.

### 6.5 The four claims we lead with everywhere

| Claim | Pain it attacks | Proof point on the site |
|---|---|---|
| **Doesn't look AI** | Market fatigue with AI ads. TikTok removed 51,618 synthetic videos in H2 2025. Meta flagged 13M+ AI ads. AI is now a NEGATIVE signal in comments. | Actor gallery (Marco Vell etc.), real generated ads on landing marquee, side-by-side vs. competitor slop |
| **Doesn't burn credits** | Universal industry rage — Arcads, Higgsfield, Creatify all lose users to credit-burn on failed generations. | "Credits never expire" trust bar on pricing + hero + FAQ |
| **Doesn't need 4 tools** | Stack problem — dropshippers use Arcads + Higgsfield + Creatify + CapCut. Nobody closed the loop. | "One wallet" hero + full feature grid + comparison table |
| **Speaks your buyer's language** | English-first tool limitation. Underserved geographies: Portuguese (BR), Arabic, Turkish, Spanish (LatAm). | Voice output in 30+ languages via ElevenLabs |

### 6.6 The three enemies we name in copy

Great positioning names its enemies. Ours are:

1. **The 4-tool stack** — "Stop paying for Arcads + Higgsfield + Creatify + CapCut. One wallet does everything."
2. **Credit-burn anxiety** — "You paid $99 and got 3 usable ads. That's not how we work." Counter: credits never expire.
3. **AI slop that gets you banned** — "Ads that look like ads." Counter: platform-safe passing outputs.

### 6.7 Words we KILL (market fatigue signals)

- ❌ "AI-generated" (now negative)
- ❌ "Revolutionary" / "next-gen" / "cutting-edge"
- ❌ "10x your content" (played out)
- ❌ "Fortune 500 uses us" (wrong audience)
- ❌ "Cinematic" (Higgsfield owns; wrong for us)
- ❌ "Content platform" (dead phrase)
- ❌ "AI video generator" (dead phrase)

### 6.8 Words we USE

- ✅ "Your creative team, for one wallet"
- ✅ "Ads that don't look AI"
- ✅ "Every hook. Every angle. Every language."
- ✅ "One product URL. Twenty ready-to-run ads."
- ✅ "Ship. Test. Kill. Repeat."
- ✅ "Ads for stores that ship every week"

### 6.9 The one test that decides everything

If a feature, price, landing block, or piece of copy is unclear, ask:

> **"Does this help a solo dropshipper ship more ads that don't look AI, without paying for 4 tools?"**

Yes → ship. No → cut.

### 6.10 Success criteria — how we know positioning is working

Positioning is winning when:
- Landing → `/try` conversion > 25%
- `/try` → signup > 20%
- Search traffic includes "dropshipper" adjacent terms
- Support/DMs quote the tagline verbatim
- Users describe us as "the dropshipper tool" without prompting
- Churn stays < 10%/month

Positioning is failing when:
- Users compare us to Runway or Synthesia (wrong audience reached)
- CAC creeps up (message isn't resonating)
- Users ask for enterprise features
- Churn reasons cite Higgsfield or HeyGen as replacements

### 6.11 Companion docs (all live at repo root)

- **`POSITIONING.md`** — extended positioning brief with full rationale
- **`BUSINESS.md`** — financial model + unit economics + break-even scenarios + KPIs
- **`ARCHITECTURE.md`** — technical architecture + service diagrams + user flow walkthroughs
- **`MARKETING.md`** — 6-month organic-first launch playbook

---

## 6A. Strategic context — WHY these decisions

If an external reviewer asks "why did they make these choices?", this section answers.

### 6A.1 Why dropshippers (not enterprises, not creators, not agencies)

Chose dropshippers over other segments because of five converging factors:

1. **Product-market fit is already there.** Every existing generator was built for physical products with URLs. Refactoring would be trivial vs. rebuilding for another segment.
2. **The word "dropshipper" is unclaimed on any competitor homepage.** Higgsfield, Arcads, Creatify, HeyGen all target "marketers," "brands," "creators," or "enterprise." Zendrop uses the word but is a supplier-first company. Vacant category.
3. **They test more, buy more.** A dropshipper generates 20-50 ad variants per week. A SaaS founder generates 2-4/month. Same subscription price, ~10× the credit consumption + higher retention through habit.
4. **Distribution is solved.** Dropship Twitter, r/dropship, TikTok creator community, YouTube gurus like Beast of Ecom, Nathan Nazareth, Jordan Welch. Known channels with known playbooks.
5. **Founder can identify with the audience.** Small operators, budget-conscious, allergic to enterprise sales — the founder is a solo indie builder cut from the same cloth.

### 6A.2 Why NOT compete on model breadth

Every AI video tool now brags about number of models (Higgsfield: 50+, Runway: 5+ integrated). We use Seedance-only.

Reasons this is deliberate:
1. **Seedance 2.0 quality matches or beats Kling and most Sora 2 outputs for UGC-style talking heads at 720p.** Higher variance isn't higher quality for our use case.
2. **1.4× markup vs. 2×+ industry standard** is possible because we don't have to price in "cover the expensive model too." Seedance's pricing is transparent (~$0.15/s at 720p).
3. **Single-vendor simplicity** means faster shipping, fewer integration bugs, tighter margin control.
4. **The audience doesn't care.** Dropshippers care if the ad converts, not what model powered it. Model-breadth is a developer-audience trust signal, not a buyer signal.

Downside accepted: we lose "model breadth" as a positioning wedge, but we never wanted that wedge.

### 6A.3 Why the "doesn't look AI" tagline

Buyer-psychology research (2026-09) surfaced this as the #1 market shift: AI ads used to work because they were novel. Now they fail because they're everywhere. TikTok removed 51,618 synthetic media videos. Meta flagged 13M+ AI ads. If an ad reads as AI in the comments, CTR craters.

Nobody else has this positioning claim explicitly. Higgsfield leans into AI. Arcads brags about motion-capture actors. HeyGen touts avatar polish. We're the only one saying "the point is you can't tell it's us."

**Risk**: we don't yet have a platform-safety review layer built. The claim is aspirational until we ship compliance checking. Honest gap.

### 6A.4 Why "credits never expire"

Every competitor's #1 churn driver is credit burn. Arcads (Trustpilot: "credits die at end of cycle"). Higgsfield (top-ups expire in 90 days). Creatify (credit shortfalls on Starter). Every review site cites it.

This is a business-model decision: it costs us nothing (we already store balance in Postgres, we just don't zero it on cycle roll). It's a trust wedge that directly counters every competitor's scandal reputation.

**Downside**: users who signed up during a promo and never returned still hold "value" on our balance sheet. Small accounting quirk, not a real cost.

### 6A.5 Why hide the Enterprise tier

Original Enterprise was $605/mo, 25k credits. Hid it because:
1. Wrong-audience signal — if visitors see $605 they think "this is enterprise SaaS, not for me."
2. Anti-audience section works better without a big enterprise price to argue against.
3. Real enterprise buyers email anyway. Custom quote is more profitable than shelf pricing.

Replaced with a subtle "Higher volume, multiple seats, or white-label? Contact us" mailto card.

### 6A.6 Why free tier is 30 credits (not 60, not 100)

Cheapest UGC video is ~95 credits (Seedance Mini 480p 5s). Signup bonus of 30 does NOT let a new user render a UGC video — deliberate.

The theory:
- 30 credits lets them play with social captions, product images, voice, carousel — cheap features that showcase quality
- To do a UGC video (the flagship), they must upgrade or use the `/try` preview
- `/try` costs us $0.18 per anonymous visitor (Seedance Mini 480p 5s watermarked)
- $0.18 to a preview is cheaper than $1.70+ to a burned-through free signup

Deliberate friction placement.

### 6A.7 Why price ladder is $8/$19/$49/$149

From competitor pricing research:
- **$29-$79/mo with predictable pricing + high-quality UGC + dropshipper language** is the empty square in the market.
- Our Starter $19 undercuts Arcads Starter ($77-110) by 4×.
- Our Pro $49 (marked "Most popular") sits in the empty $49-79 slot with dropshipper-explicit positioning nobody else has.
- Agency $149 matches Higgsfield's mid-tier price with a 100% different offering.

Sweet spot for dropshippers per research: $29-$110/mo. Rejection threshold: $200+.

### 6A.8 Why the `/try` preview generator exists

Two purposes:
1. **Convert cold traffic without burning $1.70/UGC on signup freebies.** Preview costs $0.18. Signup UGC would cost $1.70 vendor cost. 10× cheaper to convert.
2. **Kills the "is this real?" objection.** Visitor pastes their actual product URL and watches it become an ad in 60 seconds. No screenshots to fake, no marketing video — the product IS the proof.

Rate limit: 1 per IP per 7 days. In-memory Map (not perfect for Vercel serverless, worst case someone gets 2-3). Acceptable at $0.18 cost.

---

## 6B. Market landscape — competitors in detail

### 6B.1 Direct competitors (segment overlap)

| Competitor | ARR | Users | Pricing | Their strength | Their weakness |
|---|---|---|---|---|---|
| **Higgsfield** | $700M | 30M | $19-$129/mo + Enterprise | Cinema-grade camera controls, 50+ models, strong brand, agentic Supercomputer | Credits expire (90d top-ups), enterprise-flavored UX, motion inconsistent on complex prompts, wrong for UGC feel |
| **Arcads** | $15M | 6,000 customers | $29-$500+/mo | Best-in-class motion-capture actors, largest realistic actor library, top marketer positioning | Starts at $110/mo for talking actors, editor is $80 add-on, Trustpilot billing scandal, lip-sync drift in 15% of outputs |
| **Creatify** | $9M | 1M+ users | Free-$99/mo + Enterprise | URL-to-video pipeline (closest thing to our workflow), Alibaba/Comcast customers, ad launcher | Credit shortfalls on Starter, formulaic script arcs, unauthorized charges complaints |
| **HeyGen** | $200M | 30M | Free-$149/mo + Enterprise | 175+ language translation, studio-quality digital twins, SOC2/enterprise, 85% Fortune 100 | Feels corporate not UGC, per-minute credit math punishes iteration, no product URL workflow |
| **Icon.me** | $5M (unstable) | Small | $1,000/mo | Human authenticity ("The Human Admaker"), refund guarantee | Extremely fragile ops, reports of Feb 2026 shutdown, 6 ads/mo very low volume |
| **AdCreative.ai** | ~$25M | Large | $29-$399+/mo | Banner-first heritage, creative scoring model, high G2 volume | Massive billing/refund scandal reputation, videos gated at $249, quality trails competitors |
| **Pippit (ByteDance)** | Unknown | Riding CapCut's 400M | Free-$90/mo | ByteDance backing, TikTok-native, generous free tier (150 credits/wk), URL workflow | Newer (2025), output consistency varies, weaker cross-platform than TikTok |
| **Synthesia** | ~$100M | Large | $29-$25k/yr | 240+ avatars, SCORM/LMS, enterprise leader in L&D | Not for ads at all, no product URL workflow, enterprise-only pricing above starter |
| **Zendrop AI Ads** | ~$30M | 3M sellers | Free-$199/mo | Dropshipping-native (supplier + store + ads all-in-one), MCP integration, YouTube guru dominance | Ads are a bundled feature not best-in-class; supplier-first company |
| **Runway** | $300M | Large | $12-$76/mo | Cinematic AI video, Gen-4, Act-Two, pro NLE integrations | Requires creative skill, no product URL workflow, per-clip credit math bad for ad testing |
| **MakeUGC / CreateUGC / EzUGC / AgentMedia** | Low millions | Small-medium | $19-$119/mo | Undercuts Arcads/Creatify 40-60% on price, faster time-to-video | Quality gap, small model diversity, weak brand, low switching cost |

### 6B.2 Empty positioning slot we occupy

The `$29-$79/mo flat-priced high-quality UGC + dropshipper-explicit language + multi-language output` slot is empty. We fit there directly with Pro $49.

### 6B.3 Distribution channels & who owns them

Underweighted channels (where we can win):
- **Shopify App Store listing** — huge blind spot for direct competitors
- **Dropshipping-guru YouTube sponsorships** — Zendrop dominates supplier ads; no ad-tool moved in
- **Reddit r/dropship / r/ecommerce / r/shopify** — every competitor underweighted
- **Multi-language dropshipper communities** — Portuguese BR, Arabic, Turkish, Spanish LatAm

Contested channels (harder):
- TikTok organic — Pippit is native to CapCut, Creatify posts heavily
- Twitter/X — Arcads and Higgsfield dominant on founder-led content
- Product Hunt — diminishing returns for AI tools

Skip:
- LinkedIn — wrong audience
- Paid Meta/TikTok ads at launch — margin killer without proof

---

## 6C. Business model — unit economics

### 6C.1 The credit economy

- **1 credit = $0.025 USD** (customer-facing price)
- **Markup**: 1.4× on video vendor cost, 1.8× on premium images, 3.6× on 4K images
- **Payment processor**: Dodo Payments (~3.5% + $0.30 per transaction)

### 6C.2 Cost per generation (raw vendor cost, before markup)

From `lib/ugc-pricing.ts`:

| Generation | Raw cost | Retail cr | Retail $ | Gross margin |
|---|---|---|---|---|
| UGC 5s @ 480p Mini | ~$0.18 | ~15 cr | $0.38 | +$0.20 |
| UGC 5s @ 720p Seedance 2.0 | ~$0.84 | ~45 cr | $1.13 | +$0.29 |
| UGC 10s @ 720p (2.0) | ~$1.60 | ~90 cr | $2.25 | +$0.65 |
| UGC 10s @ 1080p (2.0) | ~$3.83 | ~210 cr | $5.25 | +$1.42 |
| Image NB Pro 2K | $0.075 | 5 cr | $0.13 | +$0.05 |
| Voiceover per 100 chars | $0.03 | 5 cr | $0.13 | +$0.10 |
| Preview (`/try`, loss leader) | $0.18 | 0 | $0 | **-$0.18** |

### 6C.3 Revenue per plan (net of Dodo fee ~3.5%)

At 70% credit utilization (realistic):

| Plan | Price | Net after fees | Vendor cost | Gross profit/user/mo |
|---|---|---|---|---|
| Free | $0 | $0 | -$0.38 | **-$0.38** (loss leader) |
| Lite | $8 | $7.42 | $3.75 | **+$3.67 (49%)** |
| Starter | $19 | $18.34 | $10.00 | **+$8.34 (45%)** |
| Pro | $49 | $47.28 | $25.00 | **+$22.28 (47%)** |
| Agency | $149 | $144.38 | $81.25 | **+$63.13 (44%)** |

### 6C.4 Unit economics per paying user (blended)

Assuming 60% Lite / 30% Starter / 10% Pro mix:

- ARPU: $15.40/mo
- Net revenue after fees: $14.40/mo
- Blended vendor cost: $7.75/mo
- **Gross profit per paying user: $6.65/mo**
- Assumed monthly churn: 8-10%
- LTV (12-mo cohort): **~$80**
- Marketing cost per paid user acquired: **~$6** (organic mix)
- **LTV : CAC ratio: ~13:1** (healthy: >3:1)
- **Payback period: ~1 month**

### 6C.5 Fixed monthly costs

- Vercel Pro: $20/mo
- Supabase Pro: $25/mo
- Domain: ~$1.25/mo
- ElevenLabs Creator (optional): $22/mo
- **Baseline: ~$46-68/mo**

### 6C.6 Break-even

- **Fixed-cost break-even**: 7 paying users (~$60 MRR)
- **All-in break-even**: 15-20 paying users
- Cash-flow positive by month 2-3 in all scenarios except pure zero-traffic launch

### 6C.7 Realistic 24-month scenarios

Assumptions: 20% visitor→signup, 8% signup→paid, 10% monthly churn.

| Scale | Visitors/day | Steady paid users | Steady MRR | Monthly gross profit |
|---|---|---|---|---|
| Slow launch | 50 | 240 | $1,600 | $1,379 |
| Moderate | 200 | 960 | $6,384 | $5,654 |
| Successful | 1,000 | 4,800 | $31,920 | $28,350 (~$340k/yr) |

---

## 6D. Constraints — real-world context for the reviewer

An outside reviewer should factor these in when giving feedback.

### 6D.1 Team + capital

- **Solo founder**, no team, no contractors
- **Very tight bootstrap budget** for launch (low mid-three-figures, one-time — covers infra + all API prepayments, before revenue)
- No investor money, no runway beyond that budget until users pay
- No co-founders, no advisors, no ops help

### 6D.2 Time constraints

- Cannot commit to 4-6hrs/day of TikTok/DM grind that the marketing plan calls for
- Cannot ship features at aggressive velocity — solo dev, non-full-time on the project, no delegation
- MRR must arrive fast enough to fund month 2 infra ($46/mo) or budget dies

### 6D.3 Product maturity

- **20+ generators exist and work** — not vaporware
- **`/try` public preview generator works** — visitors can prove the product without signup
- **Dodo Payments live** — real billing, not test mode
- **Deployment cadence**: commit + push + `vercel --prod` after every code change (standing rule)
- **Not yet real**: batch mode UI (API exists), platform-safety layer, localized script generation, Meta/TikTok ad launcher

### 6D.4 Legal / operational unknowns

- No LLC yet; personal-name accounts
- No SOC2, no enterprise infrastructure
- No customer service tooling (no Intercom, no help desk)
- Refund + chargeback handling is manual; no fraud tooling

### 6D.5 What's genuinely working

Backed by code:
- End-to-end UGC generation pipeline (script → hero frame → animation) with real Seedance video
- Product Studio can generate infinite product shots from phone photos
- AI Influencer Studio produces reusable brand-locked creators (Marco Vell exists)
- Credit system with atomic deduction + audit trail
- Storage cleanup cron runs daily
- Dodo Payments integration handles subscriptions + webhooks
- `/vs/*` SEO comparison pages are indexed and ranked

### 6D.6 What has NEVER been tested at scale

- Zero real users (~7 total accounts, mostly the founder + friends)
- Zero real revenue (Dodo works but hasn't processed a paying subscription)
- Load-testing on video-status polling under real concurrency
- Actual dropshipper feedback on outputs
- Actual TikTok/Meta ad account response to our outputs (platform-safe is untested)

---

## 6E. Known gaps — positioning claims that need product proof

For an honest external review, here's where reality doesn't yet match positioning:

| Positioning claim | Reality | Priority to close |
|---|---|---|
| "Ads that don't look AI" | Output quality is Seedance-baseline; no dedicated tuning or human-passing checker | HIGH — could ship a review/warning layer |
| "Ship 20 ads per week" (Pro plan) | Batch mode UI is hidden; users must generate one-by-one | HIGH — turn UI back on |
| "Speaks your buyer's language" | Voice supports 30+ langs but scripts are English-primary in prompts | MEDIUM — add locale flags to script gen |
| "Platform-safe" | No detection layer; claim is aspirational | HIGH — even a warning layer would help |
| "URL → 20 variants" | URL scrape works; 20-variant generation not one-click yet | HIGH — same as batch mode |
| "Credits never expire" | ✅ Actually true — code and pricing enforce this | DONE |
| "One wallet" | ✅ Actually true — everything under one account | DONE |
| "Cancel anytime · no dark patterns" | Cancel flow exists but isn't one-click yet | MEDIUM |

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

Gated by `lib/pov-access.ts`. Three hardcoded founder admin emails, overridable via `ADMIN_EMAILS` / `NEXT_PUBLIC_ADMIN_EMAILS` env vars.

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
