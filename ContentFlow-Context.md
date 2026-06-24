# ContentFlow — Full App Context

Paste this into any Claude conversation to get full context on the app.

---

## What it is

ContentFlow is an AI-powered content creation SaaS. Users describe their product, pick options, and get back ready-to-publish ad creatives — UGC talking-head videos, screen demo videos, voiceovers, product images, social copy, blog posts, and emails — in minutes.

**Stack:** Next.js 15 (App Router) · TypeScript · Supabase (auth + DB + storage) · Stripe (billing) · Vercel (hosting)

**Repo:** github.com/kooliabdallah09-ui/ContentFlow  
**Live:** deployed on Vercel  
**Status:** Pre-launch / beta

---

## Credits System

- 1 credit = $0.025 USD
- All generators use **1.8× markup** on API cost
- Credits are consumed per generation; unused credits carry over (packs) or reset monthly (subscriptions)

### Plans

| Plan | Price | Credits/mo |
|---|---|---|
| Free | $0 | 60 (one-time signup bonus) |
| Starter | $19/mo | 800 |
| Pro | $49/mo | 2,000 |
| Agency | $149/mo | 6,500 |

Annual plans available at ~20% discount.

### Credit Packs (one-time)
- $15 → 500 cr
- $40 → 1,500 cr (+11 bonus)
- $120 → 5,000 cr (+20 bonus)

### Credit costs per generator

| Generator | API used | Cost to user |
|---|---|---|
| UGC 5s | Kling + ElevenLabs + NB2 + Shotstack | 91 cr (~$2.28) |
| UGC 10s | same | 171 cr (~$4.28) |
| UGC 15s | same | 251 cr (~$6.28) |
| Kling standalone 5s | Kling v3 omni | 80 cr ($2.00) |
| Kling standalone 10s | Kling v3 omni | 160 cr ($4.00) |
| Sora 2 5s | OpenAI Sora 2 | 36 cr ($0.90) |
| Sora 2 10s | OpenAI Sora 2 | 72 cr ($1.80) |
| Screen Demo | ElevenLabs + Shotstack | 20 cr min (~$0.50+) |
| Image | Nano Banana 2 | 5 cr ($0.125) |
| Voiceover | ElevenLabs v3 | 5 cr min |
| Social/Blog/Email | Claude | 5–20 cr |

---

## Generators (all built and live)

### 1. UGC Package (`/generate/ugc`)
**The flagship feature.** Full AI talking-head video pipeline:
1. User uploads product photo + describes product
2. Claude writes a UGC ad script
3. Nano Banana 2 composites product into the hero frame
4. Kling v3 omni generates the talking-head video with native audio
5. Shotstack stitches video + captions + optional watermark (free plan)
- Output: portrait/square/landscape MP4
- Tiers: Standard (5s), Premium (10s), Hero (15s)
- The "Software/App" mode was removed — screen recordings use the Screen Demo generator instead

### 2. Screen Demo (`/generate/screen-demo`)
For SaaS/app founders. Upload a screen recording → AI writes a voiceover script → ElevenLabs generates audio → Shotstack mixes them into a polished demo video.
- AI script generation: describe your app, Claude writes a 20–30s punchy voiceover script
- Voice options: Drew, Paul, James, Rachel, Hope, Sarah, Aria
- Output: landscape/portrait/square MP4

### 3. Video (`/generate/video`)
Standalone text-to-video. Two models:
- **Sora 2** (OpenAI) — no native audio, 5–20s
- **Kling v3 omni** (via Replicate) — native audio, 5–15s, best for faces

### 4. Voiceover (`/generate/voice` or `/generate/voiceover`)
Script → studio-quality MP3 via ElevenLabs v3. Multiple voice options.

### 5. Image (`/generate/image`)
Product photos, lifestyle shots, ad creatives via Nano Banana 2 (Replicate).

### 6. Social Copy (`/generate/social`)
Instagram captions, TikTok hooks, X posts via Claude.

### 7. Blog Post (`/generate/blog`)
Long-form SEO articles via Claude.

### 8. Email (`/generate/email`)
Marketing/promotional email copy via Claude.

### 9. Business Card (`/generate/business-card`)
AI-designed digital business cards.

---

## Key API Integrations

| Service | Used for |
|---|---|
| **Kling v3 omni** (via Replicate) | Talking-head video, standalone video |
| **OpenAI Sora 2** (via Replicate) | Standalone text-to-video |
| **Nano Banana 2** (via Replicate) | Product image compositing, image gen |
| **ElevenLabs v3** | Voiceovers, UGC audio, Screen Demo audio |
| **Shotstack** | Video stitching, captions, watermark, compositing |
| **Claude (Anthropic)** | Script writing, social/blog/email copy, script gen |
| **Stripe** | Subscriptions, credit packs, webhooks |
| **Supabase** | Auth, PostgreSQL DB, file storage |

---

## Key Files & Architecture

```
app/
  api/
    stripe/webhook/          # Stripe webhook (checkout.session.completed, invoice.paid)
    ugc/
      orchestrate/           # Main UGC pipeline (NB2 → Kling → Shotstack)
      stitch/                # Shotstack assembly
      video-status/          # Kling polling
      hooks/                 # Kling webhook
      script/                # Claude script generation
    video/generate/          # Standalone video (Sora 2 / Kling)
    screen-demo/
      generate/              # Screen Demo — accepts storagePath (not raw file)
      upload-url/            # Returns signed Supabase URL for direct browser upload
      status/[renderId]/     # Shotstack status polling
      script/                # Claude voiceover script generation
    voiceover/               # ElevenLabs voiceover
    youtube/
      publish/               # Publish video to YouTube (Bearer token)
      status/                # Check if YouTube connected
    drive/
      status/                # Returns Drive access token + folder ID for client uploads
    integrations/
      connect/youtube/       # Google OAuth → YouTube
      connect/google-drive/  # Google OAuth → Drive
      callback/youtube/      # YouTube OAuth callback
      callback/google-drive/ # Drive OAuth callback
      publish/               # Legacy multi-platform publish route
    library/                 # Reads from Google Drive if connected
    credits/
      balance/               # Current credit balance
      history/               # credit_transactions table
    analytics/               # Usage analytics
  generate/
    ugc/                     # UGC Package page
    screen-demo/             # Screen Demo page
    video/                   # Standalone video page
    voice/ or voiceover/     # Voiceover page
    image/                   # Image page
    social/                  # Social copy page
    blog/                    # Blog page
    email/                   # Email page
  settings/
    account/                 # Profile settings
    billing/                 # Plans + credit packs + Stripe portal
    integrations/            # Google Drive + YouTube (+ TikTok/Instagram/Facebook coming soon)
    brand/                   # Brand settings
  library/                   # Content library (powered by Google Drive)
  terms/                     # Terms of Service page
  privacy/                   # Privacy Policy page
  pricing/                   # Pricing page
  landing/                   # Landing page

lib/
  tiers.ts                   # Credit math: BASE_FIXED=11, PER_SECOND_KLING=16
  planConfig.ts              # Plan caps, monthly credits, type caps per plan
  credits.ts                 # Credit pack definitions
  google-drive.ts            # Drive token refresh, folder management, file listing
  useDriveSync.ts            # Client hook: auto-saves generations to Drive
  integrations/
    youtube.ts               # publishToYouTube(), refreshYouTubeToken()
    instagram.ts             # publishToInstagram() (built, awaiting Meta approval)
    tiktok.ts                # publishToTikTok() (built, awaiting TikTok approval)

components/
  UGCPackageBuilder.tsx      # Full UGC form (actor, product, script, voice, etc.)
  UGCPackagePreview.tsx      # UGC result preview + download + publish buttons
  PublishToYouTube.tsx       # Reusable modal: title/description/visibility → YouTube upload
  Sidebar.tsx                # App navigation
  Icons.tsx                  # SVG icon library
```

---

## Supabase Tables (known)

| Table | Purpose |
|---|---|
| `user_credits` | `{ user_id, balance, plan, monthly_credits, reset_date }` |
| `credit_transactions` | Every deduction: `{ user_id, amount, transaction_type, content_type, description }` |
| `ugc_content` | UGC generation records with storage URLs and metadata |
| `integrations` | `{ user_id, platform, account_id, account_name, access_token, refresh_token, is_connected, connected_at }` |

---

## Integrations Status

| Integration | Status | Notes |
|---|---|---|
| **Google Drive** | ✅ Live | Library powered by Drive; auto-saves all generations |
| **YouTube** | ✅ Live | Publish button on UGC, Video, Screen Demo result screens |
| **TikTok** | 🔴 Awaiting approval | Code built (`lib/integrations/tiktok.ts`), needs TikTok dev approval |
| **Instagram** | 🔴 Awaiting approval | Code built (`lib/integrations/instagram.ts`), needs Meta approval |
| **Facebook** | 🔴 Awaiting approval | Code built, same Meta app as Instagram |

---

## Billing / Stripe

- Webhook handles: `checkout.session.completed` (new sub + credit pack), `invoice.paid` (monthly renewal → resets balance), `customer.subscription.deleted` (drops to free)
- Annual plans: PLAN_PRICE_MAP in `lib/stripe.ts` maps price IDs to `{ plan, monthly_credits }`
- Manage subscription: Stripe Customer Portal (opened from billing page)
- No refund policy: in Terms of Service at `/terms`

---

## Things NOT built yet / known gaps

- No transactional emails (no Resend/SendGrid — no receipt, no signup confirmation, no "generation complete" email)
- No OG/SEO meta tags on most pages (landing page, pricing, etc.)
- No analytics (no PostHog, no Vercel Analytics)
- No error monitoring (no Sentry)
- Help center is "Coming Soon" (has Ask AI fallback)
- Library filter doesn't include `screen-demo` type yet
- `useDriveSync` only wired into Screen Demo page so far — UGC, Video, Voiceover, Image pages still need it added

---

## UI / Design Notes

- Dark/light mode via CSS variables: `--ink`, `--ink-dim`, `--ink-mute`, `--surface`, `--border`, `--bg`, `--accent`, `--good`, `--danger`
- Font: serif headers (`var(--font-serif)`), mono labels (`var(--font-mono)`), system sans body
- Generator pages use: serif h1 → eyebrow mono label → card sections → full-width generate button
- No Tailwind — all inline styles
- Component pattern: section cards with mono uppercase labels, 14px border-radius, `var(--surface)` background

---

## Current Priorities (as of June 2026)

1. Get Google Drive redirect URI added in Google Cloud Console (so Drive connect works)
2. Submit Meta developer app for Instagram/Facebook approval
3. Submit TikTok developer app
4. Add OG meta tags to public pages
5. Add transactional emails (Resend recommended)
6. Wire `useDriveSync` into remaining generator pages (UGC, Video, Voiceover, Image)
7. Add `screen-demo` to library filter options
