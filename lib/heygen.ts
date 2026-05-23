interface VideoResponse {
  data: {
    video_id: string
    video_url: string
    status: string
  }
}

interface GenerationResult {
  videoUrl: string
  videoId: string
  duration: number
  timestamp: number
}

const HEYGEN_API_BASE = 'https://api.heygen.com/v1'

const AVATARS = [
  { id: 'avtr_1', name: 'Sarah', gender: 'female', accent: 'American' },
  { id: 'avtr_2', name: 'James', gender: 'male', accent: 'American' },
  { id: 'avtr_3', name: 'Sophia', gender: 'female', accent: 'British' },
  { id: 'avtr_4', name: 'Lucas', gender: 'male', accent: 'Australian' },
  { id: 'avtr_5', name: 'Maya', gender: 'female', accent: 'Indian' },
]

const VOICES = [
  { id: 'en-US-Neural2-A', name: 'Professional Female', accent: 'American' },
  { id: 'en-US-Neural2-C', name: 'Professional Male', accent: 'American' },
  { id: 'en-GB-Neural2-A', name: 'British Female', accent: 'British' },
  { id: 'en-GB-Neural2-B', name: 'British Male', accent: 'British' },
  { id: 'en-AU-Neural2-A', name: 'Australian Female', accent: 'Australian' },
]

export async function generateVideo(
  script: string,
  avatarId: string = 'avtr_1',
  voiceId: string = 'en-US-Neural2-A'
): Promise<GenerationResult> {
  const apiKey = process.env.HEYGEN_API_KEY

  if (!apiKey) {
    throw new Error('HeyGen API key not configured')
  }

  if (!script || script.trim().length === 0) {
    throw new Error('Script cannot be empty')
  }

  if (script.length > 3000) {
    throw new Error('Script exceeds maximum length of 3000 characters')
  }

  try {
    const response = await fetch(`${HEYGEN_API_BASE}/video/generate`, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        avatar_id: avatarId,
        script,
        voice_id: voiceId,
        background_id: 'bg_professional_1',
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.error?.message ||
          `HeyGen API error: ${response.statusText}`
      )
    }

    const data = (await response.json()) as VideoResponse

    return {
      videoUrl: data.data.video_url,
      videoId: data.data.video_id,
      duration: estimateDuration(script),
      timestamp: Date.now(),
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to generate video')
  }
}

export async function getVideoStatus(videoId: string): Promise<{
  status: string
  videoUrl?: string
}> {
  const apiKey = process.env.HEYGEN_API_KEY

  if (!apiKey) {
    throw new Error('HeyGen API key not configured')
  }

  try {
    const response = await fetch(
      `${HEYGEN_API_BASE}/video/${videoId}`,
      {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to get video status: ${response.statusText}`)
    }

    const data = await response.json()
    return {
      status: data.data.status,
      videoUrl: data.data.video_url,
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to get video status')
  }
}

function estimateDuration(script: string): number {
  const wordCount = script.split(/\s+/).length
  const estimatedSeconds = (wordCount / 150) * 60
  return Math.ceil(estimatedSeconds)
}

export const AVATAR_PRESETS = AVATARS
export const VOICE_PRESETS = VOICES
