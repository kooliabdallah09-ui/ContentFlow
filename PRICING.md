# ContentFlow — full pricing, cost & margin sheet

Snapshot: 2026-07-07. Source of truth: `lib/planConfig.ts`, `lib/tiers.ts`,
`lib/credits.ts`, per-route `CREDIT_COST` constants.

**Credit economics**
- **1 credit sold = $0.025** on subscription plans (Starter/Pro/Agency).
- Per-credit price rises on the small credit packs (see below) to nudge users to
  the higher pack or a subscription.
- Costed in Nov 2026 provider pricing (Replicate, HeyGen, ElevenLabs, OpenAI,
  Anthropic, Google Gemini / Nano Banana 2, Shotstack, Creatomate).

---

## 1. Subscription plans

| Plan     | Price (USD/mo) | Monthly credits | $/credit sold | Signup bonus | Watermark |
|----------|---------------:|----------------:|--------------:|-------------:|:---------:|
| Free     | $0             | 0               | —             | 60 (one-time)| yes       |
| Starter  | $19            | 800             | $0.02375      | 0            | no        |
| Pro      | $49            | 2,000           | $0.0245       | 0            | no        |
| Agency   | $149           | 6,500           | $0.02292      | 0            | no        |

Annual price IDs exist in env for all three; discount handled by Stripe price,
not our code — plug in the actual annual sticker prices from the Stripe
dashboard when running margin math.

### Free-plan monthly type caps (throttles, not pricing)
`ugc: 1 · video: 0 · voice: 1 · image: 3 · social: 3 · blog: 1 · email: 1 · screen-demo: 0`
Plus a first-time `image: 3` free trial.

### Starter caps
`ugc: 12 · video: 12 · voice: 20 · image: 50 · social: ∞ · blog: ∞ · email: ∞ · screen-demo: 10`

### Pro caps
`ugc: 30 · video: 30 · voice: 60 · image: ∞ · social: ∞ · blog: ∞ · email: ∞ · screen-demo: 30`

### Agency
All caps `∞`.

---

## 2. Credit packs (pay-as-you-go, one-off)

| Pack   | Credits | Price | $/credit |
|--------|--------:|------:|---------:|
| Small  | 500     | $15   | $0.030   |
| Medium | 1,500   | $45   | $0.030   |
| Large  | 5,000   | $120  | $0.024   |

---

## 3. Sold price per generation (credits × $)

### UGC Package (talking-head, flagship — `lib/tiers.ts`)
Dynamic per second. Formula: `11 + 16 × klingSeconds × klingClips + 8 × (klingClips − 1)`.

| Duration | Kling seconds × clips | Credits | Sold @ $0.025 |
|---------:|:----------------------|--------:|--------------:|
| 5s       | 5 × 1                 | 91      | $2.28         |
| 10s      | 10 × 1                | 171     | $4.28         |
| 15s      | 15 × 1                | 251     | $6.28         |
| 20s      | 10 × 2 (chained)      | 339     | $8.48         |

### POV Studio (Kling v3 omni + ElevenLabs — feature-gated to admin)
| Duration | Credits | Sold @ $0.025 |
|---------:|--------:|--------------:|
| 5s       | 60      | $1.50         |
| 10s      | 110     | $2.75         |

### Video (standalone Sora / Kling — `/generate/video`)
Legacy fixed cost. Kept because the standalone form pre-dates the tier config.

| Item  | Credits | Sold @ $0.025 |
|-------|--------:|--------------:|
| Video | 40      | $1.00         |

Also referenced in `lib/credits.ts` `CREDIT_COSTS.video = 40` for legacy.

### Voice / ElevenLabs (`/generate/voice`)
`credits = max(5, ceil(chars / 80))` (about 15 chars/sec spoken)

| Script chars | Credits | Sold @ $0.025 |
|-------------:|--------:|--------------:|
| ≤ 400        | 5       | $0.125        |
| 800          | 10      | $0.25         |
| 2,000        | 25      | $0.625        |
| 5,000        | 63      | $1.575        |

### Screen Demo (`/api/screen-demo/generate`)
`credits = max(20, ceil(chars / 80))`

| Script chars | Credits | Sold @ $0.025 |
|-------------:|--------:|--------------:|
| ≤ 1,600      | 20      | $0.50         |
| 2,000        | 25      | $0.625        |
| 4,000        | 50      | $1.25         |

### Image (Nano Banana 2 — `/api/content/generate/image`)
Per image, from `planConfig.CREDIT_COSTS.image = 5`. (Some MCP tools mint at 3.)

| Item                                | Credits | Sold @ $0.025 |
|-------------------------------------|--------:|--------------:|
| Image (in-app)                      | 5       | $0.125        |
| Image via MCP (`generate_image`)    | 3       | $0.075        |

### Carousel (`/api/content/generate/carousel`)
Per slide × N slides. `CREDIT_PER_SLIDE = 5`.

| Slides | Credits | Sold @ $0.025 |
|-------:|--------:|--------------:|
| 3      | 15      | $0.375        |
| 5      | 25      | $0.625        |
| 7      | 35      | $0.875        |
| 10     | 50      | $1.25         |

### Copy generation

| Endpoint                                | Credits | Sold @ $0.025 |
|-----------------------------------------|--------:|--------------:|
| Social (per multi-platform response)    | 5       | $0.125        |
| Social via MCP                          | 5       | $0.125        |
| Email (per email in a sequence)         | 3/email | $0.075/email  |
| Blog                                    | 10      | $0.25         |
| Auto-content (calendar single-item)     | 2       | $0.05         |
| Refine-content                          | 2       | $0.05         |
| From-calendar                           | 2       | $0.05         |
| Business card                           | 3       | $0.075        |
| Social image (Flux Pro)                 | 3       | $0.075        |

### MCP tools (free reads, priced writes)

| Tool                       | Credits | Sold @ $0.025 |
|----------------------------|--------:|--------------:|
| `get_credit_balance`       | 0       | $0.00         |
| `list_library`             | 0       | $0.00         |
| `generate_social_captions` | 5       | $0.125        |
| `generate_image`           | 3       | $0.075        |

---

## 4. Raw provider unit costs (2026)

Sources: Replicate model pages + provider docs. Update whenever a model page
changes. USD.

### Video generation
| Model                                          | Rate                | Notes                                       |
|------------------------------------------------|---------------------|---------------------------------------------|
| Kling v3 omni (native audio, `kwaivgi/kling-v3-omni-video`) | $0.224 / s        | UGC + POV. `standard` audio mode.           |
| Kling v1.6 Standard (`kwaivgi/kling-v1.6-standard`) | $0.05 / s (5s = $0.25) | Legacy fallback for B-roll clips.       |
| Seedance 2.0 (`bytedance/seedance-2.0`) — deprecated for POV | $0.18/s @ 720p     | Not currently in the POV path (filter issues). |
| Sora 2 (`openai/sora-2`)                       | Replicate rate      | Standalone video generator.                 |
| HeyGen Avatar (legacy)                         | ~$0.30–0.90 / clip  | Not on the primary path anymore.            |

### Image generation
| Model                                    | Rate               |
|------------------------------------------|--------------------|
| Nano Banana 2 (`google/nano-banana-2`)   | $0.075 / image     |
| Flux Pro (via Replicate)                 | $0.055 / image     |

### Audio
| Model                                            | Rate                       |
|--------------------------------------------------|----------------------------|
| ElevenLabs v3 (via Replicate `elevenlabs/v3`)    | ~$0.10 / 1,000 chars       |
| ElevenLabs Turbo v2.5 (via Replicate)            | ~$0.033 / 1,000 chars      |
| Whisper transcription (`vaibhavs10/incredibly-fast-whisper`) | ~$0.006 / minute |
| Sync Labs Lipsync-2 (`sync/lipsync-2`)           | ~$0.10 / video (used sparingly) |

### LLMs
| Model                                     | Rate (per 1M tokens)          |
|-------------------------------------------|-------------------------------|
| Claude Sonnet 4.6 (`claude-sonnet-4-6`)   | $3 input / $15 output         |
| Claude Haiku 4.5 (`claude-haiku-4-5`)     | $1 input / $5 output          |
| Claude Opus 4.7 (`claude-opus-4-7`)       | $15 input / $75 output        |
| Google Gemini (for image prompt refine)   | negligible                    |

### Rendering / compositing
| Service                            | Rate                           |
|------------------------------------|--------------------------------|
| Shotstack (screen-demo composite)  | ~$0.06 / min rendered          |
| Creatomate (video render)          | ~$0.05 / render                |

### Infrastructure
| Service                | Rate                                                       |
|------------------------|------------------------------------------------------------|
| Vercel functions       | included in team plan; edge egress metered separately      |
| Supabase Storage       | $0.021/GB stored, $0.09/GB egress                          |
| Supabase Postgres      | included on Pro tier                                       |

---

## 5. Estimated raw cost per generation (COGS)

| Generation                     | Cost breakdown (USD)                                                             | Total raw |
|--------------------------------|----------------------------------------------------------------------------------|----------:|
| UGC 5s                         | Nano Banana $0.075 + Kling 5s×$0.224 + Claude Haiku ~$0.005                      | ~$1.20    |
| UGC 10s                        | Nano Banana $0.075 + Kling 10s×$0.224 + Claude Haiku ~$0.005                     | ~$2.32    |
| UGC 15s                        | Nano Banana $0.075 + Kling 15s×$0.224 + Claude Haiku ~$0.005                     | ~$3.44    |
| UGC 20s chained                | Nano Banana $0.075 + Kling 10s×$0.224 ×2 + Claude Haiku ~$0.01                   | ~$4.57    |
| POV 5s (Kling omni + voice)    | Nano Banana $0.075 + Kling 5s×$0.224 + ElevenLabs ~$0.05 + Claude Haiku ~$0.005  | ~$1.25    |
| POV 10s                        | Nano Banana $0.075 + Kling 10s×$0.224 + ElevenLabs ~$0.10 + Claude Haiku ~$0.01  | ~$2.42    |
| Image (in-app)                 | Nano Banana $0.075                                                                | ~$0.08    |
| Image (MCP)                    | Nano Banana $0.075                                                                | ~$0.08    |
| Carousel 5 slides              | Nano Banana × 5 = $0.375 + Claude Haiku ~$0.005                                   | ~$0.38    |
| Voice — 1,000 chars            | ElevenLabs v3 ~$0.10                                                              | ~$0.10    |
| Voice — 5,000 chars            | ElevenLabs v3 ~$0.50                                                              | ~$0.50    |
| Screen Demo — 2,000 char script| ElevenLabs ~$0.20 + Shotstack ~$0.06 + Claude ~$0.01                              | ~$0.27    |
| Social captions (3 platforms)  | Claude Haiku ~$0.01                                                               | ~$0.01    |
| Blog post                      | Claude Sonnet ~$0.05                                                              | ~$0.05    |
| Email sequence — 5 emails      | Claude Sonnet ~$0.05                                                              | ~$0.05    |
| Business card                  | Nano Banana $0.075                                                                | ~$0.08    |
| Social image (Flux Pro)        | Flux Pro $0.055                                                                    | ~$0.06    |

Round up ~10 % for Supabase egress + margins on model wall-clock. Add ~$0.01–0.03
of Claude prompt overhead to any generation that goes through the brand-context
loader.

---

## 6. Unit margin by generation (sold − cost, $)

| Generation           | Sold  | Cost  | Margin | Margin %   |
|----------------------|------:|------:|-------:|-----------:|
| UGC 5s               | $2.28 | $1.20 | $1.08  | 47 %       |
| UGC 10s              | $4.28 | $2.32 | $1.96  | 46 %       |
| UGC 15s              | $6.28 | $3.44 | $2.84  | 45 %       |
| UGC 20s              | $8.48 | $4.57 | $3.91  | 46 %       |
| POV 5s               | $1.50 | $1.25 | $0.25  | 17 %       |
| POV 10s              | $2.75 | $2.42 | $0.33  | 12 %       |
| Image (in-app)       | $0.125| $0.08 | $0.05  | 36 %       |
| Image (MCP)          | $0.075| $0.08 | −$0.005| **loss**   |
| Carousel 5 slides    | $0.625| $0.38 | $0.25  | 39 %       |
| Voice 1k chars       | $0.25 | $0.10 | $0.15  | 60 %       |
| Voice 5k chars       | $1.58 | $0.50 | $1.08  | 68 %       |
| Screen Demo (2k)     | $0.625| $0.27 | $0.36  | 57 %       |
| Social captions      | $0.125| $0.01 | $0.115 | 92 %       |
| Blog                 | $0.25 | $0.05 | $0.20  | 80 %       |
| Business card        | $0.075| $0.08 | −$0.005| **loss**   |
| Social image (Flux)  | $0.075| $0.06 | $0.015 | 20 %       |

**Loss-making items to look at:** `generate_image` via MCP (3cr @ $0.075 vs
$0.08 cost), Business card (3cr @ $0.075 vs $0.08). Both undersold by 1 cr;
easiest fix is bump those two to 5cr each.

POV margin is thin because ElevenLabs is charged on top of Kling and it's
priced against subscription rate, not pack rate. If we sell POV mostly to
pack users at $0.03/cr, margins jump ~20 %.

---

## 7. Plan-level worst-case model (all credits burned on the cheapest-margin work)

Assumes user spends 100 % of monthly credits on UGC 10s clips (worst realistic
mix — heavy-compute, ~46 % margin).

| Plan    | Sold ($/mo) | Credits | UGC 10s per user (171 cr each) | User cost | Gross margin | Margin % |
|---------|-----------:|--------:|-------------------------------:|----------:|-------------:|---------:|
| Starter | $19        | 800     | 4.68                            | $10.85    | $8.15        | 43 %     |
| Pro     | $49        | 2,000   | 11.70                           | $27.13    | $21.87       | 45 %     |
| Agency  | $149       | 6,500   | 38.00                           | $88.16    | $60.84       | 41 %     |

Assumes all credits burnt; real usage is lighter (many users burn only 30–60 %
of monthly credits), so realistic operating margin is significantly higher.

## 8. Best-case (users only generate high-margin content)

Users burn all credits on Voice + captions + blogs (~85 % margin blended).

| Plan    | Sold  | Credits | Blended cost @ 15 % of sold | Gross margin | Margin % |
|---------|------:|--------:|----------------------------:|-------------:|---------:|
| Starter | $19   | 800     | $2.85                        | $16.15       | 85 %     |
| Pro     | $49   | 2,000   | $7.35                        | $41.65       | 85 %     |
| Agency  | $149  | 6,500   | $22.35                       | $126.65      | 85 %     |

Real-world blended margin is likely 55–70 % depending on the UGC-heavy vs
copy-heavy mix.

---

## 9. Where the numbers live in code

- `lib/credits.ts` — PLAN_CREDITS, CREDIT_PACKS, CREDIT_COSTS re-export
- `lib/planConfig.ts` — PLAN_CONFIG (prices + caps), CREDIT_COSTS (per-type)
- `lib/tiers.ts` — UGC dynamic pricing (`calculateVideoCredits`)
- `lib/stripe.ts` — PLAN_PRICE_MAP, PACK_CREDIT_MAP
- `lib/replicate.ts` — model IDs (bytedance/seedance-2.0, kwaivgi/kling-v3-omni-video, openai/sora-2, elevenlabs/v3, etc.)
- Per-route `CREDIT_COST` constants — social/blog/email/image/social-image/business-card/screen-demo/voice/pov/mcp

Update this file when any of them change.
