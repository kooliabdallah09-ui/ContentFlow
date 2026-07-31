import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/deduct-credits'

export const maxDuration = 30

const NICHE_CR = 2

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

    if (!credits || credits.balance < NICHE_CR) {
      return NextResponse.json({ error: `Insufficient credits. Need ${NICHE_CR}.` }, { status: 402 })
    }

    const body = await request.json()
    const topic = typeof body.topic === 'string' ? body.topic.trim().slice(0, 200) : ''

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const prompt = `You are a brand strategist helping someone launch a dropshipping brand. Generate exactly 3 winning niche ideas${topic ? ` related to: "${topic}"` : ' (choose profitable trending niches)'}.

For each niche return:
- name: the niche name (2-4 words)
- angle: the specific positioning angle that makes it stand out (e.g. "eco-conscious minimalists", "busy parents", "remote workers")
- why: 1 sentence explaining why this niche is profitable right now
- target_audience: who buys this (age, lifestyle, pain point — 1 sentence)
- example_products: array of 3 example product names to sell

Output ONLY valid JSON:
{
  "niches": [
    {
      "name": "...",
      "angle": "...",
      "why": "...",
      "target_audience": "...",
      "example_products": ["...", "...", "..."]
    }
  ]
}`

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (msg.content[0] as { text: string }).text.trim()
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(jsonStr)

    await deductCredits(supabase, userId, NICHE_CR, credits.balance, credits.pack_credits ?? 0)

    return NextResponse.json({ niches: parsed.niches, creditsCharged: NICHE_CR })
  } catch (err) {
    console.error('[brand-launch/niche]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
