# ContentFlow — Product Brief

## What it is
ContentFlow is an AI-powered content creation SaaS for e-commerce brands and digital marketers. It generates ready-to-publish ad creatives — UGC talking-head videos, screen demo videos, product images, AI voiceovers, social copy, blog posts, and emails — in minutes, without needing actors, editors, or copywriters.

## Target customer
- E-commerce founders selling physical products (supplements, beauty, apparel, gadgets)
- DTC brand marketers running paid social (Meta, TikTok, YouTube)
- SaaS / mobile app founders who need demo content
- Social media managers and content agencies

## Core problem we solve
Creating scroll-stopping ad content is expensive and slow. Hiring UGC creators costs $100–500 per video and takes 1–2 weeks. ContentFlow compresses that to ~2 minutes and ~$4.

## Content types
| Generator | What it does | Key tech |
|---|---|---|
| **UGC Package** | AI talking-head video with native audio, product in frame | Kling v3 omni + ElevenLabs + Nano Banana 2 + Shotstack |
| **Screen Demo** | Screen recording + AI voiceover, mixed into a polished video | ElevenLabs + Shotstack |
| **Video** | Text-to-video (Sora 2 or Kling v3) | OpenAI Sora 2 / Kling v3 |
| **Voiceover** | Studio-quality AI voiceover from a script | ElevenLabs v3 |
| **Image** | Product photos, lifestyle shots, ad creative images | Nano Banana 2 |
| **Social Copy** | Instagram captions, TikTok hooks, X/Twitter posts | Claude |
| **Blog Post** | Long-form SEO blog articles | Claude |
| **Email** | Marketing and promotional email copy | Claude |

## Pricing
| Plan | Price | Credits/mo | Best for |
|---|---|---|---|
| Free | $0 | 60 (one-time) | Try it |
| Starter | $19/mo | 800 | Founders running 1–2 ads/week |
| Pro | $49/mo | 2,000 | Active marketers |
| Agency | $149/mo | 6,500 | Teams / agencies |

Credit packs also available: $15 (500 cr), $40 (1,500 cr), $120 (5,000 cr)

1 credit = $0.025. All generators use 1.8× markup on API cost.

**UGC video cost to user:** ~$2.28 (5s) / $4.28 (10s) / $6.28 (15s)

## Brand & tone
- Name: ContentFlow
- Vibe: professional but approachable, focused on speed and results
- Audience speaks in: ROI, ROAS, CTR, hooks, scroll-stopping, ad fatigue
- Key differentiator vs competitors: native audio UGC (no silent talking heads), real product compositing, no subscription lock-in (credit packs)

## Key UX flows
1. **UGC Package:** describe product → pick actor → AI writes script → generates talking-head with product in frame → download ready-to-post video
2. **Screen Demo:** paste description → AI writes voiceover script → upload screen recording → pick voice → download mixed video
3. **Voiceover:** paste script → pick voice → download MP3
4. **Image:** describe product/scene → download image

## What we DON'T do
- Real human actors or UGC creators
- Video editing or post-production (Shotstack handles compositing server-side)
- Scheduling or publishing (we generate, you distribute)

## Social media strategy context
Target platforms: TikTok, Instagram Reels, Meta Ads, YouTube Shorts
Audience: marketers, DTC founders, e-commerce enthusiasts
Content angles that work for us:
- Before/after (hiring UGC creator vs ContentFlow)
- Speed demo (show a real generation in real-time)
- Cost comparison ($400 UGC creator vs $4 on ContentFlow)
- Niche tutorials ("How to make a TikTok ad for your Shopify store")
- Social proof / results (if any users share their metrics)

## Current status
- Live on Vercel (Next.js 15 App Router)
- Stripe for billing (monthly + annual subscriptions + credit packs)
- Supabase for auth, database, and file storage
- Not yet publicly launched — in pre-launch / beta
