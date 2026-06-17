const REPLICATE_BASE = 'https://api.replicate.com/v1'
// Kling 2.1 Master: sharper detail, better hand-product interaction, accurate label text.
// ~$0.42 per 5s clip vs ~$0.25 for v1.6 standard. Worth it for product UGC where label
// fidelity and natural motion sell the ad.
const KLING_MODEL = 'kwaivgi/kling-v2.1-master'

// Submit a Kling job. If startImageUrl is provided, runs image-to-video (motion seeded from
// the first frame) — used for character shots (Nano Banana action frame). Otherwise runs
// text-to-video — used for product / lifestyle shots.
export async function submitReplicateKlingJob(
  prompt: string,
  startImageUrl?: string,
): Promise<{ predictionId: string }> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  // Kling 2.1 Master input schema. cfg_scale was a v1.6 knob — 2.1 master uses
  // a different sampling pipeline and the field is ignored / rejected. Dropping it.
  const input: Record<string, unknown> = {
    prompt,
    duration: 5,
    aspect_ratio: '9:16',
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
