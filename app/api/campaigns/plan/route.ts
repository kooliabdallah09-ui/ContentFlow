import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { CAMPAIGN_FORMATS, CAMPAIGN_FORMAT_KEYS, getCampaignFormat } from '@/lib/campaign-formats'
import { loadBrandContext } from '@/lib/brand-context'
import { analyzeInspiration } from '@/lib/inspiration-fetch'
import { autoDiscoverTrendSources, formatSourcesForPrompt } from '@/lib/trends/web-search'
import { deductCredits } from '@/lib/deduct-credits'

export const maxDuration = 300

// Flat fee to run the planner (Sonnet + trend search + inspiration fetch).
// Rendering individual shots is charged separately, per-shot, from the
// shot table page.
const PLAN_COST = 5

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
  text_overlay?: string  // Short copy composited on top of the render, not painted by the model.
  visual_notes?: string
  aspect?: string
  duration?: number
  notes?: string
}

// Recovers a valid JSON envelope from a truncated Sonnet response.
// Scans the raw text tracking string state + brace/bracket depth. When we hit
// EOF mid-string or mid-object, we rewind to the last position where depth was
// exactly {shots-array: 1, top-object: 1} and no string was open — that's a
// complete-shot boundary — then close the array and object. Returns whatever
// shots parsed successfully; drops the partial one.
function salvagePartialJson(raw: string): { shots: PlannedShot[]; research_summary?: string } {
  let inString = false
  let escape = false
  let depth = 0
  let lastCompleteBoundary = -1
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') {
      depth--
      // Depth 2 = inside the shots array, at the end of a complete shot object.
      // (Depth: top-object=1, shots-array=2. Closing a shot brings us back to 2.)
      if (depth === 2 && ch === '}') lastCompleteBoundary = i
    }
  }
  if (lastCompleteBoundary === -1) {
    // Nothing usable — try the old naive fallback as a last resort.
    return JSON.parse(raw.replace(/,\s*$/, '') + ']}') as { shots: PlannedShot[]; research_summary?: string }
  }
  const trimmed = raw.slice(0, lastCompleteBoundary + 1) + ']}'
  return JSON.parse(trimmed) as { shots: PlannedShot[]; research_summary?: string }
}

export async function POST(request: NextRequest) {
  // Hoisted so the outer catch can still refund if Sonnet / trend fetch throws.
  let refundOnCrash: ((reason: string) => Promise<void>) | null = null
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
      targetCount,     // fallback if formatMix not supplied
      inspiration,     // freeform user-pasted competitor / trend / hook notes
      formatMix,       // Record<category, count> — how many shots per format bucket
    } = body as Record<string, unknown>

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })
    }

    // ── Charge 5 credits for the planner run ──────────────────────
    // Do this BEFORE any expensive work (Sonnet, trend search, page fetches)
    // so failures happen on the cheap path. Refund inside catch blocks below
    // if anything downstream of the deduction fails.
    const { data: userCredits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .single()
    if (!userCredits || userCredits.balance < PLAN_COST) {
      return NextResponse.json({ error: `Insufficient credits. Need ${PLAN_COST} to plan a campaign.` }, { status: 402 })
    }
    await deductCredits(supabase, userId, PLAN_COST, userCredits.balance, userCredits.pack_credits ?? 0)
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: PLAN_COST,
      transaction_type: 'generation',
      content_type: 'campaign_plan',
      description: `Campaign plan: ${name.trim().slice(0, 80)}`,
    })
    const preBalance = userCredits.balance
    const prePack = userCredits.pack_credits ?? 0
    let planCharged = true
    const refundIfCharged = async (reason: string) => {
      if (!planCharged) return
      planCharged = false
      await supabase.from('user_credits')
        .update({ balance: preBalance, pack_credits: prePack })
        .eq('user_id', userId)
      await supabase.from('credit_transactions').insert({
        user_id: userId,
        amount: PLAN_COST,
        transaction_type: 'refund',
        content_type: 'campaign_plan',
        description: `Refund — ${reason}`,
      })
    }
    refundOnCrash = refundIfCharged

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

    // ── Parse format mix ─────────────────────────────────────────
    // formatMix keys are CampaignFormat.category values ('solo', 'two-person',
    // 'motion', 'transformation', 'photo'). Value is desired shot count in
    // that bucket. Sum drives the total. If mix is missing/empty we fall back
    // to targetCount for backward compat.
    const mixRaw = (formatMix && typeof formatMix === 'object') ? (formatMix as Record<string, unknown>) : {}
    const cleanMix: Record<string, number> = {}
    for (const [k, v] of Object.entries(mixRaw)) {
      const n = Math.max(0, Math.min(20, Math.round(Number(v) || 0)))
      if (n > 0) cleanMix[k] = n
    }
    const mixSum = Object.values(cleanMix).reduce((a, b) => a + b, 0)
    const wantCount = mixSum > 0
      ? Math.min(40, mixSum)
      : Math.max(8, Math.min(40, typeof targetCount === 'number' ? targetCount : 24))

    // Build a human-readable distribution line for Sonnet.
    const mixDescription = mixSum > 0
      ? Object.entries(cleanMix).map(([cat, n]) => {
          const catFormats = CAMPAIGN_FORMATS.filter(f => f.category === cat).map(f => f.key).join(', ')
          return `- ${n} × category="${cat}" (choose from: ${catFormats})`
        }).join('\n')
      : ''

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
    const formatCatalog = CAMPAIGN_FORMATS.map(f => `- ${f.key} · ${f.label} · category=${f.category} · pipeline=${f.pipeline} · ${f.tagline}`).join('\n')
    // Bare list of valid keys for the "allowed values" enum reminder at the
    // end. Repeated intentionally so Sonnet can't miss it even in a long ctx.
    const allowedKeysBlock = CAMPAIGN_FORMAT_KEYS.map(k => `"${k}"`).join(', ')

    const distributionRule = mixDescription
      ? `2. FORMAT DISTRIBUTION — the user has chosen this exact mix. Match it as closely as possible:
${mixDescription}
   Total shots to plan: ${wantCount}. Every shot's format_key MUST come from the category list above.`
      : `2. Aim for balance: ~60% video shots, ~25% photo shots, ~15% experimental / two-person. Vary hooks, settings, aspects.`

    const productHasPhoto = !!product?.image_url
    const productLockBlock = productHasPhoto
      ? `PRODUCT LOCK (mandatory):
- A reference photo of "${product?.name}" is attached to this campaign and WILL be passed to every image/video renderer that shows the product.
- For any shot that features the product, write the "setting" prompt as INSTRUCTIONS FOR HOW TO USE the reference photo — never as a description of a different-looking product from the same category.
- Say things like "Place the reference product on…", "Frame the reference product with…", "Show the reference product being held by…". Do NOT re-describe what the product looks like — the renderer already has the photo.
- Do NOT invent packaging text, logos, colour variants, or design details that aren't in the reference photo. The renderer will invent garbled fake ones if you invite it to.`
      : `PRODUCT LOCK (no reference photo available):
- No product photo is attached to this campaign. Renderers will have to imagine the product from your description.
- Prefer shot formats that DON'T require product identity fidelity: lifestyle scenes with the product implied, testimonial UGC, meme posts, atmospheric b-roll, hands-on-something-similar.
- Avoid hero-editorial and studio-still formats unless the product is generic enough that any stand-in works.`

    const system = `You are the ContentFlow Campaign Planner — a senior creative director + AI-production engineer. Your job is not just "creative ideas" — every shot you plan will be rendered by a specific AI pipeline with specific strengths and hard limits. Write like you know exactly what will and won't come out the other end.

═══════════════════════════════════════════════════════════════════════
AI PRODUCTION PIPELINE — what will actually render your specs
═══════════════════════════════════════════════════════════════════════

Images (photos, hero shots, carousel slides, meme covers)
  Engine: Nano Banana Pro / Nano Banana 2 (Google Gemini image models)
  ✅ Strong:  photoreal humans, product close-ups, food, lifestyle scenes,
             textured backgrounds, editorial lighting, atmospheric b-roll,
             using an attached reference image as the exact subject.
  ❌ Weak / hallucinates:
     - Legible on-image text longer than a 1-3-word headline (spelling breaks,
       words invert, characters mutate). NEVER put paragraphs of text in the
       image spec. If a shot needs text, spec it in a SEPARATE text_overlay
       field — the app composites clean text via CSS/canvas afterward.
     - Software UI, app screens, dashboards, code editors, phone screens
       showing real interfaces — Nano Banana invents fake garbled UI. If a
       shot needs to show software, either (a) frame it out (blurred glow
       behind an actor, laptop closed), or (b) leave the screen blank and
       note "screen recording composited in post".
     - Specific real-person likenesses (celebrities, historical figures).
     - Precise counts of small objects (7 dice, 12 pills → often wrong).
     - Reading barcodes, QR codes, exact price tags, tiny label text.
     - Complex diagrams with labels — will render illegible squiggles.

Videos (UGC, motion, product ads, cinematic)
  Engine: Seedance 2.0 / Seedance Mini (ByteDance)
  ✅ Strong:  5-15s clips at 720p / 1080p, single actor talking to camera,
             product motion (rotation, drop, pour, splash, unbox), single
             smooth camera moves, lip-sync from a script, up to 3 shot cuts.
  ❌ Weak / breaks:
     - Duration > 15s in one clip (multi-clip stitching is done separately).
     - Fast-cut complex multi-step transformations (before → mess → after in
       one 10s clip = jump-cut chaos). Break into separate shots or accept
       a single-moment reveal.
     - Precise product-detail persistence across long motion (branding may
       drift after 5-6s — keep long clips wide, close-ups short).
     - Legible on-video text (same as image models).
     - Software UI on-screen (same as image models).
     - Complex multi-actor choreography (>2 people interacting).
     - Real-world physics that violate common sense (product floating,
       shattering into brand logo, etc.) — will look fake.

Voice / scripts
  Engine: Sonnet (script drafting on demand) + ElevenLabs (voiceover)
  ✅ Strong: natural conversational scripts, casting different voices,
            multi-language. Scripts are drafted per-shot, not by you.
  ❌ Weak:  robotic cadence on long paragraphs (>60 words in one take).
     — you don't write scripts here; you brief the SHOT (hook + moment).

Text captions / posts
  Engine: You. Write the actual paste-ready copy for social platforms.

═══════════════════════════════════════════════════════════════════════
${productLockBlock}
═══════════════════════════════════════════════════════════════════════

CRITICAL RULES:

1. Every shot's "format_key" MUST be one of the EXACT keys from the catalog below. The app has renderers only for these keys — any invented key gets dropped and the shot never renders. Copy the keys character-for-character. Never invent, translate, pluralize, or reword.

${distributionRule}

3. Every field is LOAD-BEARING — the renderer consumes it literally. NO vague marketing copy.

   For UGC / VIDEO / MOTION shots (pipelines: ugc-video, ugc-interview, ugc-couple, motion-broll):
   - hook = ONE specific spoken opening line, ≤ 20 words. Something a real person would actually say — not a slogan.
   - setting = concrete PLACE + a one-line direction for what happens on camera (≤ 25 words). Example: "Brooklyn café at 9am; she opens the box on the counter, camera on the box." Not "urban environment."
   - caption = the on-post copy, ≤ 30 words + hashtags if brand fits.
   - script, cta, visual_notes = LEAVE OUT. Drafted on demand later per-shot.
   - Respect Seedance limits: don't spec > 15s or > 3 cuts in one clip.

   For PHOTO shots (pipelines: hero-editorial, product-photo, lifestyle-photo):
   - hook = the ONE-LINE overlay/caption headline (≤ 8 words). Rendered as clean text on top of the photo — NOT painted into the pixels.
   - setting = the FULL image prompt (60-120 words). Must include, in this order:
     · subject anchor — if a product reference photo is attached, say "the reference product" (not "a black tower"). If no ref photo, describe the product concretely.
     · framing (close-up / medium / wide, portrait / landscape / square)
     · lighting (source, direction, hardness, colour temperature)
     · background (colour / texture / material — no vague words like "modern")
     · mood / palette (2-3 concrete adjectives + colour references)
     · optional style reference (photographer name / magazine feel)
     NEVER include text that must appear inside the image (Nano Banana can't spell). If you want text on the shot, put it in text_overlay.
   - text_overlay (optional) = the SHORT overlay copy that gets composited in post (not painted). Max 8 words.
   - Example GOOD setting: "Place the reference product centred on a slate concrete surface. Overhead flat-lay, medium wide. Cool RGB rim light (electric blue + magenta) grazing from the left, hard shadow to the right. Scattered PC components — RAM stick, GPU, thermal paste tube — arranged asymmetrically around the product. Deep charcoal background. Palette: gunmetal, blue-purple, matte black. Editorial WIRED-magazine feel."
   - Example BAD setting: "Dark studio, RGB lighting on a PC tower." ← too vague, unrenderable.
   - Example BAD setting: "…and the words 'BUILD YOUR DREAM PC' painted across the top in bold sans-serif." ← Nano Banana will render garbled text; use text_overlay instead.

   For SOCIAL shots (pipelines: social-carousel, social-post):
   - hook = the cover-slide/post headline (short, punchy).
   - setting = the FULL visual spec. For carousels, PER-SLIDE breakdown: "Slide 1: [visual]. Slide 2: [visual]. …" — each slide gets one Nano Banana render, so each slide's visual spec must be self-contained (60+ words per slide).
   - text_overlay (optional) = the exact SHORT text that will be composited onto each slide (e.g. "Slide 1: 'Your PC. Your rules.' | Slide 2: 'CPU: the brain' | …"). Composited via CSS after render — NOT painted by Nano Banana.
   - caption = the FULL long-form caption the user will paste into IG / FB, including hashtags. Not a summary — real paste-ready copy.
   - For meme-post: setting describes the visual; text_overlay is the meme text.

4. HALLUCINATION-SAFE ALTERNATIVES — when a shot idea WOULD require something the pipeline can't do, use the safe alternative instead:
   - "Screenshot of the app's dashboard" → "Actor holds a phone, screen off-frame or blurred glow; caption implies the outcome." OR "Close-up of hands typing on a laptop, screen not visible."
   - "Before/after transformation in one clip" → Two separate shots (position N + N+1), or a still hero image.
   - "Real celebrity endorses the product" → Cast a stylistically similar unnamed creator, or an atmospheric b-roll with a testimonial voiceover.
   - "Big block of text explaining the product" → Move the text into caption/text_overlay; keep the image spec visual-only.
   - "Product does something physically impossible" → Rewrite as a plausible real-world moment.

5. Return STRICT JSON with this exact shape:
{"research_summary":"...","shots":[
  {"position":1,"format_key":"...","hook":"...","setting":"...","text_overlay":"...","caption":"...","aspect":"9:16","duration":15}
]}
   The "text_overlay" field is optional — omit it (or leave empty string) when the shot has no on-image text.

6. research_summary = 3-4 sentences in French, tight, summarising what you learned from the auto-discovered sources + user inspiration notes. Address the reader directly ("Voici ce que la recherche a révélé…"). If no sources, summarise your strategic direction from brand + brief.

7. No preamble, no code fences. Just the JSON object.

═══════════════════════════════════════════════════════════════════════
FORMAT CATALOG — every renderable format. Use ONLY these keys:
${formatCatalog}

ALLOWED format_key values (complete set):
[${allowedKeysBlock}]

If none fit a shot idea, pick the closest — never invent a new key.`

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
    // Every social/photo shot can carry a 2000-char setting; 20 shots + a
    // ~1500-char research summary can exceed 12K output tokens. Room to spare
    // matters more than latency here — Sonnet only bills used tokens.
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: userMsg }],
    })
    console.log(`[campaigns/plan] Sonnet done in ${Date.now() - tSonnet}ms · stop=${msg.stop_reason}`)

    const raw = (msg.content[0] as { type: 'text'; text: string }).text
      .trim()
      .replace(/^```json?\n?/i, '')
      .replace(/\n?```$/, '')

    let parsed: { shots: PlannedShot[]; research_summary?: string }
    try {
      parsed = JSON.parse(raw) as { shots: PlannedShot[]; research_summary?: string }
    } catch {
      // Salvage a truncated response. Sonnet was cut off mid-string / mid-object
      // (usually from hitting max_tokens on a 20-shot plan). Walk the raw text
      // forward, tracking brace/bracket depth OUTSIDE of strings, and truncate
      // at the last "shots" element boundary — then close the array + top-level
      // object. This preserves every complete shot Sonnet already emitted.
      parsed = salvagePartialJson(raw)
    }
    if (!Array.isArray(parsed.shots) || parsed.shots.length === 0) {
      await refundIfCharged('planner returned no shots')
      return NextResponse.json({ error: 'Planner returned no shots' }, { status: 500 })
    }

    // ── Filter to registered format keys + attach defaults ────────
    const validShots = parsed.shots
      .filter(s => typeof s.format_key === 'string' && CAMPAIGN_FORMAT_KEYS.includes(s.format_key))
      .slice(0, wantCount)

    if (validShots.length === 0) {
      await refundIfCharged('planner did not use any known format keys')
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
      await refundIfCharged('failed to save campaign row')
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
          // 2000 chars — photo formats now embed a full image prompt here,
          // and carousels use it for per-slide breakdowns.
          setting: (s.setting ?? '').toString().slice(0, 2000),
          text_overlay: (s.text_overlay ?? '').toString().slice(0, 500),
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
      // Best-effort: also delete the orphan campaign row so the user isn't
      // left with an empty campaign after the refund.
      await supabase.from('user_campaigns').delete().eq('id', campaign.id)
      await refundIfCharged('failed to save shot rows')
      return NextResponse.json({ error: 'Failed to save shot list' }, { status: 500 })
    }

    return NextResponse.json({ id: campaign.id, count: rows.length, cost: PLAN_COST })
  } catch (err) {
    console.error('campaigns/plan error:', err)
    if (refundOnCrash) {
      try { await refundOnCrash(err instanceof Error ? err.message.slice(0, 80) : 'unknown error') }
      catch (refundErr) { console.error('campaigns/plan refund failed:', refundErr) }
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Campaign planning failed' },
      { status: 500 },
    )
  }
}
