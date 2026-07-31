import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { deductCredits } from '@/lib/deduct-credits'

export const maxDuration = 30

const IDENTITY_CR = 3

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

    if (!credits || credits.balance < IDENTITY_CR) {
      return NextResponse.json({ error: `Insufficient credits. Need ${IDENTITY_CR}.` }, { status: 402 })
    }

    const body = await request.json()
    const niche = typeof body.niche === 'string' ? body.niche.trim() : ''
    const angle = typeof body.angle === 'string' ? body.angle.trim() : ''
    const targetAudience = typeof body.targetAudience === 'string' ? body.targetAudience.trim() : ''

    if (!niche) return NextResponse.json({ error: 'niche is required' }, { status: 400 })

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const prompt = `You are a brand identity designer. Create a complete brand identity for a new e-commerce brand in this niche.

NICHE: ${niche}
ANGLE: ${angle || 'general'}
TARGET AUDIENCE: ${targetAudience || 'broad consumer'}

Generate:
1. names: 5 brand name options. Short (1-2 words), memorable, domain-friendly. Mix styles (invented word, compound, descriptive, evocative).
2. colors: a bold editorial color palette
   - primary: main brand color hex (strong, distinctive)
   - accent: complementary accent hex
   - bg: clean background hex (near-white or very light)
   - text: text color hex (dark, readable)
3. voice: the brand's personality and tone
   - tagline: punchy 4-8 word tagline
   - bio: 2-sentence brand bio for the About page
   - tone: 3 adjectives describing the brand voice
   - personality: 1-sentence brand personality description

Output ONLY valid JSON:
{
  "names": ["Name1", "Name2", "Name3", "Name4", "Name5"],
  "colors": {
    "primary": "#...",
    "accent": "#...",
    "bg": "#...",
    "text": "#..."
  },
  "voice": {
    "tagline": "...",
    "bio": "...",
    "tone": ["...", "...", "..."],
    "personality": "..."
  }
}`

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (msg.content[0] as { text: string }).text.trim()
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(jsonStr)

    await deductCredits(supabase, userId, IDENTITY_CR, credits.balance, credits.pack_credits ?? 0)

    return NextResponse.json({ ...parsed, creditsCharged: IDENTITY_CR })
  } catch (err) {
    console.error('[brand-launch/identity]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
