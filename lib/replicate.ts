const REPLICATE_BASE = 'https://api.replicate.com/v1'
// v3 is ElevenLabs' most expressive model — supports a `speed` parameter (0.7-1.2),
// 70+ languages, and inline audio tags like [excited] / [whispers]. Costs more
// than turbo-v2.5 but gives full speech-rate control.
const ELEVENLABS_TTS_MODEL = 'elevenlabs/v3'
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

// Submit an ElevenLabs TTS job via Replicate, poll to completion, and return
// the audio as a Buffer. Uses elevenlabs/turbo-v2.5 — high quality, 32 languages,
// low latency. Voice IDs are the same ElevenLabs IDs used by the direct API.
export async function generateElevenLabsViaReplicate(
  text: string,
  voiceId: string,
  options: { speed?: number } = {},
): Promise<Buffer> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  // v3 input. `speed` is clamped to ElevenLabs' allowed range (0.7-1.2);
  // 1.0 is natural pace.
  const speed = Math.min(1.2, Math.max(0.7, options.speed ?? 1.0))

  const res = await fetch(`${REPLICATE_BASE}/models/${ELEVENLABS_TTS_MODEL}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'respond-async',
    },
    body: JSON.stringify({
      input: {
        prompt: text,
        voice: voiceId,
        speed,
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.35,
        use_speaker_boost: true,
        output_format: 'mp3_44100_128',
      },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Replicate ElevenLabs TTS error ${res.status}: ${JSON.stringify(err)}`)
  }

  const prediction = await res.json()
  const predictionId: string | undefined = prediction?.id
  if (!predictionId) throw new Error('Replicate ElevenLabs TTS: no prediction id returned')

  const TIMEOUT_MS = 90_000
  const POLL_MS = 2_000
  const deadline = Date.now() + TIMEOUT_MS

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_MS))
    const poll = await fetch(`${REPLICATE_BASE}/predictions/${predictionId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!poll.ok) throw new Error(`Replicate TTS poll error: ${poll.statusText}`)
    const data = await poll.json()

    if (data.status === 'succeeded') {
      const audioUrl: string | undefined = Array.isArray(data.output) ? data.output[0] : data.output
      if (!audioUrl) throw new Error('Replicate ElevenLabs TTS returned no audio URL')
      const audioRes = await fetch(audioUrl)
      if (!audioRes.ok) throw new Error(`Failed to fetch TTS audio from Replicate: ${audioRes.status}`)
      return Buffer.from(await audioRes.arrayBuffer())
    }
    if (data.status === 'failed' || data.status === 'canceled') {
      throw new Error(`Replicate ElevenLabs TTS prediction ${data.status}: ${data.error ?? 'unknown'}`)
    }
  }
  throw new Error('Replicate ElevenLabs TTS timed out after 90s')
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
