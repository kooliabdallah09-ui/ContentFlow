// Sora 2 (OpenAI) — image-to-video with native audio generation.
// Used as the A-roll talking-head provider for Premium and Hero tiers.
// API pattern matches HeyGen / Kling / Replicate: submit returns a job id immediately,
// client polls /video-status for completion. No background worker needed.

const OPENAI_BASE = 'https://api.openai.com/v1'
const SORA_MODEL = 'sora-2'

export interface SoraSubmitInput {
  prompt: string                  // Full Sora prompt (camera → subject → action → ... → audio)
  referenceImageUrl: string       // Public URL of the Nano Banana character+product hero frame
  durationSeconds: 5 | 10 | 15 | 20
  aspectRatio?: '9:16' | '16:9' | '1:1'
}

export async function submitSoraJob(input: SoraSubmitInput): Promise<{ videoId: string }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const res = await fetch(`${OPENAI_BASE}/videos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: SORA_MODEL,
      prompt: input.prompt,
      input_reference: input.referenceImageUrl,
      seconds: input.durationSeconds,
      size: input.aspectRatio === '16:9' ? '1920x1080' : input.aspectRatio === '1:1' ? '1080x1080' : '1080x1920',
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Sora submit error ${res.status}: ${JSON.stringify(err).slice(0, 300)}`)
  }

  const data = await res.json()
  const videoId = data?.id
  if (!videoId) throw new Error(`Sora did not return a video id. Response: ${JSON.stringify(data).slice(0, 300)}`)
  return { videoId }
}

export async function getSoraStatus(videoId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  duration?: number
}> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const res = await fetch(`${OPENAI_BASE}/videos/${videoId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`Sora status error: ${res.statusText}`)

  const data = await res.json()
  const status = data?.status as string | undefined

  if (status === 'completed') {
    // OpenAI's video API returns a downloadable asset URL on completion
    const videoUrl = data?.output?.[0]?.url ?? data?.url ?? data?.video_url
    return { status: 'completed', videoUrl, duration: data?.seconds }
  }
  if (status === 'failed') return { status: 'failed' }
  if (status === 'in_progress' || status === 'processing') return { status: 'processing' }
  return { status: 'pending' }
}
