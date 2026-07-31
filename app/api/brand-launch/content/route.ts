import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/deduct-credits'

export const maxDuration = 45

const CONTENT_CR = 5

function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function authUser(request: NextRequest): Promise<string | null> {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const { data } = await supa().auth.getUser(header.slice(7))
  return data.user?.id ?? null
}

export async function POST(request: NextRequest) {
  try {
    const userId = await authUser(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = supa()
    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .maybeSingle()

    if (!credits || credits.balance < CONTENT_CR) {
      return NextResponse.json({ error: `Insufficient credits. Need ${CONTENT_CR}.` }, { status: 402 })
    }

    const body = await request.json()
    const brandName = typeof body.brandName === 'string' ? body.brandName.trim() : 'The Brand'
    const niche = typeof body.niche === 'string' ? body.niche.trim() : ''
    const tagline = typeof body.tagline === 'string' ? body.tagline.trim() : ''
    const tone = Array.isArray(body.tone) ? body.tone.join(', ') : (typeof body.tone === 'string' ? body.tone : 'confident, modern')
    const products = Array.isArray(body.products)
      ? body.products.slice(0, 3).map((p: { name?: string }) => p.name || '').filter(Boolean).join(', ')
      : ''

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const prompt = `You are a launch copywriter. Write a complete launch content pack for a new brand.

BRAND NAME: ${brandName}
NICHE: ${niche}
TAGLINE: ${tagline}
TONE: ${tone}
HERO PRODUCTS: ${products || 'our signature products'}

Write:
1. social: 3 launch social media posts (Instagram/TikTok captions)
   - post 1: brand announcement / launch post
   - post 2: product spotlight with benefits
   - post 3: social proof / lifestyle post with CTA
   Each post: 2-4 sentences, punchy, includes 3-5 relevant hashtags, ends with a clear call-to-action

2. ad: a paid ad (Facebook/Instagram)
   - headline: bold 6-10 word hook
   - primary_text: 2-3 sentences of ad copy (benefit-led, pain-point aware)
   - cta: call-to-action text (e.g. "Shop Now", "Get Yours Today")

3. email: launch email
   - subject: compelling subject line (under 50 chars)
   - preview: preview text (under 80 chars)
   - body: 4-6 sentences of launch email body (personal, warm, introduces the brand and first offer)

Output ONLY valid JSON:
{
  "social": [
    { "label": "Launch Announcement", "caption": "..." },
    { "label": "Product Spotlight", "caption": "..." },
    { "label": "Lifestyle Post", "caption": "..." }
  ],
  "ad": {
    "headline": "...",
    "primary_text": "...",
    "cta": "..."
  },
  "email": {
    "subject": "...",
    "preview": "...",
    "body": "..."
  }
}`

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1400,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (msg.content[0] as { text: string }).text.trim()
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(jsonStr)

    await deductCredits(supabase, userId, CONTENT_CR, credits.balance, credits.pack_credits ?? 0)

    return NextResponse.json({ ...parsed, creditsCharged: CONTENT_CR })
  } catch (err) {
    console.error('[brand-launch/content]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
