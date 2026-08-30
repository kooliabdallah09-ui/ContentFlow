// fal.ai clients. Currently one endpoint — Bria video background removal
// for the App Demo Composite format. Replaces the previous Replicate
// (arielreplicate/robust_video_matting) implementation.
//
// Docs: https://fal.ai/models/fal-ai/bria/video/background-removal/api

const FAL_QUEUE_BASE = 'https://queue.fal.run'
const BRIA_BG_MODEL_ID = 'fal-ai/bria/video/background-removal'

// Submit a video for background removal. Async on fal.ai's queue —
// returns a request_id you poll until COMPLETED.
export async function submitFalBackgroundRemovalJob(
  videoUrl: string,
): Promise<{ requestId: string }> {
  const apiKey = process.env.FAL_KEY
  if (!apiKey) throw new Error('FAL_KEY not configured')

  const res = await fetch(`${FAL_QUEUE_BASE}/${BRIA_BG_MODEL_ID}`, {
    method: 'POST',
    headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_url: videoUrl }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`fal.ai Bria bg-removal error ${res.status}: ${JSON.stringify(err).slice(0, 300)}`)
  }
  const data = await res.json()
  const requestId = data?.request_id
  if (!requestId) throw new Error(`fal.ai Bria bg-removal: no request_id. Response: ${JSON.stringify(data).slice(0, 200)}`)
  return { requestId }
}

// Poll a submitted job. When COMPLETED, fetches the full result to pull
// the output video URL. fal.ai returns a video with a transparent
// background (alpha channel) that Shotstack composites over any layer.
export async function getFalBackgroundRemovalStatus(requestId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  error?: string
}> {
  const apiKey = process.env.FAL_KEY
  if (!apiKey) throw new Error('FAL_KEY not configured')

  const statusRes = await fetch(
    `${FAL_QUEUE_BASE}/${BRIA_BG_MODEL_ID}/requests/${requestId}/status`,
    { headers: { Authorization: `Key ${apiKey}` } },
  )
  if (!statusRes.ok) throw new Error(`fal.ai status error: ${statusRes.statusText}`)
  const statusData = await statusRes.json()
  const falStatus = statusData?.status as string | undefined

  if (falStatus === 'COMPLETED') {
    const resultRes = await fetch(
      `${FAL_QUEUE_BASE}/${BRIA_BG_MODEL_ID}/requests/${requestId}`,
      { headers: { Authorization: `Key ${apiKey}` } },
    )
    if (!resultRes.ok) return { status: 'completed' }
    const result = await resultRes.json()
    const videoUrl: string | undefined = result?.video?.url ?? result?.output?.video?.url ?? result?.url
    if (!videoUrl) return { status: 'failed', error: 'fal.ai completed but returned no video URL' }
    return { status: 'completed', videoUrl }
  }

  if (falStatus === 'IN_PROGRESS') return { status: 'processing' }
  if (falStatus === 'IN_QUEUE') return { status: 'pending' }
  return { status: 'failed', error: `Unexpected fal.ai status: ${falStatus ?? 'null'}` }
}
