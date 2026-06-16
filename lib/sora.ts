// Sora 2 (OpenAI) — image-to-video with native audio generation.
// API shape was verified end-to-end via scripts/test-sora.mjs (commits b340868 onward):
//   • input_reference must be an OBJECT: { image_url: "<url or data url>" }
//   • seconds is a STRING from the set ['4', '8', '12'] — base sora-2's only allowed values
//   • size is a string like '720x1280' (must EXACTLY match reference image dimensions)
//   • Completion response does NOT include a video URL; bytes come from /v1/videos/{id}/content
//
// Base sora-2 generates native audio. sora-2-pro is silent for our use case (skip it).

const OPENAI_BASE = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'sora-2'

export type SoraSeconds = 4 | 8 | 12
const VALID_SECONDS: SoraSeconds[] = [4, 8, 12]

export interface SoraSubmitInput {
  prompt: string                  // Full Sora prompt (camera → subject → action → ... → audio)
  referenceImageUrl: string       // Public URL or data URL of the Nano Banana hero frame.
                                  // Dimensions MUST match `size` exactly — resize before calling.
  durationSeconds: SoraSeconds    // 4, 8, or 12
  size?: string                   // 'WIDTHxHEIGHT', default '720x1280' (9:16 portrait)
  model?: string                  // default 'sora-2' — do not use 'sora-2-pro' (silent)
}

export async function submitSoraJob(input: SoraSubmitInput): Promise<{ videoId: string }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')
  if (!VALID_SECONDS.includes(input.durationSeconds)) {
    throw new Error(`Sora 2 seconds must be one of ${VALID_SECONDS.join(', ')} — got ${input.durationSeconds}`)
  }

  const res = await fetch(`${OPENAI_BASE}/videos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: input.model ?? DEFAULT_MODEL,
      prompt: input.prompt,
      input_reference: { image_url: input.referenceImageUrl },
      seconds: String(input.durationSeconds),
      size: input.size ?? '720x1280',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sora submit error ${res.status}: ${err.slice(0, 400)}`)
  }

  const data = await res.json()
  const videoId = data?.id
  if (!videoId) throw new Error(`Sora did not return a video id. Response: ${JSON.stringify(data).slice(0, 300)}`)
  return { videoId }
}

export async function getSoraStatus(videoId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
}> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const res = await fetch(`${OPENAI_BASE}/videos/${videoId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`Sora status error: ${res.statusText}`)

  const data = await res.json()
  const status = data?.status as string | undefined

  if (status === 'completed' || status === 'succeeded') return { status: 'completed' }
  if (status === 'failed' || status === 'error') return { status: 'failed' }
  if (status === 'in_progress' || status === 'processing') return { status: 'processing' }
  return { status: 'pending' }
}

// Download the rendered MP4 bytes. OpenAI requires the API key as auth, so the raw URL is
// not publicly accessible — the caller must rehost (e.g. upload to Supabase) before passing
// to Creatomate or returning to the client.
export async function downloadSoraVideo(videoId: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const res = await fetch(`${OPENAI_BASE}/videos/${videoId}/content`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sora download error ${res.status}: ${err.slice(0, 300)}`)
  }
  return Buffer.from(await res.arrayBuffer())
}
