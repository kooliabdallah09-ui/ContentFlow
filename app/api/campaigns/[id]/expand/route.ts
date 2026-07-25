import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { CAMPAIGN_FORMATS, CAMPAIGN_FORMAT_KEYS, getCampaignFormat } from '@/lib/campaign-formats'
import { loadBrandContext } from '@/lib/brand-context'

export const maxDuration = 300

// Expand a preview campaign (6 shots, from onboarding) into a full plan by
// generating ~18 additional shots with the full Sonnet prompt. Appends to
// the same campaign so the user's already-edited previews stay in place.

interface PlannedShot {
  format_key: string
  hook: string
  script?: string
  cta?: string
  caption: string
  setting: string
  visual_notes?: string
  aspect?: string
  duration?: number
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: userData } = await supabase.auth.getUser(authHeader.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = userData.user.id
    const { id: campaignId } = await params

    const { data: campaign } = await supabase
      .from('user_campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('user_id', userId)
      .maybeSingle()
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: existingShots } = await supabase
      .from('user_campaign_shots')
      .select('position, format_key')
      .eq('campaign_id', campaignId)
      .eq('user_id', userId)
    const existing = existingShots ?? []
    const startPos = (existing[existing.length - 1]?.position ?? 0)
    const existingKeysNote = existing.map(s => s.format_key).join(', ')

    const brand = await loadBrandContext(supabase, userId)
    const productName = (campaign.meta as { product_name?: string } | null)?.product_name ?? null

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const formatCatalog = CAMPAIGN_FORMATS.map(f => `- ${f.key} · ${f.label} · pipeline=${f.pipeline} · defaultDur=${f.defaultDuration}s · aspect=${f.defaultAspect}`).join('\n')

    const system = `You are the ContentFlow Campaign Planner (expansion mode). The user already has a preview of 6 shots for this campaign and wants 18 MORE distinct shot ideas to round out a full 2-week social calendar.

Rules:
1. Every shot's "format_key" MUST be one of the exact keys from the catalog below.
2. AVOID repeating the same formats the preview already used unless it's a category with room for variation. Aim for as much diversity as possible.
3. Balance: ~60% video, ~25% photo, ~15% experimental / two-person.
4. Fields TIGHT — hook (≤20 words), setting (≤15 words), caption (≤30 words).
5. Return STRICT JSON: {"shots":[{"format_key":"...","hook":"...","setting":"...","caption":"...","aspect":"9:16","duration":15} ...]}
6. No preamble, no code fences.

FORMAT CATALOG (use these keys):
${formatCatalog}

Existing preview shot formats: ${existingKeysNote || '(none)'}`

    const userMsg = `BRAND: ${brand?.companyName ?? '(unknown)'}
Voice: ${brand?.toneOfVoice ?? '—'}
Audience: ${brand?.targetAudience ?? '—'}

PRODUCT: ${productName ?? '(brand-level)'}
CAMPAIGN BRIEF: ${campaign.brief ?? '(none)'}

Return exactly 18 new shots that COMPLEMENT the preview.`

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4500,
      system,
      messages: [{ role: 'user', content: userMsg }],
    })
    const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim().replace(/^```json?\n?/i, '').replace(/\n?```$/, '')
    let parsed: { shots: PlannedShot[] }
    try { parsed = JSON.parse(raw) } catch { parsed = JSON.parse(raw.replace(/,\s*$/, '') + ']}') }

    const valid = (parsed.shots ?? [])
      .filter(s => typeof s.format_key === 'string' && CAMPAIGN_FORMAT_KEYS.includes(s.format_key))
      .slice(0, 18)
    if (valid.length === 0) return NextResponse.json({ error: 'Expansion returned no valid shots' }, { status: 500 })

    const rows = valid.map((s, i) => {
      const fmt = getCampaignFormat(s.format_key)!
      return {
        campaign_id: campaignId,
        user_id: userId,
        position: startPos + i + 1,
        format_key: fmt.key,
        pipeline: fmt.pipeline,
        spec: {
          hook: (s.hook ?? '').toString().slice(0, 500),
          setting: (s.setting ?? '').toString().slice(0, 400),
          caption: (s.caption ?? '').toString().slice(0, 800),
          aspect: (s.aspect as string) ?? fmt.defaultAspect,
          duration: typeof s.duration === 'number' ? s.duration : fmt.defaultDuration,
        },
        credit_hint: fmt.creditHint,
        selected: true,
        status: 'planned',
      }
    })

    await supabase.from('user_campaign_shots').insert(rows)

    // Flip the flag so we don't show "expand" prompt again.
    await supabase
      .from('user_campaigns')
      .update({ meta: { ...(campaign.meta as object), expandable: false, expanded_at: new Date().toISOString() } })
      .eq('id', campaignId)
      .eq('user_id', userId)

    return NextResponse.json({ added: rows.length })
  } catch (err) {
    console.error('campaigns/expand error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Expansion failed' }, { status: 500 })
  }
}
