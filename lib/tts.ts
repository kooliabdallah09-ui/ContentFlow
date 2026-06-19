// Unified TTS dispatcher.
// Voice IDs prefixed 'openai:' route to OpenAI TTS (works on free OpenAI tier, ~$0.001/video).
// Anything else is treated as an ElevenLabs voice_id. ElevenLabs is called via Replicate
// (elevenlabs/turbo-v2.5) when REPLICATE_API_TOKEN is set — same voice IDs, no separate
// ElevenLabs API key needed. Falls back to the direct ElevenLabs API if ELEVENLABS_API_KEY
// is set instead. If both fail, falls back to OpenAI 'nova' so the generation never hard-fails.

import { generateSpeech as generateElevenLabsSpeech } from './elevenlabs'
import { generateElevenLabsViaReplicate } from './replicate'

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

// Primary entry point. Picks the right provider from the voiceId prefix.
// `speed` (0.7-1.2) is honored by ElevenLabs v3 via Replicate; OpenAI TTS
// accepts a similar range via its own `speed` field.
export async function generateSpeech(
  text: string,
  voiceId: string,
  options: { speed?: number } = {},
): Promise<Buffer> {
  if (voiceId.startsWith(OPENAI_PREFIX)) {
    return generateOpenAISpeech(text, voiceId.slice(OPENAI_PREFIX.length))
  }

  // ElevenLabs voice — prefer Replicate (no separate key needed), fall back to
  // direct ElevenLabs API if configured. Do NOT silently fall back to OpenAI
  // here: if the user picked Adam and we'd return Nova, the audio would be
  // wrong but the UI would still say "Adam". Surfacing the error is better.
  if (process.env.REPLICATE_API_TOKEN) {
    return await generateElevenLabsViaReplicate(text, voiceId, options)
  }

  if (process.env.ELEVENLABS_API_KEY) {
    return await generateElevenLabsSpeech(text, voiceId)
  }

  throw new Error('ElevenLabs unavailable: set REPLICATE_API_TOKEN or ELEVENLABS_API_KEY')
}
