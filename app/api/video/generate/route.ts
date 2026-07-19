import { deductCredits } from '@/lib/deduct-credits'
import { submitSeedanceJob } from '@/lib/replicate'
import { generateTextToImage } from '@/lib/nanobanana'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import sharp from 'sharp'

export const maxDuration = 120

// Seedance-only now; keep an empty flat-cost object so the resolver falls
// through cleanly for any future non-Seedance model.
const FLAT_COSTS: Record<string, Record<number, number>> = {}

// Seedance 2.0 non_video_in pricing per second, in credits (1.8× markup on
// Replicate's raw cost). Must stay in lockstep with SEEDANCE_CR_PER_SECOND
// on the client.
const SEEDANCE_CR_PER_SECOND: Record<string, number> = {
  '480p': 6,     // $0.08/s
  '720p': 13,    // $0.18/s
  '1080p': 33,   // $0.45/s
  '4k':    72,   // $1.00/s
}
// Seedance 2.0 Mini — about half price, caps at 720p.
const SEEDANCE_MINI_CR_PER_SECOND: Record<string, number> = {
  '480p': 3,     // $0.04/s
  '720p': 7,     // $0.09/s
}
// Silent renders skip audio synthesis compute — we pass 15% back to the
// user. Keep this in sync with NO_AUDIO_MULTIPLIER on the client.
const NO_AUDIO_MULTIPLIER = 0.85

function getCost(model: string, duration: number, resolution?: string, withAudio: boolean = true): number {
  if (model === 'seedance-2' || model === 'seedance-mini') {
    const table = model === 'seedance-mini' ? SEEDANCE_MINI_CR_PER_SECOND : SEEDANCE_CR_PER_SECOND
    const res = model === 'seedance-mini' && resolution !== '480p' ? '720p' : (resolution ?? '720p')
    const per = table[res] ?? table['720p']
    const base = duration * per
    return Math.max(1, Math.ceil(withAudio ? base : base * NO_AUDIO_MULTIPLIER))
  }
  return FLAT_COSTS[model]?.[duration] ?? 60
}

// Sora reference image dimensions must match the selected aspect ratio
function soraImageSize(aspectRatio: '9:16' | '1:1' | '16:9'): [number, number] {
  if (aspectRatio === '16:9') return [1280, 720]
  return [720, 1280] // portrait and square both 720x1280
}

// Composite multiple images into a single reference image.
// Layout: 1 image → full canvas; 2 → side by side; 3 → 2 top + 1 bottom centered; 4 → 2×2 grid.
async function compositeReferenceImages(
  images: Array<{ base64: string; mimeType: string }>,
  canvasW: number,
  canvasH: number,
): Promise<Buffer> {
  const n = images.length
  if (n === 0) throw new Error('No images to composite')

  // Determine tile grid dimensions
  const cols = n <= 1 ? 1 : n <= 2 ? 2 : n <= 3 ? 2 : 2
  const rows = n <= 1 ? 1 : n <= 2 ? 1 : n <= 3 ? 2 : 2
  const tileW = Math.floor(canvasW / cols)
  const tileH = Math.floor(canvasH / rows)

  // Resize each image to its tile slot
  const resized = await Promise.all(
    images.map(img =>
      sharp(Buffer.from(img.base64, 'base64'))
        .resize(tileW, tileH, { fit: 'cover', position: 'center' })
        .png()
        .toBuffer()
    )
  )

  // Calculate positions: 3-image layout centers the last image in bottom row
  const positions = resized.map((_, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    let left = col * tileW
    // Center lone tile in last row for 3-image layout
    if (n === 3 && i === 2) left = Math.floor((canvasW - tileW) / 2)
    return { input: resized[i], left, top: row * tileH }
  })

  return sharp({
    create: { width: canvasW, height: canvasH, channels: 3, background: '#000000' },
  })
    .composite(positions)
    .png()
    .toBuffer()
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.slice(7))
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = userData.user.id

    const body = await request.json()
    let prompt = typeof body.prompt === 'string' ? body.prompt.slice(0, 4000).trim() : ''
    const hyperMotion = body.mode === 'hypermotion'
    if (!prompt && !hyperMotion) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })

    // Seedance 2.0 (default) or Seedance Mini (~half price, 720p cap).
    const model: 'seedance-2' | 'seedance-mini' = body.model === 'seedance-mini' ? 'seedance-mini' : 'seedance-2'
    const duration = Number(body.duration ?? 5)
    let resolution: '480p' | '720p' | '1080p' | '4k' =
      body.resolution === '480p' || body.resolution === '1080p' || body.resolution === '4k'
        ? body.resolution
        : '720p'
    if (model === 'seedance-mini' && (resolution === '1080p' || resolution === '4k')) resolution = '720p'
    const withAudio: boolean = body.withAudio !== false  // default true
    if (model === 'seedance-2' || model === 'seedance-mini') {
      if (!Number.isFinite(duration) || duration < 3 || duration > 60) {
        return NextResponse.json({ error: 'Seedance duration must be between 3 and 60 seconds' }, { status: 400 })
      }
    } else {
      const allowedDurations = Object.keys(FLAT_COSTS[model] ?? {}).map(Number)
      if (!allowedDurations.includes(duration)) {
        return NextResponse.json({ error: `Invalid duration for ${model}` }, { status: 400 })
      }
    }

    // aspect: portrait=9:16, square=1:1, landscape=16:9
    const aspectRaw = body.aspect as string | undefined
    const aspectRatio: '9:16' | '1:1' | '16:9' =
      aspectRaw === 'landscape' ? '16:9' : aspectRaw === 'square' ? '1:1' : '9:16'

    // Accept either new multi-image array or legacy single-image fields
    const referenceImages: Array<{ base64: string; mimeType: string }> = Array.isArray(body.referenceImages)
      ? body.referenceImages.filter((img: { base64?: unknown; mimeType?: unknown }) => typeof img.base64 === 'string' && typeof img.mimeType === 'string').slice(0, 4)
      : (typeof body.referenceImageBase64 === 'string' ? [{ base64: body.referenceImageBase64, mimeType: body.referenceImageMimeType ?? 'image/jpeg' }] : [])
    const refImageBase64 = referenceImages[0]?.base64
    const refImageMimeType = referenceImages[0]?.mimeType

    // ── HyperMotion: pure-CGI product commercial. The user only supplies a
    // product photo (+ optional vibe note) — Sonnet studies the product and
    // writes the full physics-driven, no-humans, no-voiceover Seedance
    // prompt (Apple-reveal style camera choreography). ──
    if (hyperMotion) {
      if (!refImageBase64 || !refImageMimeType) {
        return NextResponse.json({ error: 'HyperMotion needs a product photo' }, { status: 400 })
      }
      const hyperNote = typeof body.hyperNote === 'string' ? body.hyperNote.slice(0, 400).trim() : ''
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const HYPER_SYSTEM = `You are a world-class CGI commercial director and Seedance 2.0 prompt engineer. You create Apple-reveal-style product films: pure CGI, the physical product is the ONLY hero.

Study the attached product photo carefully — packaging, materials, label text, colours, proportions — and write ONE polished, timestamped Seedance 2.0 prompt for a premium product commercial.

HARD RULES:
- NO humans, NO hands, NO faces, NO voiceover, NO dialogue, NO on-screen text, NO captions, NO logos other than what is printed on the product itself.
- PRODUCT FIDELITY IS SACRED: the product appears EXACTLY as photographed — same print, same label colours, same materials. NEVER invent gold/metallic embellishments, glow-up the logo, change the typography, or restyle the design in any way. If the print is flat black ink, it stays flat black ink.
- Physics-driven VFX around the product: floating assembly/disassembly, particle bursts, liquid splashes, powder plumes, fabric ribbons, cloth simulation, slow-motion shatter/merge — pick what fits THIS product's category and keep the physics plausible (real weight, real drag).
- ENVIRONMENT: design a SPECIFIC set that fits the product's world — NOT the generic 'black void + single spotlight' cliché. Options: sun-bleached concrete plaza with harsh noon shadows, terracotta canyon at dusk, flooded marble hall with ankle-deep reflective water, monochrome color-drenched studio matched to the brand palette, brutalist stone plinths in fog, wind-swept dunes, glass pavilion in rain. Choose ONE coherent world and commit to it across all scenes.
- COLOR & GRADE: name a deliberate cinematic grade in the prompt (e.g. 'warm Kodak-film grade with lifted blacks', 'cool steel-blue with amber accents', 'high-key cream and sand palette') that flatters the product's colours. Rich contrast, deep but detailed shadows, highlight rolloff — never flat, never washed out.
- MATERIALS & LIGHT: describe how light interacts with real materials — cotton weave catching rim light, condensation micro-droplets, dust motes in volumetric beams, soft key + hard kicker. Fabric must read as real cloth with weight and weave, never plastic or CGI-smooth.
- Cinematic camera choreography that never sits still: macro slide along the print, sweeping orbital, whip-to-lock hero framing, push-in on the reveal, speed-ramps. Every scene names its shot type and camera move.
- Sound: ambient whooshes, deep sub-bass hits, tactile foley synced to the physics — no music with vocals, no narration.
- Timestamped scene blocks (SCENE N [MM:SS – MM:SS], Visual: …). Scene count by duration: <=5s 1 · 6-10s 2 · 11-20s 3 · 21-40s 4-5 · 41-60s 5-7. Final scene ends EXACTLY at the target duration with a locked hero shot of the product.
- Stay under 3400 characters. Output ONLY the finished prompt.`
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: HYPER_SYSTEM,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: refImageMimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
                data: refImageBase64,
              },
            },
            {
              type: 'text',
              text: `TARGET DURATION: exactly ${Number(body.duration ?? 5)} seconds. ASPECT: ${body.aspect === 'landscape' ? '16:9' : body.aspect === 'square' ? '1:1' : '9:16 vertical'}.${hyperNote ? `\nCreative direction from the user (honor it): ${hyperNote}` : ''}\n\nDirect the commercial now.`,
            },
          ],
        }],
      })
      prompt = (msg.content[0] as { type: 'text'; text: string }).text.trim().slice(0, 3600)
      if (!prompt) return NextResponse.json({ error: 'HyperMotion direction failed — try again' }, { status: 500 })
      console.log('[video/generate] hypermotion prompt chars=', prompt.length)
    }

    const totalCost = getCost(model, duration, resolution, withAudio)
    const { data: userCredits } = await supabase
      .from('user_credits')
      .select('balance, pack_credits')
      .eq('user_id', userId)
      .single()

    if (!userCredits || userCredits.balance < totalCost) {
      return NextResponse.json(
        { error: `Insufficient credits. Need ${totalCost}, have ${userCredits?.balance ?? 0}` },
        { status: 400 },
      )
    }

    // Seedance 2.0 — image-to-video. If a reference image is provided we
    // upload it and use image-to-video mode; else falls back to text-to-video.
    // (Kling v3 branch removed — Seedance handles every model now.)
    void model
    let startImageUrl: string | undefined
    // Director mode passes an already-hosted storyboard keyframe as the
    // start frame. Whitelisted to our own storage so this can't point
    // Seedance at arbitrary URLs.
    if (typeof body.startImageUrl === 'string'
        && body.startImageUrl.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/`)) {
      startImageUrl = body.startImageUrl
    } else if (refImageBase64 && refImageMimeType) {
      // Preserve the reference's own aspect — force-covering to 9:16 was
      // center-cropping product photos (chopped sleeves) and upscaling
      // small images into blur, and that broken frame anchored the whole
      // render. Cap the long edge, never enlarge, never crop; Seedance
      // reconciles the start frame with the requested aspect itself.
      const buf = await sharp(Buffer.from(refImageBase64, 'base64'))
        .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer()
      const filename = `video-ref/${userId}-${Date.now()}.png`
      await supabase.storage.from('ugc-assets').upload(filename, buf, { contentType: 'image/png', upsert: false })
      const { data: { publicUrl } } = supabase.storage.from('ugc-assets').getPublicUrl(filename)
      startImageUrl = publicUrl
    }
    const seedanceJob = await submitSeedanceJob({
      prompt,
      durationSeconds: duration,
      aspectRatio,
      startImageUrl,
      resolution,
      enableAudio: withAudio,
      engine: model,
    })
    const predictionId = seedanceJob.predictionId
    const provider = 'seedance-2'

    // Save to library as processing, deduct credits
    const { data: contentRow } = await supabase.from('ugc_content').insert({
      user_id: userId,
      content_type: 'video',
      external_id: predictionId,
      storage_url: JSON.stringify({ video: { videoId: predictionId, status: 'processing', provider } }),
      metadata: { prompt: prompt.slice(0, 200), provider, duration, generatedAt: new Date().toISOString() },
      credit_cost: totalCost,
      status: 'processing',
    }).select('id').single()

    const { newBalance } = await deductCredits(supabase, userId, totalCost, userCredits.balance, userCredits.pack_credits)
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: totalCost,
      transaction_type: 'generation',
      content_type: 'video',
      description: `Video (${provider}) · ${duration}s · ${prompt.slice(0, 60)}`,
    })

    return NextResponse.json({
      success: true,
      predictionId,
      provider,
      duration,
      contentId: contentRow?.id ?? null,
      creditDeducted: totalCost,
      newBalance,
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Video generation failed' },
      { status: 500 },
    )
  }
}
