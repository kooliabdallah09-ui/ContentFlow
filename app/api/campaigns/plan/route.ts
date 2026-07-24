import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { CAMPAIGN_FORMATS, CAMPAIGN_FORMAT_KEYS, getCampaignFormat } from '@/lib/campaign-formats'
import { loadBrandContext } from '@/lib/brand-context'

export const maxDuration = 90

// Campaign Planner — one product + one brief → shot table.
// Reads brand voice + product info + user brief, asks Sonnet to draft ~20-30
// shots using ONLY registered format keys, saves the campaign and shots as
// planned rows. No credits deducted here — user picks + fires in the UI.

interface PlannedShot {
  position: number
  format_key: string
  hook: string
  script: string
  cta: string
  caption: string
  setting: string
  visual_notes?: string
  aspect?: string
  duration?: number
  notes?: string
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
    const {
      name,
      brief,
      productId,       // brand_profiles.products[].id (one product per campaign)
      goal,            // launch | awareness | conversion | evergreen
      durationLabel,   // '1 week' | '2 weeks' | '1 month'
      influencerId,    // default actor for the whole campaign (optional)
      sceneId,         // default scene (optional)
      targetCount,     // 10..40, default 24
    } = body as Record<string, unknown>

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })
    }

    // ── Load context ──────────────────────────────────────────────
    const brand = await loadBrandContext(supabase, userId)
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

    const wantCount = Math.max(8, Math.min(40, typeof targetCount === 'number' ? targetCount : 24))

    // ── Ask Sonnet for the shot list ──────────────────────────────
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const formatCatalog = CAMPAIGN_FORMATS.map(f => `- ${f.key} · ${f.label} · ${f.tagline} · pipeline=${f.pipeline} · defaultDur=${f.defaultDuration}s · aspect=${f.defaultAspect}`).join('\n')

    const system = `You are the ContentFlow Campaign Planner. Given a brand, one specific product, and a campaign brief, you output a diverse shot list that mixes formats to cover a real 1-2 week social calendar (TikTok, Reels, Meta ads, static hero photos).

CRITICAL RULES:
1. Every shot's "format_key" MUST be one of the exact keys from the catalog below. Never invent a key.
2. Aim for balance: ~60% video shots, ~25% photo shots, ~15% experimental / two-person. Vary hooks, settings, aspects.
3. Every field is CONCRETE, not generic:
   - hook = one specific opening line (spoken or text overlay).
   - script = the FULL spoken/on-screen dialogue, beat by beat, matching the duration. Split with line breaks if there are multiple beats. For no-dialogue formats (aesthetic-broll, unboxing-asmr, hyper-motion, product-showcase), write the text overlays / ASMR sound cues instead.
   - cta = the closing call to action (one line — "Link in bio", "Try HiGG today", "Grab yours before it drops", etc.).
   - setting = a concrete place ("Brooklyn café at 9am", not "urban environment").
   - visual_notes = 1-2 sentences on camera moves + key visual beats ("cold open on hand grabbing bottle → cut to sip → slow zoom on smile").
   - caption = the on-post copy including relevant emojis + hashtags if the brand voice fits.
4. Return STRICT JSON with shape: {"shots":[{"position":1,"format_key":"...","hook":"...","script":"...","cta":"...","setting":"...","visual_notes":"...","caption":"...","aspect":"9:16","duration":15,"notes":"optional 1-liner"} ...]}
5. No preamble, no code fences. Just the JSON object.

FORMAT CATALOG (use these keys):
${formatCatalog}`

    const userMsg = `BRAND: ${brand?.companyName ?? '(unknown)'}
Description: ${brand?.description ?? '—'}
Voice: ${brand?.toneOfVoice ?? '—'}
Audience: ${brand?.targetAudience ?? '—'}
UVP: ${brand?.uniqueValueProp ?? '—'}
Pain points: ${brand?.customerPainPoints ?? '—'}

PRODUCT: ${product?.name ?? '(no product selected)'}
Product description: ${product?.description ?? '—'}

CAMPAIGN BRIEF: ${typeof brief === 'string' ? brief : '(none)'}
Goal: ${typeof goal === 'string' ? goal : 'awareness'}
Duration: ${typeof durationLabel === 'string' ? durationLabel : '2 weeks'}
Target shot count: ${wantCount}

Return the JSON shot list now.`

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system,
      messages: [{ role: 'user', content: userMsg }],
    })

    const raw = (msg.content[0] as { type: 'text'; text: string }).text
      .trim()
      .replace(/^```json?\n?/i, '')
      .replace(/\n?```$/, '')

    let parsed: { shots: PlannedShot[] }
    try {
      parsed = JSON.parse(raw) as { shots: PlannedShot[] }
    } catch {
      // Forgiving parser: attempt to close a truncated array.
      const salvage = raw.replace(/,\s*$/, '') + ']}'
      parsed = JSON.parse(salvage) as { shots: PlannedShot[] }
    }
    if (!Array.isArray(parsed.shots) || parsed.shots.length === 0) {
      return NextResponse.json({ error: 'Planner returned no shots' }, { status: 500 })
    }

    // ── Filter to registered format keys + attach defaults ────────
    const validShots = parsed.shots
      .filter(s => typeof s.format_key === 'string' && CAMPAIGN_FORMAT_KEYS.includes(s.format_key))
      .slice(0, wantCount)

    if (validShots.length === 0) {
      return NextResponse.json({ error: 'Planner did not use any known format keys' }, { status: 500 })
    }

    // ── Persist the campaign ──────────────────────────────────────
    const { data: campaign, error: campErr } = await supabase
      .from('user_campaigns')
      .insert({
        user_id: userId,
        name: name.trim().slice(0, 120),
        brief: typeof brief === 'string' ? brief.slice(0, 4000) : null,
        product_id: product?.id ?? null,
        goal: typeof goal === 'string' ? goal.slice(0, 40) : null,
        duration_label: typeof durationLabel === 'string' ? durationLabel.slice(0, 40) : null,
        status: 'planned',
        meta: {
          influencer_id: typeof influencerId === 'string' ? influencerId : null,
          scene_id: typeof sceneId === 'string' ? sceneId : null,
          product_name: product?.name ?? null,
          product_image_url: product?.image_url ?? null,
        },
      })
      .select('id')
      .single()
    if (campErr || !campaign) {
      console.error('campaign insert failed', campErr)
      return NextResponse.json({ error: 'Failed to save campaign' }, { status: 500 })
    }

    // ── Persist each shot ────────────────────────────────────────
    const rows = validShots.map((s, i) => {
      const fmt = getCampaignFormat(s.format_key)!
      return {
        campaign_id: campaign.id,
        user_id: userId,
        position: i + 1,
        format_key: fmt.key,
        pipeline: fmt.pipeline,
        spec: {
          hook: (s.hook ?? '').toString().slice(0, 500),
          script: (s.script ?? '').toString().slice(0, 1600),
          cta: (s.cta ?? '').toString().slice(0, 200),
          caption: (s.caption ?? '').toString().slice(0, 800),
          setting: (s.setting ?? '').toString().slice(0, 400),
          visual_notes: (s.visual_notes ?? '').toString().slice(0, 500),
          aspect: (s.aspect as string) ?? fmt.defaultAspect,
          duration: typeof s.duration === 'number' ? s.duration : fmt.defaultDuration,
          notes: (s.notes ?? '').toString().slice(0, 400),
          influencer_id: fmt.requiresActor && typeof influencerId === 'string' ? influencerId : null,
          scene_id: fmt.requiresScene && typeof sceneId === 'string' ? sceneId : null,
        },
        credit_hint: fmt.creditHint,
        selected: true,
        status: 'planned',
      }
    })

    const { error: shotsErr } = await supabase.from('user_campaign_shots').insert(rows)
    if (shotsErr) {
      console.error('shots insert failed', shotsErr)
      return NextResponse.json({ error: 'Failed to save shot list' }, { status: 500 })
    }

    return NextResponse.json({ id: campaign.id, count: rows.length })
  } catch (err) {
    console.error('campaigns/plan error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Campaign planning failed' },
      { status: 500 },
    )
  }
}
