// Per-slide retry endpoint. Takes ONE slide's spec (headline/body/cta/imagePrompt)
// + the same refs the parent carousel call used, and regenerates that single
// slide's image. Charges only that slide's credits (5cr Pro, 3cr NB2). If it
// still fails after an internal retry, the user is refunded automatically.
//
// The main /carousel endpoint already returns each slide's imagePrompt, so the
// client just echoes it back here — no Sonnet call needed on retry.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { deductCredits } from '@/lib/deduct-credits'
import { generateNanoBananaImage } from '@/lib/nanobanana'

export const maxDuration = 120

const CREDIT_PER_SLIDE = 5
const CREDIT_PER_SLIDE_NB2 = 3

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = authHeader.slice(7)
  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = userData.user.id

  const {
    slide,
    slideIndex,
    illDesc = '',
    platform = 'instagram',
    influencerId,
    studioProductId,
    referenceImageBase64,
    referenceImageMimeType,
    model: modelRaw,
  } = await request.json()
  const model: 'pro' | 'nb2' = modelRaw === 'nb2' ? 'nb2' : 'pro'

  if (!slide || typeof slide !== 'object') {
    return NextResponse.json({ error: 'Missing slide spec' }, { status: 400 })
  }
  if (typeof slide.imagePrompt !== 'string' || !slide.imagePrompt.trim()) {
    return NextResponse.json({ error: 'Slide is missing imagePrompt — cannot retry' }, { status: 400 })
  }

  const cost = model === 'nb2' ? CREDIT_PER_SLIDE_NB2 : CREDIT_PER_SLIDE

  // ── Credit check + deduct ─────────────────────────────────────────
  let balance = 0
  let packCredits = 0
  {
    const withPack = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .maybeSingle()
    if (withPack.data) {
      balance = withPack.data.balance ?? 0
      packCredits = withPack.data.pack_credits ?? 0
    }
  }
  if (balance < cost) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
  }
  await deductCredits(supabase, userId, cost, balance, packCredits)
  const refundIfNeeded = async (reason: string) => {
    try {
      const { data: cur } = await supabase.from('user_credits').select('balance, pack_credits').eq('user_id', userId).maybeSingle()
      if (cur) {
        await supabase.from('user_credits')
          .update({ balance: (cur.balance ?? 0) + cost, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
        await supabase.from('credit_transactions').insert({
          user_id: userId, amount: cost, transaction_type: 'refund',
          content_type: 'carousel', description: `Refund — slide retry failed (${reason})`,
        })
      }
    } catch (e) { console.error('[carousel-slide] refund failed:', e) }
  }

  // ── Resolve refs (product + influencer identity photos) ────────────
  type Ref = { base64: string; mimeType: string }
  const fetchRef = async (url: string): Promise<Ref | null> => {
    try {
      const r = await fetch(url)
      if (!r.ok) return null
      return { base64: Buffer.from(await r.arrayBuffer()).toString('base64'), mimeType: r.headers.get('content-type') || 'image/png' }
    } catch { return null }
  }

  const productRefs: Ref[] = []
  if (typeof studioProductId === 'string' && studioProductId) {
    const { data: prod } = await supabase.from('user_studio_products')
      .select('photo_urls').eq('id', studioProductId).eq('user_id', userId).maybeSingle()
    const urls: string[] = Array.isArray(prod?.photo_urls) ? prod!.photo_urls.slice(0, 2) : []
    for (const u of urls) { const ref = await fetchRef(u); if (ref) productRefs.push(ref) }
  }

  let influencerAppearance = ''
  const influencerRefs: Ref[] = []
  if (typeof influencerId === 'string' && influencerId) {
    const { data: inf } = await supabase.from('user_influencers')
      .select('appearance_prompt, portrait_url, character_sheet_url')
      .eq('id', influencerId).eq('user_id', userId).maybeSingle()
    if (inf) {
      influencerAppearance = inf.appearance_prompt ?? ''
      for (const u of [inf.character_sheet_url, inf.portrait_url]) {
        if (typeof u === 'string' && u.startsWith('http')) {
          const ref = await fetchRef(u); if (ref) influencerRefs.push(ref)
        }
      }
    }
  }

  // ── Pull this slide's dedicated paragraph from per-slide illDesc ───
  function sliceIllDescForSlide(fullIllDesc: string, idx: number): string {
    if (!fullIllDesc) return ''
    const re = /slide\s*(\d{1,2})\s*[:\-–—]\s*([\s\S]*?)(?=\s*[|\n]?\s*slide\s*\d{1,2}\s*[:\-–—]|$)/gi
    const chunks: Record<number, string> = {}
    let m: RegExpExecArray | null
    while ((m = re.exec(fullIllDesc)) !== null) {
      const n = parseInt(m[1], 10)
      const body = m[2].trim().replace(/\s*[|]\s*$/, '').trim()
      if (n > 0 && body) chunks[n] = body
    }
    return chunks[idx + 1] || fullIllDesc
  }
  const perSlideIll = sliceIllDescForSlide(illDesc, typeof slideIndex === 'number' ? slideIndex : 0)
  const sceneSpec = perSlideIll || slide.imagePrompt
  let finalPrompt = `SCENE (this is what the image MUST show, in full): ${sceneSpec}`
  if (influencerAppearance) {
    finalPrompt = `${finalPrompt}\n\nIDENTITY LOCK (apply only if compatible with the scene above): if the scene shows a person AND the described subject (gender, age, general demographic) is compatible with this identity, render that person with the following exact identity — face, hair, skin tone, build. If the scene explicitly describes a subject that CONTRADICTS this identity (different gender, very different age, non-human subject), IGNORE this identity block entirely. The scene direction ALWAYS wins over the identity lock.\n\n${influencerAppearance}\n\nWhen this identity IS used, they appear candidly — natural face, no plastic face, no AI-smooth skin, real texture, bright even light.`
  }

  const extraRefs: Ref[] = [
    ...productRefs,
    ...(referenceImageBase64 && referenceImageMimeType
      ? [{ base64: referenceImageBase64 as string, mimeType: referenceImageMimeType as string }]
      : []),
  ]
  const allRefs = [...influencerRefs, ...extraRefs]
  const opts = {
    model,
    style: (influencerAppearance ? 'realistic' : 'professional') as 'realistic' | 'professional',
    ratio: (platform === 'tiktok' ? '9:16' : platform === 'linkedin' ? '1:1' : '4:5') as '9:16' | '1:1' | '4:5',
    referenceImages: allRefs.length ? allRefs : undefined,
    referenceHint: allRefs.length
      ? `${influencerRefs.length ? `The FIRST ${influencerRefs.length} reference image(s) define this exact person — face, hair, skin tone, build ONLY. ` : ''}${extraRefs.length ? 'The remaining image(s) show the EXACT product — preserve packaging, label text, colours, shape, and proportions perfectly; never redesign. ' : ''}Apply the prompt as scene + framing around them.`
      : undefined,
    referenceImageBase64: undefined,
    referenceImageMimeType: undefined,
  }

  // One in-line retry (same pattern as the batch endpoint)
  let result: Awaited<ReturnType<typeof generateNanoBananaImage>> | null = null
  try {
    result = await generateNanoBananaImage(finalPrompt, opts)
  } catch (firstErr) {
    console.warn('[carousel-slide] first attempt failed, retrying in 2s:', firstErr instanceof Error ? firstErr.message : firstErr)
    await new Promise(r => setTimeout(r, 2000))
    try {
      result = await generateNanoBananaImage(finalPrompt, opts)
    } catch (secondErr) {
      console.warn('[carousel-slide] retry also failed:', secondErr instanceof Error ? secondErr.message : secondErr)
      await refundIfNeeded('both attempts failed')
      return NextResponse.json({ error: 'Image provider failed after retry — credits refunded. Try again in a minute.' }, { status: 502 })
    }
  }

  if (!result?.imageBase64) {
    await refundIfNeeded('empty image returned')
    return NextResponse.json({ error: 'Image provider returned no image — credits refunded.' }, { status: 502 })
  }

  // Preserve the slide's text-heavy flag if the client passed it, or detect
  // it fresh from the per-slide illDesc. Client uses it to switch to cover
  // layout when re-rendering the retried slide.
  function detectTextHeavy(s: string): boolean {
    if (!s) return false
    const t = s.toLowerCase()
    return /no objects?|background only|backdrop only|blank canvas|text overlay|for text (?:only|compositing)|text-only|plain (?:dark|light|black|white)\s+(?:background|backdrop)/.test(t)
  }
  const textHeavy = !!slide.textHeavy || detectTextHeavy(perSlideIll)

  return NextResponse.json({
    imageBase64: result.imageBase64,
    mimeType: result.mimeType,
    textHeavy,
    creditsUsed: cost,
  })
}
