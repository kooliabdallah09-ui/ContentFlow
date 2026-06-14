const FAL_QUEUE_BASE = 'https://queue.fal.run'
const KLING_MODEL_ID = 'fal-ai/kling-video/v2.1/standard/text-to-video'

export async function submitFalKlingJob(prompt: string): Promise<{ requestId: string }> {
  const apiKey = process.env.FAL_KEY
  if (!apiKey) throw new Error('FAL_KEY not configured')

  const res = await fetch(`${FAL_QUEUE_BASE}/${KLING_MODEL_ID}`, {
    method: 'POST',
    headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      duration: '5',
      aspect_ratio: '9:16',
      negative_prompt: 'text, watermark, blurry, low quality, ugly, distorted face',
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `fal.ai Kling error ${res.status}: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  const requestId = data?.request_id
  if (!requestId) throw new Error(`fal.ai did not return a request_id. Response: ${JSON.stringify(data)}`)

  return { requestId }
}

export async function getFalKlingStatus(requestId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
}> {
  const apiKey = process.env.FAL_KEY
  if (!apiKey) throw new Error('FAL_KEY not configured')

  const statusRes = await fetch(`${FAL_QUEUE_BASE}/${KLING_MODEL_ID}/requests/${requestId}/status`, {
    headers: { Authorization: `Key ${apiKey}` },
  })

  if (!statusRes.ok) throw new Error(`fal.ai status error: ${statusRes.statusText}`)

  const statusData = await statusRes.json()
  const falStatus = statusData?.status as string | undefined

  if (falStatus === 'COMPLETED') {
    const resultRes = await fetch(`${FAL_QUEUE_BASE}/${KLING_MODEL_ID}/requests/${requestId}`, {
      headers: { Authorization: `Key ${apiKey}` },
    })
    if (!resultRes.ok) return { status: 'completed' }
    const result = await resultRes.json()
    return { status: 'completed', videoUrl: result?.video?.url ?? result?.url ?? undefined }
  }

  if (falStatus === 'IN_PROGRESS') return { status: 'processing' }
  if (falStatus === 'IN_QUEUE') return { status: 'pending' }
  return { status: 'failed' }
}
