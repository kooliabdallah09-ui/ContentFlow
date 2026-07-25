import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { loadBrandContext } from '@/lib/brand-context'
import type { PodcastScript } from '@/lib/podcast-ad'

export const maxDuration = 60

// Podcast Ad — script planner. Sonnet writes the 6-shot dialogue from
// brand + product + brief. User reviews & edits before /render is called.
//
// The 6-shot structure (mirrors the GRÜNS reference guide):
//   1. Expert sets up the problem, host reacts        (~2 lines)
//   2. Host admits the pain, expert agrees, both laugh (4 lines, densest)
//   3. Host introduces the product hook, expert explains what it is  (2 lines)
//   4. Host shares personal testimonial, expert reassures (2 lines)
//   5. Expert teases offer, host reacts with excitement — the CTA beat (2-4 lines)
//   6. Product-reveal outro (spoken tail is short muffled chatter — one line)

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = userData.user.id

    const body = await request.json()
    const {
      productId,
      productName: productNameOverride,
      productDescription: productDescriptionOverride,
      brief,
      hostName,
      expertName,
      offer,
    } = body as Record<string, unknown>

    // Resolve product from brand profile if productId given, else use overrides.
    let productName = typeof productNameOverride === 'string' ? productNameOverride.trim() : ''
    let productDescription = typeof productDescriptionOverride === 'string' ? productDescriptionOverride.trim() : ''
    if (!productName && typeof productId === 'string' && productId.length > 0) {
      const { data: brandRow } = await supabase
        .from('brand_profiles')
        .select('products')
        .eq('user_id', userId)
        .maybeSingle()
      const products = Array.isArray(brandRow?.products) ? brandRow!.products : []
      const found = products.find((p: { id?: string }) => p.id === productId)
      if (found) {
        productName = found.name ?? ''
        productDescription = found.description ?? ''
      }
    }
    if (!productName) return NextResponse.json({ error: 'Product name required' }, { status: 400 })

    const brand = await loadBrandContext(supabase, userId)
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const system = `You write dialogue for AI-generated podcast ads — two people in a premium studio having a natural, brisk, warm conversation that hooks a viewer in 3 seconds and gets them to want the product by second 60.

You will output the exact 6-shot script structure below. The dialogue must sound like two close friends catching up — brisk, alive, energetic — NOT slow deliberate voiceover. Real cadence, real emotion, real specificity. No corporate marketing voice. No "In today's fast-paced world…" openings. No stiff "Absolutely!" agreements. Match how people actually talk.

Return STRICT JSON in this exact shape:
{
  "shot1": {"expertLine": "...", "hostLine": "..."},
  "shot2": {"hostLine": "...", "expertLine": "...", "hostLine2": "...", "expertLine2": "..."},
  "shot3": {"hostLine": "...", "expertLine": "..."},
  "shot4": {"hostLine": "...", "expertLine": "..."},
  "shot5": {"expertLine": "...", "hostLine": "..."},
  "shot6": {"expertLine": "...", "hostLine": "..."}
}

Structure — non-negotiable:
- Shot 1 (~15s, ~30 words): EXPERT sets up the PROBLEM the target audience feels (frustration, failed habits, etc.). HOST reacts with an honest confession that lands humor.
- Shot 2 (~15s, ~55 words — densest): HOST admits the pain more specifically. EXPERT echoes ("They ARE"), both laugh. HOST lists 2-3 concrete complaints. EXPERT lands a stat or insight that reframes the problem.
- Shot 3 (~15s, ~35 words): HOST transitions "That's why {product} is interesting — it's the same idea but solved the {experience} problem." EXPERT explains what the product is + why it's different, in one confident sentence.
- Shot 4 (~12s, ~30 words): HOST shares personal testimonial — "I've been using it {duration}, {specific benefit}." EXPERT reassures — "When it's easy, you repeat it. When you repeat it, {result}."
- Shot 5 (~15s, ~30 words): EXPERT teases the offer${typeof offer === 'string' && offer.trim() ? ` (${offer})` : ''}. HOST reacts with sudden genuine excitement — "wait, actually? {playful cta}."
- Shot 6 (~6s, one line each — muffled outro chatter): EXPERT wraps up warmly, HOST casually reacts. This is the out-of-focus post-conversation beat. Keep both under 8 words.

Rules:
- Use HOST=${typeof hostName === 'string' && hostName ? hostName : '(unnamed host)'}, EXPERT=${typeof expertName === 'string' && expertName ? expertName : '(unnamed expert)'} — but do NOT include their names in the dialogue (podcast conversation format).
- Product name (${productName}) can be mentioned by either speaker starting shot 3.
- The offer, if given, MUST appear in shot 5.
- No emojis in the dialogue text.
- No brackets, no stage directions, no "[laughs]" — pure spoken lines only.
- Every line under 25 words.`

    const userMsg = `BRAND: ${brand?.companyName ?? '(unknown)'}
Voice: ${brand?.toneOfVoice ?? 'warm, brisk, real'}
Audience: ${brand?.targetAudience ?? '—'}

PRODUCT: ${productName}
${productDescription ? `Product description: ${productDescription}` : ''}
${typeof offer === 'string' && offer.trim() ? `Current offer to mention in shot 5: ${offer.trim()}` : ''}

CAMPAIGN BRIEF: ${typeof brief === 'string' && brief.trim() ? brief.trim() : `A conversational podcast-style ad selling ${productName}. Two women in a premium studio. The problem is a common frustration ${productName} solves.`}

Return the JSON script now.`

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system,
      messages: [{ role: 'user', content: userMsg }],
    })
    const raw = (msg.content[0] as { type: 'text'; text: string }).text
      .trim().replace(/^```json?\n?/i, '').replace(/\n?```$/, '')

    let script: PodcastScript
    try { script = JSON.parse(raw) as PodcastScript }
    catch { return NextResponse.json({ error: 'Script parse failed — try again' }, { status: 500 }) }

    return NextResponse.json({
      script,
      productName,
      productDescription,
    })
  } catch (err) {
    console.error('podcast-ad/plan error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Planner failed' }, { status: 500 })
  }
}
