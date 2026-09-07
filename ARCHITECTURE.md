# ContentFlow Architecture

Last updated: 2026-09-07

## The 30-second mental model

ContentFlow is a **Next.js web app** where a user pastes a product → your servers call **external AI APIs** (BytePlus, Anthropic, ElevenLabs, Google) → results are saved in **Supabase** (database + file storage) → shown back to the user. **Payments** go through **Dodo**. The whole thing is deployed on **Vercel**.

That's it. Everything else is detail on top of that loop.

---

## The 6 external services you rent

You don't own AI models or servers. You rent them and mark up.

| Service | What it does | You pay | Files touching it |
|---|---|---|---|
| **Vercel** | Hosts your Next.js app + runs your API routes as serverless functions | $20/mo | (deploy config, not code) |
| **Supabase** | User accounts (auth), database (Postgres), file storage (`ugc-assets` bucket) | $25/mo | `lib/auth.ts`, `lib/supabase.ts` |
| **BytePlus (ByteDance)** | Video generation (Seedance 2.0 / 2.5 / Mini) | Per-second usage | `lib/seedance.ts` |
| **Google Vertex** | Nano Banana Pro for images | Per-image usage | `lib/nanobanana.ts`, `lib/vertex-video.ts` |
| **Anthropic** | Claude for writing scripts/prompts | Per-token usage | Called inline in many routes |
| **ElevenLabs** | Voice synthesis | Per-character usage | `lib/elevenlabs.ts` |
| **Dodo Payments** | Subscription billing + credit packs | ~3.5% per transaction | `app/api/dodo/*` |

None of these run on your machine. They're API calls from your Vercel functions.

---

## The code — three folders that matter

### `app/` — everything users see + everything your servers do

Next.js App Router. Each folder inside `app/` is a URL.

- **Pages** (`page.tsx` files) — what users see. E.g. `app/generate/ugc/page.tsx` = the UGC builder page.
- **API routes** (inside `app/api/`) — your backend. E.g. `app/api/ugc/animate/route.ts` = the endpoint that submits a UGC video to BytePlus.

`app/api/` has ~50 API route folders. That's your entire backend.

### `components/` — reusable UI pieces

Big ones: `UGCPackageBuilder.tsx`, `ProductStudio.tsx`, `Editor.tsx`, `PreviewGenerator.tsx`, `Sidebar.tsx`, `TopBar.tsx`.

### `lib/` — business logic + external service wrappers

- `lib/seedance.ts` — calls BytePlus
- `lib/nanobanana.ts` — calls Google Vertex
- `lib/elevenlabs.ts` — calls voice API
- `lib/credits.ts` — plan definitions + credit rules
- `lib/deduct-credits.ts` — the actual credit-deduction transaction
- `lib/auth.ts` — Supabase client
- `lib/ugc-pricing.ts` — pricing math for UGC videos
- `lib/tiers.ts` — video duration configs
- `lib/storage-cleanup.ts` — Supabase storage janitor

**Rule of thumb**: if logic is used by more than one API route, it goes in `lib/`.

---

## Five flows that explain the whole product

### Flow 1 — Landing hero `/try` preview

```
Browser (landing page)
   ↓  User types URL, clicks "Generate preview"
   ↓  <PreviewGenerator /> POSTs to /api/preview/generate
Vercel serverless function
   ↓  1. Check IP rate limit (in-memory Map, 1 per week)
   ↓  2. Scrape OG image + title from URL (lib/preview-scraper.ts)
   ↓  3. Upload product image to Supabase Storage (ugc-assets/preview-refs/)
   ↓  4. Claude Haiku writes a 5s video prompt
   ↓  5. Submit BytePlus job (Seedance Mini, 480p, 5s, watermarked)
   ↓  6. Return { predictionId, product }
Browser polls every 5s → GET /api/ugc/video-status?videoId=X&provider=seedance
   ↓  When status = completed, display the video + upsell CTA
```

**No auth. No database. No credit deduction.** Just a rate-limited call to BytePlus. Costs ~$0.18 per preview.

### Flow 2 — Signup

```
Browser → /auth/signup page
   ↓  supabase.auth.signUp() runs — hits Supabase directly (not your API)
   ↓  Supabase creates the user, sends confirmation email, returns a session
On next visit to any protected page:
   ↓  app/layout.tsx checks supabase.auth.getSession()
   ↓  If no session → redirect to /auth/login
Post-signup:
   ↓  initCredits() creates a row in user_credits (balance = 30 signup bonus)
   ↓  Logs a row in credit_transactions
```

Supabase handles auth entirely — you don't manage passwords.

### Flow 3 — Generating a UGC video (the crown jewel)

Three phases:

**Phase A — Script + Hero Frame**
```
User fills UGC form in <UGCPackageBuilder>
POST /api/ugc/script      → Claude writes the UGC voiceover script
POST /api/ugc/hero-frames → Nano Banana Pro generates 2-3 keyframe options
User picks the best frame
```

**Phase B — Animation**
```
POST /api/ugc/animate
   ↓  1. Verify auth (get user_id from session)
   ↓  2. Check user_credits balance
   ↓  3. Upload chosen hero frame to Supabase Storage
   ↓  4. Submit BytePlus job with frame + script
   ↓  5. Insert row in ugc_content (status: processing)
   ↓  6. Deduct credits (lib/deduct-credits.ts)
   ↓  7. Insert row in credit_transactions
   ↓  8. Return { predictionId }
```

**Phase C — Polling + Delivery**
```
Browser polls /api/ugc/video-status every 5s
When done:
   ↓  Update ugc_content row (status: completed, storage_url)
   ↓  User sees video in UI + Library
```

Every AI call = a vendor bill. That's why credits are deducted.

### Flow 4 — Someone subscribes to Pro

```
User clicks "Upgrade to Pro" on /pricing
POST /api/dodo/checkout → creates Dodo checkout session, returns hosted URL
User → redirected to Dodo checkout, enters card, pays $49
Dodo → POST /api/dodo/webhook
   ↓  1. Verify signature (security)
   ↓  2. Read plan + user
   ↓  3. Update user_credits.plan = 'pro', balance += 2000
   ↓  4. Log credit_transaction
User is now Pro. Dodo webhooks recur each month.
```

You never see the credit card. Dodo handles security; you react to webhooks.

### Flow 5 — Watching a video from the Library

```
User visits /app/library
Page calls GET /api/library
   ↓  SELECT * FROM ugc_content WHERE user_id = X
   ↓  Returns [{id, storage_url, ...}]
Browser renders <video src={storage_url} />
   ↓  Streams directly from Supabase's CDN
```

Nothing on your servers when watching. Supabase serves the file.

---

## The database (Supabase Postgres)

| Table | What it holds |
|---|---|
| `auth.users` | (Supabase-managed) every account |
| `user_credits` | `{user_id, plan, balance, pack_credits}` — one row per user |
| `credit_transactions` | Audit trail of every credit change |
| `ugc_content` | Every generated video/image — the Library |
| `brand_profiles` | Brand kit per user (logo, tone, colors, audience) |
| `campaigns` | Campaign planner data |
| `campaign_shots` | Individual shots within a campaign |
| `saved_actors` | Saved AI characters |
| `products_studio_products` | Saved products |

Every table has `user_id`. Supabase Row Level Security enforces per-user access.

---

## File storage (Supabase `ugc-assets` bucket)

All generated files in one bucket, organized by prefix:

```
ugc-assets/
├── hero-frames/       → Nano Banana keyframes (intermediate)
├── video-ref/         → Reference images for /generate/video (intermediate)
├── preview-refs/      → /try product images (intermediate)
├── preview-output/    → /try generated videos (transient)
├── omni-output/       → Admin Veo 3.1 videos (user content)
├── sora-output/       → Legacy Sora videos (user content, keep)
├── kling-source/      → Legacy name for Seedance hero frames (intermediate)
├── demo/              → Curated marquee demos (keep)
└── (final videos come straight from BytePlus URLs — not stored here)
```

Every file is public. Storage URLs go in `ugc_content.storage_url`.

**Intermediate files** (hero-frames, video-ref, preview-refs, preview-output, kling-source) are cleaned up automatically by `lib/storage-cleanup.ts` — see below.

---

## Storage cleanup (`lib/storage-cleanup.ts` + Vercel Cron)

A daily cron job (4 AM UTC) sweeps intermediate files older than N days. **Nothing user-visible is ever deleted.**

| Prefix | Max age | Reason to keep |
|---|---|---|
| `preview-refs/` | 7 days | Only used during preview submission |
| `preview-output/` | 7 days | `/try` preview is single-session |
| `video-ref/` | 14 days | Only used at submission time |
| `hero-frames/` | 30 days | Used at submission + short retry window |
| `kling-source/` | 30 days | Legacy name for hero-frames |

Never touched:
- `omni-output/` — user's admin videos
- `sora-output/` — legacy user videos
- `demo/` — curated marquee assets
- `ugc-assets/` root — anything not in an intermediate prefix

Cron endpoint: `GET /api/cron/cleanup-storage` (guarded by `CRON_SECRET`).
Config: `vercel.json`.

---

## Mental map — where to change what

| I want to change… | Look here |
|---|---|
| Plan prices | `lib/credits.ts` + `app/pricing/page.tsx` + Dodo dashboard |
| UGC credit cost | `lib/ugc-pricing.ts` |
| UGC generation logic | `app/api/ugc/animate/route.ts` |
| Landing page copy | `app/landing/page.tsx` |
| Who sees what feature | `lib/pov-access.ts` + `app/layout.tsx` (publicPages) |
| Signup free credits | `lib/credits.ts:21` (currently 30) |
| `/try` rate limits | `app/api/preview/generate/route.ts` |
| Storage cleanup rules | `lib/storage-cleanup.ts` |
| Payment webhook | `app/api/dodo/webhook/route.ts` |

---

## How a deploy works (Vercel)

1. `vercel deploy --prod --yes` or push to `master`
2. Vercel pulls code, runs `next build`
3. Each API route bundled as its own serverless function
4. Uploaded to Vercel's edge network
5. `contentflow-web.com` DNS points to Vercel
6. Each page/API runs on-demand as a serverless function

**Serverless** = your code isn't running until someone visits. Pay per invocation.

---

## Things that would surprise you

1. **No traditional "backend"**. No long-running server. Every API is a short-lived function.
2. **No websockets**. Browser polls every 5s when rendering. Intentional simplicity.
3. **You never process video yourself**. BytePlus does the work; you submit and poll.
4. **You never store credit card info**. Dodo handles it. You react to their webhooks.
5. **Storage grows forever unless you delete**. The cleanup cron handles this now.

---

## The one diagram in your head

```
                    ┌─────────────┐
                    │   Browser   │
                    │ (Next.js UI)│
                    └──────┬──────┘
                           │ HTTPS
                    ┌──────▼──────┐
                    │   Vercel    │  ← serverless functions run here
                    │  (your API) │
                    └──┬──┬──┬──┬─┘
              ┌───────┘  │  │  └──────────┐
              ▼          ▼  ▼             ▼
        ┌──────────┐ ┌─────┐┌──────┐ ┌──────────┐
        │ Supabase │ │Byte ││Claude│ │Eleven    │
        │(DB/Auth/ │ │Plus ││(text)│ │Labs      │
        │ Storage) │ │(vid)│└──────┘ │(voice)   │
        └──────────┘ └─────┘         └──────────┘
                           │
                     ┌─────▼────┐
                     │Nano      │
                     │Banana Pro│
                     │(images)  │
                     └──────────┘

              Payments (separate channel):
              Browser → Dodo hosted checkout → webhook → your Vercel
```
