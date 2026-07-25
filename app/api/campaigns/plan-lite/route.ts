import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { CAMPAIGN_FORMATS, CAMPAIGN_FORMAT_KEYS, getCampaignFormat } from '@/lib/campaign-formats'
import { loadBrandContext } from '@/lib/brand-context'

export const maxDuration = 60

// Campaign Planner LITE — 6-shot preview generator used in onboarding.
// Same underlying registry + brand context as /api/campaigns/plan, but:
//   - No trend scraping (skip Tavily to keep it under ~10s)
//   - No inspiration URL fetch
//   - No research_summary (nice-to-have, but slows the call)
//   - Only hook + setting + caption per shot (no script/cta/visual_notes)
//   - Sonnet output stays under ~1500 tokens so this returns in ~10-15s
//
// The saved campaign row carries a meta.source = 'onboarding' flag so the
// dashboard can prompt the user to expand it into a full 24-shot plan.

interface PlannedShot {
  position: number
  format_key: string
  hook: string
  setting: string
  caption: string
  aspect?: string
  duration?: number
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { brief, productId } = body as { brief?: string; productId?: string }

    const brand = await loadBrandContext(supabase, userId)

    // Product resolution — optional. If none set, use brand.productType as a
    // placeholder so the plan still feels product-anchored.
    let product: { id: string; name: string; description?: string; image_url?: string | null } | null = null
    if (typeof productId === 'string' && productId.length > 0) {
      const { data: brandRow } = await supabase
        .from('brand_profiles')
        .select('products')
        .eq('user_id', userId)
        .maybeSingle()
      const products = Array.isArray(brandRow?.products) ? brandRow!.products : []
      const found = products.find((p: { id?: string }) => p.id === productId)
      if (found) product = { id: found.id, name: found.name, description: found.description, image_url: found.image_url ?? null }
    }
    if (!product && (brand?.productType || brand?.companyName)) {
      product = { id: '', name: brand?.productType || brand?.companyName || 'your offering' }
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const formatCatalog = CAMPAIGN_FORMATS.slice(0, 20).map(f => `- ${f.key} · ${f.label}`).join('\n')

    const system = `You are the ContentFlow Campaign Planner (Preview mode). Given a brand + one product + a short brief, output SIX diverse shot ideas that showcase what the platform can do.

Rules:
1. Every shot's "format_key" MUST be one of the exact keys from the catalog below.
2. Mix video and photo formats. Vary hooks, settings, aspects.
3. Fields are TIGHT — this is a preview, not the final production brief:
   - hook = ONE opening line, ≤ 15 words.
   - setting = a concrete place, ≤ 12 words.
   - caption = the on-post copy, ≤ 20 words + one or two hashtags.
4. Return STRICT JSON: {"shots":[{"position":1,"format_key":"...","hook":"...","setting":"...","caption":"...","aspect":"9:16","duration":15} ...]}
5. No preamble, no code fences.

FORMAT CATALOG (use these keys):
${formatCatalog}`

    const userMsg = `BRAND: ${brand?.companyName ?? '(unknown)'}
Voice: ${brand?.toneOfVoice ?? '—'}
Audience: ${brand?.targetAudience ?? '—'}

PRODUCT: ${product?.name ?? '(unknown)'}
${product?.description ? 'Description: ' + product.description : ''}

BRIEF: ${typeof brief === 'string' && brief.trim() ? brief : 'A first preview showing the range of content you can produce for this brand.'}

Return the JSON shot list (exactly 6 shots) now.`

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1800,
      system,
      messages: [{ role: 'user', content: userMsg }],
    })

    const raw = (msg.content[0] as { type: 'text'; text: string }).text
      .trim()
      .replace(/^```json?\n?/i, '')
      .replace(/\n?```$/, '')

    let parsed: { shots: PlannedShot[] }
    try { parsed = JSON.parse(raw) as { shots: PlannedShot[] } }
    catch { parsed = JSON.parse(raw.replace(/,\s*$/, '') + ']}') as { shots: PlannedShot[] } }

    const valid = (parsed.shots ?? [])
      .filter(s => typeof s.format_key === 'string' && CAMPAIGN_FORMAT_KEYS.includes(s.format_key))
      .slice(0, 6)
    if (valid.length === 0) return NextResponse.json({ error: 'Planner returned no valid shots' }, { status: 500 })

    // Persist campaign as a preview.
    const campaignName = `${brand?.companyName ?? 'My brand'} — Preview`
    const { data: campaign, error: campErr } = await supabase
      .from('user_campaigns')
      .insert({
        user_id: userId,
        name: campaignName.slice(0, 120),
        brief: typeof brief === 'string' ? brief.slice(0, 2000) : null,
        product_id: product?.id || null,
        goal: 'awareness',
        duration_label: '1 week',
        status: 'planned',
        meta: {
          source: 'onboarding',
          product_name: product?.name ?? null,
          product_image_url: product?.image_url ?? null,
          expandable: true,
        },
      })
      .select('id')
      .single()
    if (campErr || !campaign) {
      return NextResponse.json({ error: 'Failed to save preview campaign' }, { status: 500 })
    }

    const rows = valid.map((s, i) => {
      const fmt = getCampaignFormat(s.format_key)!
      return {
        campaign_id: campaign.id,
        user_id: userId,
        position: i + 1,
        format_key: fmt.key,
        pipeline: fmt.pipeline,
        spec: {
          hook: (s.hook ?? '').toString().slice(0, 200),
          setting: (s.setting ?? '').toString().slice(0, 200),
          caption: (s.caption ?? '').toString().slice(0, 300),
          aspect: (s.aspect as string) ?? fmt.defaultAspect,
          duration: typeof s.duration === 'number' ? s.duration : fmt.defaultDuration,
        },
        credit_hint: fmt.creditHint,
        selected: true,
        status: 'planned',
      }
    })

    await supabase.from('user_campaign_shots').insert(rows)

    return NextResponse.json({
      id: campaign.id,
      count: rows.length,
      shots: rows.map((r, i) => ({ ...valid[i], position: i + 1, format_label: getCampaignFormat(r.format_key)!.label })),
    })
  } catch (err) {
    console.error('campaigns/plan-lite error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Preview planning failed' }, { status: 500 })
  }
}
