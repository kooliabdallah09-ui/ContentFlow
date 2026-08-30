const REPLICATE_BASE = 'https://api.replicate.com/v1'

// Video background removal — outputs the input clip with an alpha channel
// (transparent background) so we can composite the talking head over any
// scene. Used by the App Demo Composite renderer.
// arielreplicate/robust_video_matting — RVM model, exposes an `input_video`
// URL and an `output_type` we set to "green-screen" so downstream Shotstack
// can chroma-key it. codeplugtech/background_removal_video was retired.
const VIDEO_BG_REMOVAL_MODEL = 'arielreplicate/robust_video_matting'

// Community models don't reliably expose /models/{owner}/{name}/predictions.
// We resolve the latest version hash first and POST to /v1/predictions, which
// works for every model on Replicate.
async function resolveLatestVersion(model: string, apiKey: string): Promise<string> {
  const res = await fetch(`${REPLICATE_BASE}/models/${model}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Cannot resolve version for ${model} (${res.status}): ${err}`)
  }
  const data = await res.json()
  const versionId = data?.latest_version?.id
  if (!versionId) throw new Error(`No latest_version.id on ${model}. Response: ${JSON.stringify(data).slice(0, 300)}`)
  return versionId
}

export async function submitBackgroundRemovalJob(videoUrl: string): Promise<{ predictionId: string }> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  const version = await resolveLatestVersion(VIDEO_BG_REMOVAL_MODEL, apiKey)

  const res = await fetch(`${REPLICATE_BASE}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'respond-async',
    },
    body: JSON.stringify({
      version,
      input: { input_video: videoUrl, output_type: 'green-screen' },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Background-removal error ${res.status}: ${JSON.stringify(err)}`)
  }
  const data = await res.json()
  const predictionId = data?.id
  if (!predictionId) throw new Error(`Background-removal: no prediction id. Response: ${JSON.stringify(data)}`)
  return { predictionId }
}

export async function getBackgroundRemovalStatus(predictionId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  error?: string
}> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  const res = await fetch(`${REPLICATE_BASE}/predictions/${predictionId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`BG-removal poll error: ${res.statusText}`)

  const data = await res.json()
  const status = data?.status as string | undefined
  if (status === 'succeeded') {
    const output = data?.output
    const videoUrl = Array.isArray(output) ? output[0] : typeof output === 'string' ? output : undefined
    return { status: 'completed', videoUrl }
  }
  if (status === 'failed' || status === 'canceled') {
    return { status: 'failed', error: data?.error ?? 'unknown' }
  }
  if (status === 'processing') return { status: 'processing' }
  return { status: 'pending' }
}

// Text-to-video (no reference image) — used for pure POV scenes.
// Image-to-video (image param) — used when we need product/UI consistency across the clip.
export async function submitSeedanceJob(params: {
  prompt: string
  durationSeconds: number    // Seedance 2.0 supports 3-60 seconds
  aspectRatio?: '9:16' | '16:9' | '1:1' | '3:4'
  startImageUrl?: string
  resolution?: '480p' | '720p' | '1080p' | '4k'
  enableAudio?: boolean       // native voice + ambient + music, default off
  engine?: 'seedance-2' | 'seedance-2-5' | 'seedance-mini'
  // Appearance anchors that are NOT the first frame — Seedance binds them
  // via [Image1]/[Image2] mentions in the prompt. Up to 9 supported.
  referenceImageUrls?: string[]
}): Promise<{ predictionId: string }> {
  // BytePlus is now the only video provider. No Replicate fallback — if
  // BytePlus is misconfigured or down, surface the error rather than
  // silently degrading to a slower/pricier proxy that may not even
  // support the requested engine (Replicate has no 2.5 model).
  if (!process.env.BYTEPLUS_API_KEY) {
    throw new Error('BYTEPLUS_API_KEY not configured')
  }
  const { submitByteplusSeedanceJob } = await import('./byteplus-seedance')
  return await submitByteplusSeedanceJob(params)
}

export async function getSeedanceStatus(predictionId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  error?: string
}> {
  // BytePlus-only polling. Ignore the historical prefix-sniffing that
  // used to route legacy Replicate prediction IDs — we no longer submit
  // any job to Replicate, so any active predictionId is a BytePlus task.
  if (!process.env.BYTEPLUS_API_KEY) {
    throw new Error('BYTEPLUS_API_KEY not configured')
  }
  const { getByteplusSeedanceStatus } = await import('./byteplus-seedance')
  return await getByteplusSeedanceStatus(predictionId)
}

// Sync Labs lipsync-2 — remaps lips on `videoUrl` to match `audioUrl`.
// Used to lip-sync Sora's talking head to the ElevenLabs voice overlay on Hero.
// Returns the URL of the new (synced) video. Polls inline up to ~3 minutes.
const LIPSYNC_MODEL = 'sync/lipsync-2'

export async function runLipsync(videoUrl: string, audioUrl: string): Promise<string> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  const res = await fetch(`${REPLICATE_BASE}/models/${LIPSYNC_MODEL}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'respond-async',
    },
    body: JSON.stringify({
      input: { video: videoUrl, audio: audioUrl },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Replicate lipsync error ${res.status}: ${JSON.stringify(err)}`)
  }

  const prediction = await res.json()
  const predictionId: string | undefined = prediction?.id
  if (!predictionId) throw new Error('Replicate lipsync: no prediction id returned')

  const TIMEOUT_MS = 180_000
  const POLL_MS = 3_000
  const deadline = Date.now() + TIMEOUT_MS

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_MS))
    const poll = await fetch(`${REPLICATE_BASE}/predictions/${predictionId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!poll.ok) throw new Error(`Replicate lipsync poll error: ${poll.statusText}`)
    const data = await poll.json()

    if (data.status === 'succeeded') {
      const url: string | undefined = Array.isArray(data.output) ? data.output[0] : data.output
      if (!url) throw new Error('Replicate lipsync returned no video URL')
      return url
    }
    if (data.status === 'failed' || data.status === 'canceled') {
      throw new Error(`Replicate lipsync ${data.status}: ${data.error ?? 'unknown'}`)
    }
  }
  throw new Error('Replicate lipsync timed out after 180s')
}

