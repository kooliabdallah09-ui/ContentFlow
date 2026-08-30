// ElevenLabs Scribe — speech-to-text with word-level timestamps.
// Replaces the old Replicate/Whisper flow. Scribe is synchronous (2-30s
// depending on audio length) so callers don't need a submit + poll dance.
//
// API: POST https://api.elevenlabs.io/v1/speech-to-text
//   multipart form-data
//   fields: file, model_id, language_code?, diarize?
//   headers: xi-api-key
//
// Docs: https://elevenlabs.io/docs/api-reference/speech-to-text

const SCRIBE_ENDPOINT = 'https://api.elevenlabs.io/v1/speech-to-text'
const SCRIBE_MODEL = 'scribe_v1'

export interface TranscriptWord {
  word: string
  start: number
  end: number
}

export interface TranscriptResult {
  text: string
  words: TranscriptWord[]
  languageCode?: string
}

// Fetch an audio/video URL and run it through Scribe. One round-trip;
// returns when the transcription is complete.
export async function transcribeAudioUrl(
  audioUrl: string,
  opts: { languageCode?: string } = {},
): Promise<TranscriptResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not configured')

  // Pull the file down so we can hand it to Scribe as multipart form-data.
  // Scribe also accepts a `cloud_storage_url` field on paid plans, but the
  // fetch-then-upload path works everywhere.
  const src = await fetch(audioUrl)
  if (!src.ok) throw new Error(`Failed to fetch audio for transcription (${src.status})`)
  const buf = await src.arrayBuffer()
  const contentType = src.headers.get('content-type') || 'audio/mpeg'
  const filename = audioUrl.split('/').pop()?.split('?')[0] || 'audio.mp3'

  const form = new FormData()
  form.append('file', new Blob([buf], { type: contentType }), filename)
  form.append('model_id', SCRIBE_MODEL)
  if (opts.languageCode) form.append('language_code', opts.languageCode)

  const res = await fetch(SCRIBE_ENDPOINT, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Scribe error ${res.status}: ${err.slice(0, 400)}`)
  }

  const data = await res.json() as {
    language_code?: string
    text?: string
    words?: Array<{ text: string; start: number; end: number; type: 'word' | 'spacing' | 'audio_event' }>
  }

  // Filter to real words — Scribe returns "spacing" and "audio_event"
  // entries interleaved that we don't want as caption timing anchors.
  const words: TranscriptWord[] = (data.words ?? [])
    .filter(w => w.type === 'word' && typeof w.text === 'string' && w.text.trim().length > 0)
    .map(w => ({ word: w.text.trim(), start: Number(w.start), end: Number(w.end) }))

  return {
    text: data.text ?? words.map(w => w.word).join(' '),
    words,
    languageCode: data.language_code,
  }
}

// Chunk words into caption clips. Identical contract to the old
// buildSyncedCaptionChunks from lib/whisper.ts — moved here so lib/whisper.ts
// can be deleted.
export function buildSyncedCaptionChunks(
  words: TranscriptWord[],
  options: { maxWords?: number; offsetSeconds?: number } = {},
): Array<{ text: string; start: number; end: number }> {
  const { maxWords = 4, offsetSeconds = 0 } = options
  if (!words.length) return []

  const chunks: Array<{ text: string; start: number; end: number }> = []
  let buffer: TranscriptWord[] = []

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
    if (w.word.match(/[.,!?]$/) || buffer.length >= maxWords) flush()
  }
  flush()

  return chunks
}
