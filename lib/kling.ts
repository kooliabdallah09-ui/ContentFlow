import { submitFalKlingJob, getFalKlingStatus } from './fal'
import { submitReplicateKlingJob, getReplicateKlingStatus } from './replicate'

const PIAPI_BASE = 'https://api.piapi.ai'
const FAL_PREFIX = 'fal:'
const REPLICATE_PREFIX = 'replicate:'

// Submit a B-roll job. If startImageUrl is provided, runs Kling in image-to-video mode
// (motion seeded from the first frame) — used for the product close-up B-roll where we want
// the REAL product from a Nano-Banana-generated frame, not Kling's text-to-video imagination.
// Currently only Replicate supports start_image; fal.ai / PiAPI fall back to text-to-video.
export async function submitBrollJob(
  prompt: string,
  startImageUrl?: string,
): Promise<{ taskId: string }> {
  if (process.env.REPLICATE_API_TOKEN) {
    const { predictionId } = await submitReplicateKlingJob(prompt, startImageUrl)
    return { taskId: `${REPLICATE_PREFIX}${predictionId}` }
  }

  if (process.env.FAL_KEY) {
    const { requestId } = await submitFalKlingJob(prompt)
    return { taskId: `${FAL_PREFIX}${requestId}` }
  }

  const apiKey = process.env.PIAPI_API_KEY
  if (!apiKey) throw new Error('No B-roll provider configured (REPLICATE_API_TOKEN, FAL_KEY, or PIAPI_API_KEY)')

  const res = await fetch(`${PIAPI_BASE}/api/v1/task`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'kling',
      task_type: 'video_generation',
      input: {
        prompt,
        negative_prompt: 'text, watermark, blurry, low quality, ugly',
        duration: 5,
        aspect_ratio: '9:16',
        mode: 'std',
        version: '1.6',
      },
      config: { service_mode: 'public' },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Kling B-roll error: ${res.statusText}`)
  }

  const data = await res.json()
  const taskId = data?.data?.task_id
  if (!taskId) throw new Error(`Kling did not return a task ID. Response: ${JSON.stringify(data)}`)

  return { taskId }
}

export async function getBrollStatus(taskId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
}> {
  if (taskId.startsWith(REPLICATE_PREFIX)) {
    return getReplicateKlingStatus(taskId.slice(REPLICATE_PREFIX.length))
  }

  if (taskId.startsWith(FAL_PREFIX)) {
    return getFalKlingStatus(taskId.slice(FAL_PREFIX.length))
  }

  const apiKey = process.env.PIAPI_API_KEY
  if (!apiKey) throw new Error('PIAPI_API_KEY not configured')

  const res = await fetch(`${PIAPI_BASE}/api/v1/task/${taskId}`, {
    headers: { 'x-api-key': apiKey },
  })

  if (!res.ok) throw new Error(`Failed to get Kling status: ${res.statusText}`)

  const data = await res.json()
  const status = data?.data?.status

  return {
    status: status === 'Completed' ? 'completed'
      : status === 'Failed' ? 'failed'
      : status === 'Processing' ? 'processing'
      : 'pending',
    videoUrl: data?.data?.output?.video_url ?? undefined,
  }
}
