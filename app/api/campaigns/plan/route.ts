import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { CAMPAIGN_FORMATS, CAMPAIGN_FORMAT_KEYS, getCampaignFormat } from '@/lib/campaign-formats'
import { loadBrandContext } from '@/lib/brand-context'
import { analyzeInspiration } from '@/lib/inspiration-fetch'
import { autoDiscoverTrendSources, formatSourcesForPrompt } from '@/lib/trends/web-search'

export const maxDuration = 300

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
      inspiration,     // freeform user-pasted competitor / trend / hook notes
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

    function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T, label: string): Promise<T> {
      return Promise.race([
        promise,
        new Promise<T>(resolve => setTimeout(() => { console.warn(`[campaigns/plan] ${label} timed out after ${ms}ms`); resolve(fallback) }, ms)),
      ])
    }

    const t0 = Date.now()

    // ── Fetch any URLs the user pasted in inspiration notes ───────
    let inspirationSection = ''
    if (typeof inspiration === 'string' && inspiration.trim()) {
      const { urls, summary } = await withTimeout(
        analyzeInspiration(inspiration).catch(() => ({ urls: [] as string[], summary: '' })),
        15000,
        { urls: [], summary: '' },
        'analyzeInspiration',
      )
      const notes = inspiration.slice(0, 4000)
      const fetched = summary ? `\n\nFETCHED PAGE CONTENT from the URLs the user pasted (${urls.length} sources, use these to identify winning hooks, formats, tones — don't just quote, extract patterns):\n${summary}` : ''
      inspirationSection = `\nUSER INSPIRATION / COMPETITOR / TREND NOTES — use these to anchor hooks and formats to what's actually working right now:\n${notes}${fetched}`
    }
    console.log(`[campaigns/plan] inspiration done in ${Date.now() - t0}ms`)

    const t1 = Date.now()
    // ── Auto-discover trend sources via Tavily ────────────────────
    // Runs in parallel background; failure is silent (planner still works).
    const autoTrends = await withTimeout(
      autoDiscoverTrendSources({
        brand: brand?.companyName,
        productName: product?.name,
        productDescription: product?.description,
        category: brand?.productType,
        goal: typeof goal === 'string' ? goal : undefined,
        audience: brand?.targetAudience,
      }).catch(() => ({ queries: [] as string[], sources: [] as Array<{ url: string; title: string; excerpt: string; query: string }> })),
      30000,
      { queries: [] as string[], sources: [] as Array<{ url: string; title: string; excerpt: string; query: string }> },
      'autoDiscoverTrendSources',
    )
    const autoSourcesSection = formatSourcesForPrompt(autoTrends.sources)
    console.log(`[campaigns/plan] trends done in ${Date.now() - t1}ms — ${autoTrends.sources.length} sources`)

    // ── Ask Sonnet for the shot list ──────────────────────────────
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const formatCatalog = CAMPAIGN_FORMATS.map(f => `- ${f.key} · ${f.label} · ${f.tagline} · pipeline=${f.pipeline} · defaultDur=${f.defaultDuration}s · aspect=${f.defaultAspect}`).join('\n')

    const system = `You are the ContentFlow Campaign Planner. Given a brand, one specific product, and a campaign brief, you output a diverse shot list that mixes formats to cover a real 1-2 week social calendar (TikTok, Reels, Meta ads, static hero photos).

CRITICAL RULES:
1. Every shot's "format_key" MUST be one of the exact keys from the catalog below. Never invent a key.
2. Aim for balance: ~60% video shots, ~25% photo shots, ~15% experimental / two-person. Vary hooks, settings, aspects.
3. Fields are CONCRETE, not generic. Keep them TIGHT — planner output is a scan-able overview, not the final script.
   - hook = ONE specific opening line, ≤ 20 words.
   - setting = a concrete place ≤ 15 words ("Brooklyn café at 9am", not "urban environment").
   - caption = the on-post copy, ≤ 30 words + hashtags if brand fits.
   - script, cta, visual_notes = LEAVE THEM OUT of this response. They'll be generated on demand later.
4. Return STRICT JSON: {"research_summary":"...","shots":[{"position":1,"format_key":"...","hook":"...","setting":"...","caption":"...","aspect":"9:16","duration":15} ...]}
5. research_summary = 3-4 sentences in French, tight, summarizing what you learned from the auto-discovered sources + user inspiration notes. Address the reader directly ("Voici ce que la recherche a révélé…"). If no sources, summarize your strategic direction from brand + brief.
6. No preamble, no code fences. Just the JSON object.

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
${inspirationSection}
${autoSourcesSection ? '\n' + autoSourcesSection : ''}

Return the JSON shot list now.`

    const tSonnet = Date.now()
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 6000,
      system,
      messages: [{ role: 'user', content: userMsg }],
    })
    console.log(`[campaigns/plan] Sonnet done in ${Date.now() - tSonnet}ms`)

    const raw = (msg.content[0] as { type: 'text'; text: string }).text
      .trim()
      .replace(/^```json?\n?/i, '')
      .replace(/\n?```$/, '')

    let parsed: { shots: PlannedShot[]; research_summary?: string }
    try {
      parsed = JSON.parse(raw) as { shots: PlannedShot[]; research_summary?: string }
    } catch {
      // Forgiving parser: attempt to close a truncated array.
      const salvage = raw.replace(/,\s*$/, '') + ']}'
      parsed = JSON.parse(salvage) as { shots: PlannedShot[]; research_summary?: string }
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
          trend_queries: autoTrends.queries,
          trend_sources: autoTrends.sources.slice(0, 8).map(s => ({ url: s.url, title: s.title, query: s.query })),
          research_summary: typeof parsed.research_summary === 'string' ? parsed.research_summary.slice(0, 2000) : null,
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
