// Direct BytePlus (ByteDance) Seedance 2.0 client — cheaper than Replicate's
// hosted proxy since we pay ByteDance token pricing directly. Same models,
// same output URLs, exposed with the SAME shape as lib/replicate.ts so the
// rest of the code doesn't care which provider we use.
//
// Region: Asia Pacific (Johor) — the only region where Seedance is available
//         today. Dublin only carries Seed-2.0-lite (image understanding, not
//         video). Set BYTEPLUS_REGION=johor to be explicit; anything else
//         falls back to Johor because that's the only working endpoint.
//
// Docs: https://docs.byteplus.com/en/docs/ModelArk/1541523

const REGION_HOSTS: Record<string, string> = {
  johor: 'https://ark.ap-southeast.bytepluses.com',
  dublin: 'https://ark.eu-west-1.bytepluses.com',
}

// Model IDs are versioned by ByteDance and pinned so a silent server-side
// upgrade doesn't break us. Update here when a new pinned version is released.
const MODEL_IDS = {
  'seedance-2':    'dreamina-seedance-2-0-260128',
  'seedance-2-5':  'dreamina-seedance-2-5-260628',
  'seedance-mini': 'dreamina-seedance-2-0-mini-260128',
} as const

type Engine = keyof typeof MODEL_IDS

function baseUrl(): string {
  const region = (process.env.BYTEPLUS_REGION || 'johor').toLowerCase()
  return REGION_HOSTS[region] ?? REGION_HOSTS.johor
}

function apiKey(): string {
  const key = process.env.BYTEPLUS_API_KEY
  if (!key) throw new Error('BYTEPLUS_API_KEY not configured')
  return key
}

// Same return shape as lib/replicate.ts submitSeedanceJob so callers stay
// interchangeable. BytePlus calls the ID a "task_id" instead of a
// "prediction_id" — we surface it as predictionId for API parity.
export async function submitByteplusSeedanceJob(params: {
  prompt: string
  durationSeconds: number
  aspectRatio?: '9:16' | '16:9' | '1:1' | '3:4'
  startImageUrl?: string
  resolution?: '480p' | '720p' | '1080p' | '4k'
  enableAudio?: boolean
  engine?: Engine
  referenceImageUrls?: string[]
  watermark?: boolean
}): Promise<{ predictionId: string }> {
  const engine: Engine =
    params.engine === 'seedance-mini' ? 'seedance-mini'
    : params.engine === 'seedance-2-5' ? 'seedance-2-5'
    : 'seedance-2'
  const model = MODEL_IDS[engine]
  const duration = Math.max(3, Math.min(60, Math.round(params.durationSeconds)))
  const ratio = params.aspectRatio ?? '9:16'

  // Build content parts — order matters. Text comes first, then any images,
  // then any reference videos, then audio.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [{ type: 'text', text: params.prompt }]

  if (params.startImageUrl) {
    content.push({
      type: 'image_url',
      image_url: { url: params.startImageUrl },
      role: 'first_frame',
    })
  }
  for (const url of (params.referenceImageUrls ?? []).slice(0, 9)) {
    content.push({
      type: 'image_url',
      image_url: { url },
      role: 'reference_image',
    })
  }

  const body = {
    model,
    content,
    generate_audio: !!params.enableAudio,
    ratio,
    duration,
    watermark: params.watermark ?? false,
  }

  const res = await fetch(`${baseUrl()}/api/v3/contents/generations/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`BytePlus Seedance error ${res.status}: ${errText.slice(0, 500)}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any
  const taskId: string | undefined = data?.id ?? data?.task_id ?? data?.data?.id
  if (!taskId) throw new Error(`BytePlus Seedance: no task id in response. Got: ${JSON.stringify(data).slice(0, 500)}`)
  return { predictionId: taskId }
}

// Poll a BytePlus task. Same return shape as getSeedanceStatus in
// lib/replicate.ts so downstream polling code stays the same.
export async function getByteplusSeedanceStatus(taskId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  error?: string
}> {
  const res = await fetch(`${baseUrl()}/api/v3/contents/generations/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`BytePlus Seedance poll ${res.status}: ${errText.slice(0, 200)}`)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any
  const status: string | undefined = data?.status ?? data?.data?.status

  // BytePlus statuses: queued, running, succeeded, failed, cancelled
  if (status === 'succeeded') {
    const videoUrl: string | undefined =
      data?.content?.video_url ?? data?.data?.content?.video_url ?? data?.data?.video_url ?? data?.video_url
    if (!videoUrl) return { status: 'failed', error: 'succeeded but no video_url in response' }
    return { status: 'completed', videoUrl }
  }
  if (status === 'failed' || status === 'cancelled') {
    return { status: 'failed', error: data?.error?.message ?? data?.data?.error?.message ?? 'unknown' }
  }
  if (status === 'running') return { status: 'processing' }
  return { status: 'pending' }
}

export function isByteplusEnabled(): boolean {
  return !!process.env.BYTEPLUS_API_KEY
}
