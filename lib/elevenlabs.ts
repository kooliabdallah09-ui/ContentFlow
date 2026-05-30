export const ELEVENLABS_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', accent: 'American Female', description: 'Calm, clear' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', accent: 'American Female', description: 'Strong, confident' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', accent: 'American Male', description: 'Deep, warm' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', accent: 'American Male', description: 'Conversational' },
]

export const DEFAULT_ELEVENLABS_VOICE_ID = ELEVENLABS_VOICES[0].id

// Returns raw MP3 buffer — upload to storage and pass URL to HeyGen
export async function generateSpeech(text: string, voiceId: string = DEFAULT_ELEVENLABS_VOICE_ID): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('ElevenLabs API key not configured')

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail?.message || `ElevenLabs error: ${res.statusText}`)
  }

  return Buffer.from(await res.arrayBuffer())
}

interface Voice {
  voice_id: string
  name: string
  category: string
}

interface VoiceResponse {
  voices: Voice[]
}

interface AudioResponse {
  audio_base64: string
}

interface GenerationResult {
  audioUrl: string
  duration: number
  characterCount: number
  timestamp: number
}

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1'
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM' // Rachel

export async function getAvailableVoices(): Promise<Voice[]> {
  const apiKey = process.env.ELEVENLABS_API_KEY

  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured')
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_BASE}/voices`, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.statusText}`)
    }

    const data = (await response.json()) as VoiceResponse
    return data.voices
  } catch (error) {
    console.error('Failed to get voices:', error)
    throw error
  }
}

export async function generateVoice(
  text: string,
  voiceId: string = DEFAULT_VOICE_ID,
  stability: number = 0.5,
  similarityBoost: number = 0.75
): Promise<GenerationResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY

  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured')
  }

  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty')
  }

  if (text.length > 5000) {
    throw new Error('Text exceeds maximum length of 5000 characters')
  }

  try {
    const response = await fetch(
      `${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.detail?.message ||
          `ElevenLabs API error: ${response.statusText}`
      )
    }

    const audioBlob = await response.blob()
    const buffer = await audioBlob.arrayBuffer()
    const base64Audio = Buffer.from(buffer).toString('base64')

    const dataUrl = `data:audio/mpeg;base64,${base64Audio}`

    return {
      audioUrl: dataUrl,
      duration: estimateDuration(text),
      characterCount: text.length,
      timestamp: Date.now(),
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to generate voice')
  }
}

function estimateDuration(text: string): number {
  const characterCount = text.length
  const wordsCount = text.split(/\s+/).length
  const estimatedSeconds = (characterCount / 4.7 / 160) * 60
  return Math.ceil(estimatedSeconds)
}

export const VOICE_PRESETS = {
  rachel: {
    id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel',
    description: 'Warm, engaging American female voice',
  },
  clyde: {
    id: 'cjVigB5qzO86Huf0OWl1',
    name: 'Clyde',
    description: 'Deep, authoritative male voice',
  },
  domi: {
    id: 'AZnzlk1XvdvUBZ4xNXUI',
    name: 'Domi',
    description: 'Strong Spanish accent female voice',
  },
  dave: {
    id: 'CwhRBWXzygEsXDAw7dVj',
    name: 'Dave',
    description: 'Casual, friendly male voice',
  },
  josh: {
    id: 'NM3f8KbDDMqs3UZLIu7G',
    name: 'Josh',
    description: 'Young, energetic male voice',
  },
}
