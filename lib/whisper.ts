// OpenAI Whisper API — word-level timestamps for caption sync.
// ~$0.006 per minute ($0.0001 per 10s video). Uses the existing OPENAI_API_KEY.
//
// Input: a public audio or video URL (we fetch + repost as multipart).
// Output: { text, words: [{ word, start, end }, ...] }.

export interface WhisperWord {
  word: string
  start: number  // seconds from clip start
  end: number    // seconds from clip start
}

export interface WhisperResult {
  text: string
  words: WhisperWord[]
}

const OPENAI_BASE = 'https://api.openai.com/v1'

export async function transcribeWithTimestamps(audioUrl: string, languageCode?: string): Promise<WhisperResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  // Fetch the audio/video bytes — Whisper accepts mp3/mp4/m4a/wav/webm etc.
  const audioRes = await fetch(audioUrl)
  if (!audioRes.ok) throw new Error(`Failed to fetch audio for transcription: ${audioRes.status}`)
  const buf = await audioRes.arrayBuffer()
  if (buf.byteLength > 24 * 1024 * 1024) {
    throw new Error(`Video file is too large (${Math.round(buf.byteLength / 1024 / 1024)} MB). Whisper's limit is 24 MB — try a shorter clip.`)
  }
  const mime = audioRes.headers.get('content-type') ?? 'audio/mpeg'
  const ext = mime.includes('mp4') || mime.includes('mpeg-4') ? 'mp4'
            : mime.includes('mp3') || mime.includes('mpeg') ? 'mp3'
            : mime.includes('wav') ? 'wav'
            : mime.includes('webm') ? 'webm'
            : 'mp3'

  const form = new FormData()
  form.append('file', new Blob([buf], { type: mime }), `clip.${ext}`)
  form.append('model', 'whisper-1')
  form.append('response_format', 'verbose_json')
  // Language hint dramatically improves transcription quality for non-English
  // audio. Whisper accepts ISO-639-1 codes (en, es, fr, de, ja, etc.).
  if (languageCode) form.append('language', languageCode)
  // 'word' granularity gives per-word start/end times — crucial for TikTok-style captions.
  form.append('timestamp_granularities[]', 'word')

  const res = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Whisper transcription failed ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json()
  const words: WhisperWord[] = Array.isArray(data.words)
    ? data.words.map((w: { word: string; start: number; end: number }) => ({
        word: String(w.word).trim(),
        start: Number(w.start),
        end: Number(w.end),
      }))
    : []

  return { text: String(data.text ?? ''), words }
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
    // Break on punctuation OR when we hit max words.
    if (last || buffer.length >= maxWords) flush()
  }
  flush()

  return chunks
}
