const REPLICATE_BASE = 'https://api.replicate.com/v1'
// Kling 1.6 Standard: $0.25 per 5s clip. We tried 2.1 Master ($1.40/clip) thinking it
// was $0.42, but the real cost killed margin on the Standard tier ($4 cost vs $2 sell).
//
// Label fidelity isn't a concern with Kling anymore — Nano Banana 2 produces the high-
// fidelity start frame, and Kling i2v just animates it. The label is locked in the
// reference frame, Kling can't redesign it. So we save ~$2.30/video on B-rolls without
// hurting product accuracy. If motion quality is visibly weak later we can revisit
// 2.1 Standard (around $0.35/clip) as the middle ground.
const KLING_MODEL = 'kwaivgi/kling-v1.6-standard'

// Submit a Kling job. If startImageUrl is provided, runs image-to-video (motion seeded from
// the first frame) — used for character shots (Nano Banana action frame). Otherwise runs
// text-to-video — used for product / lifestyle shots.
export async function submitReplicateKlingJob(
  prompt: string,
  startImageUrl?: string,
): Promise<{ predictionId: string }> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  // Kling 1.6 Standard input schema. cfg_scale controls prompt adherence — 0.5 is
  // the sweet spot for product UGC: respects the prompt but lets the motion feel natural.
  const input: Record<string, unknown> = {
    prompt,
    duration: 5,
    aspect_ratio: '9:16',
    cfg_scale: 0.5,
    negative_prompt: 'text, watermark, blurry, low quality, ugly, distorted face, deformed hands',
  }
  if (startImageUrl) input.start_image = startImageUrl

  const res = await fetch(`${REPLICATE_BASE}/models/${KLING_MODEL}/predictions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Prefer: 'respond-async' },
    body: JSON.stringify({ input }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || err.title || `Replicate Kling error ${res.status}: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  const predictionId = data?.id
  if (!predictionId) throw new Error(`Replicate did not return a prediction id. Response: ${JSON.stringify(data)}`)

  return { predictionId }
}

export async function getReplicateKlingStatus(predictionId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
}> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  const res = await fetch(`${REPLICATE_BASE}/predictions/${predictionId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!res.ok) throw new Error(`Replicate status error: ${res.statusText}`)

  const data = await res.json()
  const status = data?.status as string | undefined

  if (status === 'succeeded') {
    const output = data?.output
    const videoUrl = Array.isArray(output) ? output[0] : typeof output === 'string' ? output : undefined
    return { status: 'completed', videoUrl }
  }
  if (status === 'failed' || status === 'canceled') return { status: 'failed' }
  if (status === 'processing') return { status: 'processing' }
  return { status: 'pending' }
}
