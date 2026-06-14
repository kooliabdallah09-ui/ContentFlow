import { submitFalKlingJob, getFalKlingStatus } from './fal'

const PIAPI_BASE = 'https://api.piapi.ai'
const FAL_PREFIX = 'fal:'

export async function submitBrollJob(prompt: string): Promise<{ taskId: string }> {
  if (process.env.FAL_KEY) {
    const { requestId } = await submitFalKlingJob(prompt)
    return { taskId: `${FAL_PREFIX}${requestId}` }
  }

  const apiKey = process.env.PIAPI_API_KEY
  if (!apiKey) throw new Error('Neither FAL_KEY nor PIAPI_API_KEY configured')

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
