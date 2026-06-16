// Unified TTS dispatcher.
// Voice IDs prefixed 'openai:' route to OpenAI TTS (works on free OpenAI tier, ~$0.001/video).
// Anything else is treated as an ElevenLabs voice_id (requires a paid ElevenLabs plan).
//
// On Hero, if the user picked an ElevenLabs voice and ElevenLabs rejects it (free-plan
// library voice block, voice-not-found, quota exceeded), we automatically retry with
// OpenAI's 'nova' voice as a safety net so the generation doesn't fail.

import { generateSpeech as generateElevenLabsSpeech } from './elevenlabs'

const OPENAI_PREFIX = 'openai:'

export const OPENAI_VOICES = [
  { id: 'openai:nova',    label: 'Nova — Bright & energetic (F)' },
  { id: 'openai:shimmer', label: 'Shimmer — Warm & friendly (F)' },
  { id: 'openai:onyx',    label: 'Onyx — Deep & authoritative (M)' },
  { id: 'openai:echo',    label: 'Echo — Smooth conversational (M)' },
  { id: 'openai:alloy',   label: 'Alloy — Neutral & versatile' },
  { id: 'openai:fable',   label: 'Fable — British accent' },
] as const

const DEFAULT_OPENAI_VOICE = 'nova'

async function generateOpenAISpeech(text: string, voice: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'tts-1-hd',  // higher quality than tts-1, still cheap (~$0.03/1k chars)
      input: text,
      voice,
      response_format: 'mp3',
      speed: 1.0,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI TTS error ${res.status}: ${err.slice(0, 300)}`)
  }

  return Buffer.from(await res.arrayBuffer())
}

// Primary entry point. Picks the right provider from the voiceId prefix and
// transparently falls back to OpenAI TTS if ElevenLabs is unavailable.
export async function generateSpeech(text: string, voiceId: string): Promise<Buffer> {
  if (voiceId.startsWith(OPENAI_PREFIX)) {
    return generateOpenAISpeech(text, voiceId.slice(OPENAI_PREFIX.length))
  }

  // ElevenLabs voice — try it, fall back to OpenAI on any failure
  try {
    return await generateElevenLabsSpeech(text, voiceId)
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown'
    console.warn(`[tts] ElevenLabs failed (${reason}) — falling back to OpenAI TTS '${DEFAULT_OPENAI_VOICE}'`)
    return generateOpenAISpeech(text, DEFAULT_OPENAI_VOICE)
  }
}
