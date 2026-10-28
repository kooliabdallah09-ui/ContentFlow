import type { PlanKind } from './planner-cost'

// Runs one planned post through the existing generators. Each generator takes
// its own credits (and refunds on failure), so the planner never charges twice.
// Called from the browser with the user's access token.

export interface PlanProduct {
  name: string
  description: string
  image?: { base64: string; mimeType: string } | null
}

export interface PlanItemInput {
  kind: PlanKind
  format: string
  hook: string
  visual: string
  platform: string
  duration_s?: number | null
  quality?: string | null
  slides?: number | null
}

export interface GenerateOutcome {
  ok: boolean
  result?: Record<string, unknown>
  error?: string
}

async function post(path: string, token: string, body: unknown) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

const friendly = (raw: string) =>
  /vertex|nano banana|billing|403|all image uploads failed/i.test(raw)
    ? 'Image generation is unavailable right now. No credits were charged.'
    : raw.slice(0, 160)

export async function generatePlanItem(
  item: PlanItemInput,
  product: PlanProduct,
  token: string,
  onStage?: (label: string) => void,
): Promise<GenerateOutcome> {
  try {
    if (item.kind === 'video') {
      const draft = item.quality === 'draft'
      const engine = draft ? 'seedance-mini' : 'seedance-2'
      const duration = item.duration_s ?? 15

      onStage?.('Writing the script…')
      const { script } = await post('/api/planner/script', token, {
        productName: product.name, productDescription: product.description,
        hook: item.hook, visual: item.visual, format: item.format, durationSeconds: duration,
      })

      onStage?.('Casting your creator…')
      const frames = await post('/api/ugc/hero-frames', token, {
        productName: product.name, productDescription: product.description,
        productImageBase64: product.image?.base64, productImageMimeType: product.image?.mimeType,
        avatarGender: 'Female', aspectId: 'portrait', script, resolution: '720p', engine,
      })
      const first = (frames.frames ?? [])[0]
      const frameUrl: string | undefined = typeof first === 'string' ? first : first?.url
      if (!frameUrl) throw new Error('No starting frame came back')

      onStage?.('Rendering video…')
      const anim = await post('/api/ugc/animate', token, {
        selectedFrameUrl: frameUrl, script, ugcType: 'image-with-voiceover', duration,
        productName: product.name, productDescription: product.description, benefits: product.description,
        callToAction: 'Shop now', avatarGender: 'Female', language: 'English', aspect: 'portrait',
        productImageBase64: product.image?.base64, productImageMimeType: product.image?.mimeType,
        resolution: '720p', engine,
      })
      return { ok: true, result: { type: 'video', videoUrl: anim?.components?.video?.videoUrl ?? null, script } }
    }

    if (item.kind === 'carousel') {
      onStage?.('Designing the slides…')
      const data = await post('/api/content/generate/carousel', token, {
        topic: `${product.name}: ${item.hook}. ${item.visual}`.slice(0, 400),
        platform: item.platform.toLowerCase().startsWith('tiktok') ? 'tiktok' : 'instagram',
        slideCount: item.slides ?? 5, tone: 'bold',
      })
      return { ok: true, result: { type: 'carousel', id: data.id ?? null, caption: data.caption ?? null } }
    }

    onStage?.('Shooting the photo…')
    const data = await post('/api/content/generate/image', token, {
      prompt: `${item.visual} Product: ${product.name}. ${product.description.slice(0, 300)} Natural, authentic photo for ${item.platform}, no text on the image.`,
      model: 'pro', resolution: '2K', quantity: 1, ratio: '4:5',
    })
    const img = Array.isArray(data.images) ? data.images[0] : null
    return { ok: true, result: { type: 'image', url: typeof img === 'string' ? img : img?.url ?? null } }
  } catch (err) {
    return { ok: false, error: friendly(err instanceof Error ? err.message : 'Failed') }
  }
}
