// Whisper transcription via Replicate (openai/whisper) — word-level timestamps.
// Split into start/poll so no single server function waits more than ~5s.
const WHISPER_VERSION = '4d50797290df275329f202e48c76360b3f22b08d28c196cbc54600319435f8d2'

export interface WhisperWord {
  word: string
  start: number
  end: number
}

export interface WhisperResult {
  text: string
  words: WhisperWord[]
}

// Step 1: Submit the job. Returns immediately with a predictionId.
export async function startTranscription(audioUrl: string, languageCode?: string): Promise<string> {
  const apiToken = process.env.REPLICATE_API_TOKEN
  if (!apiToken) throw new Error('REPLICATE_API_TOKEN not configured')

  const input: Record<string, unknown> = {
    audio: audioUrl,
    word_timestamps: true,
    transcription: 'plain text',
  }
  if (languageCode) input.language = languageCode

  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ version: WHISPER_VERSION, input }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Failed to start transcription ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json()
  if (!data.id) throw new Error('Replicate did not return a prediction ID')
  return data.id
}

// Step 2: Poll once. Returns { done, result? } — caller retries until done.
export async function pollTranscription(predictionId: string): Promise<{ done: boolean; result?: WhisperResult; error?: string }> {
  const apiToken = process.env.REPLICATE_API_TOKEN
  if (!apiToken) throw new Error('REPLICATE_API_TOKEN not configured')

  const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  })
  const prediction = await res.json()

  if (prediction.status === 'failed' || prediction.status === 'canceled') {
    return { done: true, error: prediction.error ?? prediction.status }
  }
  if (prediction.status !== 'succeeded') {
    return { done: false }
  }

  return { done: true, result: parseWhisperOutput(prediction.output) }
}

function parseWhisperOutput(output: Record<string, unknown>): WhisperResult {
  const text = typeof output?.transcription === 'string' ? output.transcription : ''
  let words: WhisperWord[] = []

  if (Array.isArray(output?.word_segments) && (output.word_segments as unknown[]).length > 0) {
    words = (output.word_segments as Array<{ word: string; start: number; end: number }>).map(w => ({
      word: String(w.word).trim(),
      start: Number(w.start),
      end: Number(w.end),
    }))
  } else if (Array.isArray(output?.segments)) {
    const segs = output.segments as Array<{ words?: Array<{ word: string; start: number; end: number }>; text?: string; start?: number; end?: number }>
    const withWords = segs.filter(s => Array.isArray(s.words) && s.words!.length > 0)
    if (withWords.length > 0) {
      words = withWords.flatMap(s => s.words!.map(w => ({
        word: String(w.word).trim(), start: Number(w.start), end: Number(w.end),
      })))
    } else {
      // Distribute each segment's text evenly across its time window
      for (const seg of segs) {
        const segWords = String(seg.text ?? '').trim().split(/\s+/).filter(Boolean)
        const segStart = Number(seg.start ?? 0)
        const segEnd   = Number(seg.end ?? segStart + 2)
        if (!segWords.length) continue
        const dur = (segEnd - segStart) / segWords.length
        segWords.forEach((w, i) => {
          words.push({ word: w, start: segStart + i * dur, end: segStart + (i + 1) * dur })
        })
      }
    }
  }

  return { text, words }
}

// Chunk words into caption clips.
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
    chunks.push({ text, start: buffer[0].start + offsetSeconds, end: buffer[buffer.length - 1].end + offsetSeconds })
    buffer = []
  }

  for (const w of words) {
    buffer.push(w)
    if (w.word.match(/[.,!?]$/) || buffer.length >= maxWords) flush()
  }
  flush()

  return chunks
}
