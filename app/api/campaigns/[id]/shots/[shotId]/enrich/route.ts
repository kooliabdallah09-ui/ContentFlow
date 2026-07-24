import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getCampaignFormat } from '@/lib/campaign-formats'
import { loadBrandContext } from '@/lib/brand-context'

export const maxDuration = 60

// On-demand enrichment for a single shot. The initial planner call only
// produces hook + setting + caption to keep latency reasonable. When the
// user expands a shot (or clicks Enrich), Haiku fills in script + cta +
// visual_notes based on the shot's format + brand voice.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; shotId: string }> },
) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = userData.user.id

    const { id: campaignId, shotId } = await params

    const [{ data: shot }, { data: campaign }] = await Promise.all([
      supabase.from('user_campaign_shots').select('*').eq('id', shotId).eq('user_id', userId).maybeSingle(),
      supabase.from('user_campaigns').select('brief, meta').eq('id', campaignId).eq('user_id', userId).maybeSingle(),
    ])
    if (!shot) return NextResponse.json({ error: 'Shot not found' }, { status: 404 })

    const fmt = getCampaignFormat(shot.format_key)
    if (!fmt) return NextResponse.json({ error: 'Unknown format' }, { status: 400 })

    const brand = await loadBrandContext(supabase, userId)
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const productName = (campaign?.meta as { product_name?: string } | null)?.product_name ?? 'the product'
    const system = `You write the DETAILS for a single UGC shot in an existing campaign. Return STRICT JSON with shape: {"script":"...","cta":"...","visual_notes":"..."}. No preamble, no code fences.

- script = the FULL spoken/on-screen dialogue, beat by beat, matching the duration (${shot.spec?.duration ?? fmt.defaultDuration}s). Use line breaks between beats. For no-dialogue formats (aesthetic-broll, unboxing-asmr, hyper-motion, product-showcase), write the text overlays + ASMR sound cues instead of dialogue.
- cta = closing call to action, ONE line ("Link in bio", "Try ${productName} today", etc.).
- visual_notes = 1-2 sentences on camera moves + key visual beats ("cold open on hand grabbing bottle → cut to sip → slow zoom on smile").

Match the brand voice and hook the user already picked.`

    const userMsg = `FORMAT: ${fmt.label} — ${fmt.tagline}
Category: ${fmt.category}
Duration: ${shot.spec?.duration ?? fmt.defaultDuration}s
Aspect: ${shot.spec?.aspect ?? fmt.defaultAspect}

BRAND: ${brand?.companyName ?? '(unknown)'}
Voice: ${brand?.toneOfVoice ?? '—'}
Audience: ${brand?.targetAudience ?? '—'}

PRODUCT: ${productName}
CAMPAIGN BRIEF: ${campaign?.brief ?? '—'}

SHOT INFO (already picked by user):
Hook: ${shot.spec?.hook ?? ''}
Setting: ${shot.spec?.setting ?? ''}
Caption: ${shot.spec?.caption ?? ''}

Return the JSON now.`

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      system,
      messages: [{ role: 'user', content: userMsg }],
    })
    const raw = (msg.content[0] as { type: 'text'; text: string }).text
      .trim()
      .replace(/^```json?\n?/i, '')
      .replace(/\n?```$/, '')

    let parsed: { script?: string; cta?: string; visual_notes?: string }
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Enricher returned invalid JSON' }, { status: 500 })
    }

    const merged = {
      ...(shot.spec ?? {}),
      script: (parsed.script ?? '').toString().slice(0, 1600),
      cta: (parsed.cta ?? '').toString().slice(0, 200),
      visual_notes: (parsed.visual_notes ?? '').toString().slice(0, 500),
    }

    const { error } = await supabase
      .from('user_campaign_shots')
      .update({ spec: merged, updated_at: new Date().toISOString() })
      .eq('id', shotId)
      .eq('user_id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ spec: merged })
  } catch (err) {
    console.error('enrich shot error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Enrichment failed' },
      { status: 500 },
    )
  }
}
