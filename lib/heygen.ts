const HEYGEN_API_BASE = 'https://api.heygen.com'

export const HEYGEN_VOICES = [
  { id: '1bd001e7e50f421d891986aad5158bc8', name: 'Sofia', accent: 'American Female' },
  { id: '2d5b0e6cf36f460aa7fc47e3eee4ba54', name: 'James', accent: 'American Male' },
  { id: 'e749e866b30d47e4858cac12a6d13f2f', name: 'Emma', accent: 'British Female' },
  { id: '1588bf4c1db74e1dbba1c7b2e9f54b14', name: 'Oliver', accent: 'British Male' },
]

export const DEFAULT_VOICE_ID = HEYGEN_VOICES[0].id

// Submit a video generation job — returns video_id immediately (async, not the final URL)
export async function submitVideoJob(
  script: string,
  avatarId: string,
  voiceId: string = DEFAULT_VOICE_ID,
  backgroundImageUrl?: string,
): Promise<{ videoId: string }> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) throw new Error('HeyGen API key not configured')
  if (!script?.trim()) throw new Error('Script cannot be empty')
  if (script.length > 3000) throw new Error('Script exceeds maximum length of 3000 characters')

  const background = backgroundImageUrl
    ? { type: 'image', url: backgroundImageUrl }
    : { type: 'color', value: '#F2EDE8' } // warm off-white — better than stark white

  const res = await fetch(`${HEYGEN_API_BASE}/v2/video/generate`, {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_inputs: [
        {
          character: { type: 'avatar', avatar_id: avatarId, avatar_style: 'normal' },
          voice: { type: 'text', input_text: script, voice_id: voiceId },
          background,
        },
      ],
      dimension: { width: 1080, height: 1920 },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || err.error?.message || `HeyGen error: ${res.statusText}`)
  }

  const data = await res.json()
  const videoId = data?.data?.video_id
  if (!videoId) throw new Error('HeyGen did not return a video ID')

  return { videoId }
}

// Poll video status — supports both /v3/videos (new) and /v1/video_status.get (legacy)
export async function getVideoStatus(videoId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  duration?: number
}> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) throw new Error('HeyGen API key not configured')

  // Try v3 first
  const v3Res = await fetch(`${HEYGEN_API_BASE}/v3/videos/${videoId}`, {
    headers: { 'X-Api-Key': apiKey },
  })

  if (v3Res.ok) {
    const data = await v3Res.json()
    const status = data?.data?.status ?? data?.status
    return {
      status: status === 'completed' ? 'completed'
        : status === 'failed' ? 'failed'
        : status === 'processing' ? 'processing'
        : 'pending',
      videoUrl: data?.data?.video_url ?? data?.video_url ?? undefined,
      duration: data?.data?.duration ?? undefined,
    }
  }

  // Fallback to v1 for legacy avatar videos
  const res = await fetch(`${HEYGEN_API_BASE}/v1/video_status.get?video_id=${videoId}`, {
    headers: { 'X-Api-Key': apiKey },
  })

  if (!res.ok) throw new Error(`Failed to get video status: ${res.statusText}`)

  const data = await res.json()
  const status = data?.data?.status

  return {
    status: status === 'completed' ? 'completed'
      : status === 'failed' ? 'failed'
      : status === 'processing' ? 'processing'
      : 'pending',
    videoUrl: data?.data?.video_url ?? undefined,
    duration: data?.data?.duration ?? undefined,
  }
}

export function estimateDuration(script: string): number {
  return Math.ceil((script.split(/\s+/).length / 150) * 60)
}

// Submit a video job using a static image — animates the image directly via /v3/videos
export async function submitImageToVideoJob(
  script: string,
  imageUrl: string,
  voiceId: string = DEFAULT_VOICE_ID,
  audioUrl?: string,
): Promise<{ videoId: string }> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) throw new Error('HeyGen API key not configured')
  if (!script?.trim()) throw new Error('Script cannot be empty')

  const body: Record<string, unknown> = {
    type: 'image',
    image: { type: 'url', url: imageUrl },
    resolution: '1080p',
    aspect_ratio: '9:16',
    expressiveness: 0.8,
    motion_prompt: 'energetic, authentic UGC style, direct eye contact, natural hand gestures',
  }

  if (audioUrl) {
    body.audio_url = audioUrl
  } else {
    body.script = script
    body.voice_id = voiceId
  }

  const res = await fetch(`${HEYGEN_API_BASE}/v3/videos`, {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || err.error?.message || `HeyGen image-to-video error ${res.status}: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  const videoId = data?.data?.video_id ?? data?.video_id
  if (!videoId) throw new Error(`HeyGen did not return a video ID. Response: ${JSON.stringify(data)}`)

  return { videoId }
}
