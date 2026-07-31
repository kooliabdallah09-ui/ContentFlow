import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/deduct-credits'

export const maxDuration = 30

const PRODUCTS_CR = 2

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

    if (!credits || credits.balance < PRODUCTS_CR) {
      return NextResponse.json({ error: `Insufficient credits. Need ${PRODUCTS_CR}.` }, { status: 402 })
    }

    const body = await request.json()
    const niche = typeof body.niche === 'string' ? body.niche.trim() : ''
    const angle = typeof body.angle === 'string' ? body.angle.trim() : ''
    const brandName = typeof body.brandName === 'string' ? body.brandName.trim() : ''

    if (!niche) return NextResponse.json({ error: 'niche is required' }, { status: 400 })

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const prompt = `You are a product strategist for e-commerce brands. Generate 8 winning product ideas for a brand in this niche.

BRAND: ${brandName || 'Unnamed Brand'}
NICHE: ${niche}
ANGLE: ${angle || 'general'}

For each product:
- name: specific product name (not generic — be precise, e.g. "Bamboo Travel Cutlery Set" not "Cutlery")
- description: 1 sentence describing what it is and who it's for
- category: product category (1-2 words)
- price: suggested retail price in USD (number only, e.g. 34)
- cost: estimated sourcing cost in USD (number only, e.g. 8)
- margin: profit margin percentage (number only, e.g. 76)
- why: 1 sentence why this product sells well in this niche

Mix price points: include 2-3 under $30, 3-4 in $30-80 range, 1-2 premium $80+.

Output ONLY valid JSON:
{
  "products": [
    {
      "name": "...",
      "description": "...",
      "category": "...",
      "price": 0,
      "cost": 0,
      "margin": 0,
      "why": "..."
    }
  ]
}`

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (msg.content[0] as { text: string }).text.trim()
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(jsonStr)

    await deductCredits(supabase, userId, PRODUCTS_CR, credits.balance, credits.pack_credits ?? 0)

    return NextResponse.json({ products: parsed.products, creditsCharged: PRODUCTS_CR })
  } catch (err) {
    console.error('[brand-launch/products]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
