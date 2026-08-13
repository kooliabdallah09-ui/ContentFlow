import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateNanoBananaImage } from '@/lib/nanobanana'

export const maxDuration = 180

function framingText(aspect: string): string {
  if (aspect === '16:9') return 'Horizontal 16:9 widescreen landscape framing'
  if (aspect === '1:1') return 'Square 1:1 framing'
  if (aspect === '4:5') return 'Vertical 4:5 portrait framing'
  if (aspect === '3:4') return 'Vertical 3:4 portrait framing'
  return 'Vertical 9:16 portrait framing'
}

function getVariantPrompts(aspect: string): string[] {
  const fr = framingText(aspect)
  return [
    // Variant 0 — Wide two-shot A (frontal, centred)
    `Two people seated facing camera in a premium podcast studio in mid-conversation. Use image 1 as the EXACT appearance of the LEFT person (host) and image 2 as the EXACT appearance of the RIGHT person (expert) — preserve their faces, hair, and features with pixel-level fidelity.

SETTING: Corner of a professional podcast studio. Cream boucle sofa. Soft directional key light from large diffused studio softboxes, warm neutral colour temperature. Matte neutral gallery wall with abstract framed art behind them. Two RODE mic-arm booms positioned toward each speaker.

FRAME: Medium-wide two-shot, camera centred and level, both people visible from torso up, both in sharp focus. Authentic candid mid-conversation moment — real facial expressions, caught mid-gesture. ${fr}.

REALISM: Photoreal skin, visible pores, natural micro-imperfections, not airbrushed or CGI-smooth. Should read as a still frame paused from a real podcast video recording.`,

    // Variant 1 — Wide two-shot B (slightly off-axis, warmer depth)
    `Two people seated in a premium podcast studio sharing an animated exchange. Use image 1 as the LEFT person (host) and image 2 as the RIGHT person (expert) — preserve both faces exactly.

SETTING: Modern podcast studio. Dark walnut desk between them. Large sound-dampening panels on the walls. Warm tungsten key light from the left, cooler fill from right. Two RODE NT-USB mics on desk stands between the hosts.

FRAME: Medium-wide two-shot, camera placed slightly right of centre, mild rack focus keeping both faces sharp. Both people visible from mid-chest up. One person leaning in animatedly, the other reacting with interest. ${fr}.

REALISM: Photoreal, not airbrushed. Natural pores and micro-expressions. Feels like a real documentary or podcast recording moment.`,

    // Variant 2 — Lateral angle (from the left side)
    `Two people in a premium podcast studio, camera positioned to their LEFT at a 45–50° angle. Use image 1 as the person nearer to camera (host) and image 2 as the person further from camera (expert) — preserve both appearances exactly.

FRAME: Camera to the left side of the sofa, catching both people in partial 3/4 profile. The near person's face is mostly visible; the far person is seen from the side. Gallery wall with framed abstract art behind them, studio softbox light from the far side. Authentic mid-conversation moment. ${fr}.

REALISM: Photoreal skin. Not airbrushed. Candid energy.`,

    // Variant 3 — Lateral angle (from the right side)
    `Two people in a premium podcast studio, camera positioned to their RIGHT at a 45–50° angle. Use image 1 as the person nearer to camera (expert) and image 2 as the person further from camera (host) — preserve both appearances exactly.

FRAME: Camera to the right side of the sofa, catching both people in partial 3/4 profile from the opposite side. The near person's face is mostly visible; the far person is seen from the side. Warm studio lighting from overhead softboxes. Both people in active conversation, one gesturing naturally. ${fr}.

REALISM: Photoreal skin. Not airbrushed. Real candid podcast atmosphere.`,
  ]
}

const VARIANT_LABELS = ['Wide two-shot A', 'Wide two-shot B', 'Lateral angle (left)', 'Lateral angle (right)']

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
    const { hostInfluencerId, expertInfluencerId, productName, aspect, sceneId, refImageBase64, refImageMime } = body as {
      hostInfluencerId?: string
      expertInfluencerId?: string
      productName?: string
      productDescription?: string
      aspect?: '9:16' | '4:5' | '1:1' | '16:9'
      sceneId?: string
      refImageBase64?: string
      refImageMime?: string
    }

    if (!hostInfluencerId || !expertInfluencerId) {
      return NextResponse.json({ error: 'Host + Expert influencers required' }, { status: 400 })
    }
    if (!productName) {
      return NextResponse.json({ error: 'Product name required' }, { status: 400 })
    }

    // Load both influencer rows.
    const { data: infs } = await supabase
      .from('user_influencers')
      .select('id, name, portrait_url, appearance_prompt')
      .in('id', [hostInfluencerId, expertInfluencerId])
      .eq('user_id', userId)

    const byId = new Map((infs ?? []).map(r => [String(r.id), r]))
    const hostRow = byId.get(hostInfluencerId)
    const expertRow = byId.get(expertInfluencerId)
    if (!hostRow || !expertRow) {
      return NextResponse.json({ error: 'Both influencers must exist in your library' }, { status: 404 })
    }

    // Fetch portrait images and convert to base64.
    async function fetchBase64(url: string): Promise<{ base64: string; mimeType: string }> {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to fetch portrait: ${res.status}`)
      const mimeType = res.headers.get('content-type') || 'image/jpeg'
      const base64 = Buffer.from(await res.arrayBuffer()).toString('base64')
      return { base64, mimeType }
    }

    const [hostImg, expertImg] = await Promise.all([
      fetchBase64(hostRow.portrait_url),
      fetchBase64(expertRow.portrait_url),
    ])

    // Load scene if provided.
    let scenePrompt: string | null = null
    let sceneImageBase64: string | null = null
    let sceneImageMime = 'image/jpeg'
    if (sceneId) {
      try {
        const { data: sceneRow } = await supabase
          .from('user_scenes')
          .select('scene_prompt, hero_image_url')
          .eq('id', sceneId)
          .eq('user_id', userId)
          .maybeSingle()
        if (sceneRow) {
          scenePrompt = sceneRow.scene_prompt
          // Fetch + base64 the scene hero image
          const sceneRes = await fetch(sceneRow.hero_image_url)
          if (sceneRes.ok) {
            sceneImageMime = sceneRes.headers.get('content-type') || 'image/jpeg'
            sceneImageBase64 = Buffer.from(await sceneRes.arrayBuffer()).toString('base64')
          }
        }
      } catch { /* best-effort */ }
    }

    // Generate 4 frames in parallel with different composition prompts.
    const referenceImages: Array<{ base64: string; mimeType: string }> = [
      { base64: hostImg.base64, mimeType: hostImg.mimeType },
      { base64: expertImg.base64, mimeType: expertImg.mimeType },
    ]
    if (sceneImageBase64) referenceImages.push({ base64: sceneImageBase64, mimeType: sceneImageMime })
    if (refImageBase64) referenceImages.push({ base64: refImageBase64, mimeType: refImageMime ?? 'image/jpeg' })

    const prompts = getVariantPrompts(aspect ?? '9:16').map(p =>
      scenePrompt ? `${p}\n\nSCENE OVERRIDE — the podcast studio setting MUST match this environment: ${scenePrompt}. Architecture, materials, decor, palette and lighting come from this scene description (and the attached scene reference image if present). Adapt it to fit a premium podcast studio configuration.` : p
    )

    const settled = await Promise.allSettled(
      prompts.map((prompt, i) =>
        generateNanoBananaImage(prompt, {
          raw: true,
          ratio: aspect ?? '9:16',
          referenceImages,
          model: 'pro',
        })
      )
    )

    // Upload successful frames to Supabase storage.
    const stamp = Date.now()
    const frames: Array<{ url: string; variant: number; label: string }> = []

    for (let i = 0; i < settled.length; i++) {
      const result = settled[i]
      if (result.status === 'rejected') {
        console.warn(`[podcast-ad/frames] variant ${i} failed:`, result.reason)
        continue
      }
      const { imageBase64, mimeType } = result.value
      const buf = Buffer.from(imageBase64, 'base64')
      const filename = `podcast-frames/${userId}/${stamp}-${i}.png`
      const { error: upErr } = await supabase.storage
        .from('ugc-assets')
        .upload(filename, buf, { contentType: mimeType.startsWith('image/') ? mimeType : 'image/png', upsert: false })
      if (upErr) {
        console.warn(`[podcast-ad/frames] upload failed for variant ${i}:`, upErr.message)
        continue
      }
      const { data: pub } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
      frames.push({ url: pub.publicUrl, variant: i, label: VARIANT_LABELS[i] })
    }

    return NextResponse.json({ frames })
  } catch (err) {
    console.error('podcast-ad/frames error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Frame generation failed' }, { status: 500 })
  }
}
