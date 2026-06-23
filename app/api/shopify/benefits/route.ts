import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const maxDuration = 15

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: userData, error } = await supabase.auth.getUser(authHeader.slice(7))
  if (error || !userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { productName, productDescription, price } = await request.json()
  if (!productName) return NextResponse.json({ error: 'Missing productName' }, { status: 400 })

  const priceHint = price ? ` (price: $${price})` : ''
  const descHint = productDescription ? `\nDescription: ${productDescription.slice(0, 600)}` : ''

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `You are writing copy for a UGC video ad. Given this product, return JSON with:
- "benefits": 3-5 key selling points joined by " · " (short, punchy, no fluff — e.g. "Clears acne in 7 days · Vegan · Dermatologist approved")
- "callToAction": a short action phrase (e.g. "Shop now", "Try it today", "Get yours")

Product: ${productName}${priceHint}${descHint}

Return ONLY valid JSON, no markdown:
{ "benefits": "...", "callToAction": "..." }`,
    }],
  })

  const raw = (msg.content[0] as { text: string }).text.trim()
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ error: 'Bad AI response' }, { status: 500 })

  const parsed = JSON.parse(match[0]) as { benefits: string; callToAction: string }
  return NextResponse.json(parsed)
}
