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

const HEYGEN_API_BASE = 'https://api.heygen.com'

// HeyGen v2 voice IDs (from their voice library)
const VOICES = [
  { id: '1bd001e7e50f421d891986aad5158bc8', name: 'Professional Female', accent: 'American' },
  { id: '2d5b0e6cf36f460aa7fc47e3eee4ba54', name: 'Professional Male', accent: 'American' },
  { id: 'e749e866b30d47e4858cac12a6d13f2f', name: 'British Female', accent: 'British' },
  { id: '1588bf4c1db74e1dbba1c7b2e9f54b14', name: 'British Male', accent: 'British' },
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
    const response = await fetch(`${HEYGEN_API_BASE}/v2/video/generate`, {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_inputs: [
          {
            character: {
              type: 'avatar',
              avatar_id: avatarId,
              avatar_style: 'normal',
            },
            voice: {
              type: 'text',
              input_text: script,
              voice_id: voiceId,
            },
          },
        ],
        dimension: { width: 1280, height: 720 },
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
      videoUrl: data.data.video_url ?? '',
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
      `${HEYGEN_API_BASE}/v1/video_status.get?video_id=${videoId}`,
      {
        method: 'GET',
        headers: {
          'X-Api-Key': apiKey,
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

export const VOICE_PRESETS = VOICES
