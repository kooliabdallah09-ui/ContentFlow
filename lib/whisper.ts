// Whisper transcription via Replicate (openai/whisper) — word-level timestamps.
// Uses REPLICATE_API_TOKEN instead of OPENAI_API_KEY to avoid OpenAI quota limits.
// Pinned to a specific version hash because openai/whisper doesn't expose a "latest" deployment.
const WHISPER_VERSION = '4d50797290df275329f202e48c76360b3f22b08d28c196cbc54600319435f8d2'

export interface WhisperWord {
  word: string
  start: number  // seconds from clip start
  end: number    // seconds from clip start
}

export interface WhisperResult {
  text: string
  words: WhisperWord[]
}

export async function transcribeWithTimestamps(audioUrl: string, languageCode?: string): Promise<WhisperResult> {
  const apiToken = process.env.REPLICATE_API_TOKEN
  if (!apiToken) throw new Error('REPLICATE_API_TOKEN not configured')

  const input: Record<string, unknown> = {
    audio: audioUrl,
    word_timestamps: true,
    transcription: 'plain text',
  }
  if (languageCode) input.language = languageCode

  const createRes = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      Prefer: 'wait=60',
    },
    body: JSON.stringify({ version: WHISPER_VERSION, input }),
  })

  if (!createRes.ok) {
    const err = await createRes.text().catch(() => '')
    throw new Error(`Whisper transcription failed ${createRes.status}: ${err.slice(0, 300)}`)
  }

  let prediction = await createRes.json()

  // Poll until done (max ~90s)
  const deadline = Date.now() + 90_000
  while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled') {
    if (Date.now() > deadline) throw new Error('Whisper transcription timed out')
    await new Promise(r => setTimeout(r, 2000))
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
    prediction = await pollRes.json()
  }

  if (prediction.status !== 'succeeded') {
    throw new Error(`Whisper transcription failed: ${prediction.error ?? prediction.status}`)
  }

  const output = prediction.output
  console.log('[whisper] raw output keys:', output ? Object.keys(output) : 'null')
  console.log('[whisper] transcription:', String(output?.transcription ?? '').slice(0, 200))
  console.log('[whisper] segments count:', Array.isArray(output?.segments) ? output.segments.length : 'none')
  console.log('[whisper] word_segments count:', Array.isArray(output?.word_segments) ? output.word_segments.length : 'none')
  if (Array.isArray(output?.segments) && output.segments.length > 0) {
    console.log('[whisper] first segment:', JSON.stringify(output.segments[0]).slice(0, 300))
  }

  const text = typeof output?.transcription === 'string' ? output.transcription : ''

  let words: WhisperWord[] = []
  if (Array.isArray(output?.word_segments) && output.word_segments.length > 0) {
    words = output.word_segments.map((w: { word: string; start: number; end: number }) => ({
      word: String(w.word).trim(),
      start: Number(w.start),
      end: Number(w.end),
    }))
  } else if (Array.isArray(output?.segments)) {
    words = (output.segments as Array<{ words?: Array<{ word: string; start: number; end: number }> }>).flatMap(
      seg => Array.isArray(seg.words)
        ? seg.words.map(w => ({ word: String(w.word).trim(), start: Number(w.start), end: Number(w.end) }))
        : [],
    )
  }

  console.log('[whisper] final words count:', words.length)
  return { text, words }
}

// Chunk words into caption clips. Phrase-friendly grouping: stays under maxWords
// and breaks on natural punctuation. Each chunk gets its own start/end based on
// the actual Whisper timing — frame-accurate sync.
export function buildSyncedCaptionChunks(
  words: WhisperWord[],
  options: { maxWords?: number; offsetSeconds?: number } = {},
): Array<{ text: string; start: number; end: number }> {
  const { maxWords = 4, offsetSeconds = 0 } = options
  if (!words.length) return []

  const chunks: Array<{ text: string; start: number; end: number }> = []
  let buffer: WhisperWord[] = []

  const flush = () => {
    if (!buffer.length) return
    const text = buffer.map(w => w.word).join(' ').replace(/\s+([.,!?])/g, '$1').trim()
    chunks.push({
      text,
      start: buffer[0].start + offsetSeconds,
      end: buffer[buffer.length - 1].end + offsetSeconds,
    })
    buffer = []
  }

  for (const w of words) {
    buffer.push(w)
    const last = w.word.replace(/[^.,!?]/g, '')
    if (last || buffer.length >= maxWords) flush()
  }
  flush()

  return chunks
}
