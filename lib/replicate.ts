const REPLICATE_BASE = 'https://api.replicate.com/v1'
const SORA_2_MODEL = 'openai/sora-2'

// Seedance 2.0 — ByteDance's multimodal video model with native audio, image
// reference, and intelligent duration control. Non-video-input path (i2v from
// our Nano Banana hero frame) at 720p is the sweet spot: $0.18/s, ~$0.90 for 5s.
// v2 dramatically improved character consistency + dialog + timed camera moves,
// which is what makes the Arcads-style POV UGC ads work.
const SEEDANCE_MODEL = 'bytedance/seedance-2.0'

// Video background removal — outputs the input clip with an alpha channel
// (transparent background) so we can composite the talking head over any
// scene. Used by the App Demo Composite renderer.
const VIDEO_BG_REMOVAL_MODEL = 'codeplugtech/background_removal_video'

export async function submitBackgroundRemovalJob(videoUrl: string): Promise<{ predictionId: string }> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  const res = await fetch(`${REPLICATE_BASE}/models/${VIDEO_BG_REMOVAL_MODEL}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'respond-async',
    },
    body: JSON.stringify({
      input: { video: videoUrl },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Background-removal error ${res.status}: ${JSON.stringify(err)}`)
  }
  const data = await res.json()
  const predictionId = data?.id
  if (!predictionId) throw new Error(`Background-removal: no prediction id. Response: ${JSON.stringify(data)}`)
  return { predictionId }
}

export async function getBackgroundRemovalStatus(predictionId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  error?: string
}> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  const res = await fetch(`${REPLICATE_BASE}/predictions/${predictionId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`BG-removal poll error: ${res.statusText}`)

  const data = await res.json()
  const status = data?.status as string | undefined
  if (status === 'succeeded') {
    const output = data?.output
    const videoUrl = Array.isArray(output) ? output[0] : typeof output === 'string' ? output : undefined
    return { status: 'completed', videoUrl }
  }
  if (status === 'failed' || status === 'canceled') {
    return { status: 'failed', error: data?.error ?? 'unknown' }
  }
  if (status === 'processing') return { status: 'processing' }
  return { status: 'pending' }
}

// Text-to-video (no reference image) — used for pure POV scenes.
// Image-to-video (image param) — used when we need product/UI consistency across the clip.
export async function submitSeedanceJob(params: {
  prompt: string
  durationSeconds: 5 | 10
  aspectRatio?: '9:16' | '16:9' | '1:1'
  startImageUrl?: string
}): Promise<{ predictionId: string }> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  const input: Record<string, unknown> = {
    prompt: params.prompt,
    duration: params.durationSeconds,
    aspect_ratio: params.aspectRatio ?? '9:16',
    resolution: '720p',
    camera_fixed: false,
    // ElevenLabs handles the voiceover — disable Seedance's native audio so we
    // don't get a lipsync mismatch (Seedance would generate its own dialog).
    enable_audio: false,
    generate_audio: false,
    // Keep the safety filter from flagging borderline framings — POV UGC
    // legitimately sits close to "bedroom / dim light" which the filter
    // interprets as suggestive. Force-clean the framing.
    negative_prompt: 'nudity, undressed, underwear, bare skin, suggestive pose, sexual content, minors, children, bedroom bed, undressing, intimate framing, blurry face, distorted hands, extra fingers, deformed face, text overlays, captions, watermarks, logos',
  }
  if (params.startImageUrl) input.image = params.startImageUrl

  const res = await fetch(`${REPLICATE_BASE}/models/${SEEDANCE_MODEL}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'respond-async',
    },
    body: JSON.stringify({ input }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Seedance (Replicate) error ${res.status}: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  const predictionId = data?.id
  if (!predictionId) throw new Error(`Seedance: no prediction id. Response: ${JSON.stringify(data)}`)
  return { predictionId }
}

export async function getSeedanceStatus(predictionId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  error?: string
}> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  const res = await fetch(`${REPLICATE_BASE}/predictions/${predictionId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`Seedance poll error: ${res.statusText}`)

  const data = await res.json()
  const status = data?.status as string | undefined

  if (status === 'succeeded') {
    const output = data?.output
    const videoUrl = Array.isArray(output) ? output[0] : typeof output === 'string' ? output : undefined
    return { status: 'completed', videoUrl }
  }
  if (status === 'failed' || status === 'canceled') {
    return { status: 'failed', error: data?.error ?? 'unknown' }
  }
  if (status === 'processing') return { status: 'processing' }
  return { status: 'pending' }
}

export async function submitSora2ViaReplicate(params: {
  prompt: string
  durationSeconds: 4 | 8 | 12
  aspectRatio?: '9:16' | '16:9' | '1:1'
  referenceImageUrl?: string
}): Promise<{ predictionId: string }> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  // Sora 2 only accepts "portrait" or "landscape" (not ratio strings)
  const soraAspect =
    params.aspectRatio === '16:9' ? 'landscape' : 'portrait'

  const input: Record<string, unknown> = {
    prompt: params.prompt,
    seconds: params.durationSeconds,
    aspect_ratio: soraAspect,
  }
  // input_reference must match the selected aspect ratio dimensions
  if (params.referenceImageUrl) input.input_reference = params.referenceImageUrl

  const res = await fetch(`${REPLICATE_BASE}/models/${SORA_2_MODEL}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'respond-async',
    },
    body: JSON.stringify({ input }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Sora 2 (Replicate) error ${res.status}: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  const predictionId = data?.id
  if (!predictionId) throw new Error(`Sora 2 (Replicate): no prediction id. Response: ${JSON.stringify(data)}`)
  return { predictionId }
}

export async function getSora2ReplicateStatus(predictionId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  error?: string
}> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  const res = await fetch(`${REPLICATE_BASE}/predictions/${predictionId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`Sora 2 poll error: ${res.statusText}`)

  const data = await res.json()
  const status = data?.status as string | undefined

  if (status === 'succeeded') {
    const output = data?.output
    const videoUrl = Array.isArray(output) ? output[0] : typeof output === 'string' ? output : undefined
    return { status: 'completed', videoUrl }
  }
  if (status === 'failed' || status === 'canceled') {
    return { status: 'failed', error: data?.error ?? 'unknown' }
  }
  if (status === 'processing') return { status: 'processing' }
  return { status: 'pending' }
}
// v3 is ElevenLabs' most expressive model — supports a `speed` parameter (0.7-1.2),
// 70+ languages, and inline audio tags like [excited] / [whispers]. Costs more
// than turbo-v2.5 but gives full speech-rate control.
const ELEVENLABS_TTS_MODEL = 'elevenlabs/v3'
// Kling 1.6 Standard: $0.25 per 5s clip. We tried 2.1 Master ($1.40/clip) thinking it
// was $0.42, but the real cost killed margin on the Standard tier ($4 cost vs $2 sell).
//
// Label fidelity isn't a concern with Kling anymore — Nano Banana 2 produces the high-
// fidelity start frame, and Kling i2v just animates it. The label is locked in the
// reference frame, Kling can't redesign it. So we save ~$2.30/video on B-rolls without
// hurting product accuracy. If motion quality is visibly weak later we can revisit
// 2.1 Standard (around $0.35/clip) as the middle ground.
const KLING_MODEL = 'kwaivgi/kling-v1.6-standard'

// Submit a Kling job. If startImageUrl is provided, runs image-to-video (motion seeded from
// the first frame) — used for character shots (Nano Banana action frame). Otherwise runs
// text-to-video — used for product / lifestyle shots.
export async function submitReplicateKlingJob(
  prompt: string,
  startImageUrl?: string,
): Promise<{ predictionId: string }> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  // Kling 1.6 Standard input schema. cfg_scale controls prompt adherence — 0.5 is
  // the sweet spot for product UGC: respects the prompt but lets the motion feel natural.
  const input: Record<string, unknown> = {
    prompt,
    duration: 5,
    aspect_ratio: '9:16',
    cfg_scale: 0.5,
    negative_prompt: 'text, watermark, blurry, low quality, ugly, distorted face, deformed hands',
  }
  if (startImageUrl) input.start_image = startImageUrl

  const res = await fetch(`${REPLICATE_BASE}/models/${KLING_MODEL}/predictions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Prefer: 'respond-async' },
    body: JSON.stringify({ input }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || err.title || `Replicate Kling error ${res.status}: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  const predictionId = data?.id
  if (!predictionId) throw new Error(`Replicate did not return a prediction id. Response: ${JSON.stringify(data)}`)

  return { predictionId }
}

// Submit an ElevenLabs TTS job via Replicate, poll to completion, and return
// the audio as a Buffer. Uses elevenlabs/turbo-v2.5 — high quality, 32 languages,
// low latency. Voice IDs are the same ElevenLabs IDs used by the direct API.
export async function generateElevenLabsViaReplicate(
  text: string,
  voiceId: string,
  options: { speed?: number } = {},
): Promise<Buffer> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  // v3 input. `speed` is clamped to ElevenLabs' allowed range (0.7-1.2);
  // 1.0 is natural pace.
  const speed = Math.min(1.2, Math.max(0.7, options.speed ?? 1.0))

  const res = await fetch(`${REPLICATE_BASE}/models/${ELEVENLABS_TTS_MODEL}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'respond-async',
    },
    body: JSON.stringify({
      input: {
        prompt: text,
        voice: voiceId,
        speed,
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0,
        use_speaker_boost: true,
        output_format: 'mp3_44100_128',
      },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Replicate ElevenLabs TTS error ${res.status}: ${JSON.stringify(err)}`)
  }

  const prediction = await res.json()
  const predictionId: string | undefined = prediction?.id
  if (!predictionId) throw new Error('Replicate ElevenLabs TTS: no prediction id returned')

  const TIMEOUT_MS = 90_000
  const POLL_MS = 2_000
  const deadline = Date.now() + TIMEOUT_MS

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_MS))
    const poll = await fetch(`${REPLICATE_BASE}/predictions/${predictionId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!poll.ok) throw new Error(`Replicate TTS poll error: ${poll.statusText}`)
    const data = await poll.json()

    if (data.status === 'succeeded') {
      const audioUrl: string | undefined = Array.isArray(data.output) ? data.output[0] : data.output
      if (!audioUrl) throw new Error('Replicate ElevenLabs TTS returned no audio URL')
      const audioRes = await fetch(audioUrl)
      if (!audioRes.ok) throw new Error(`Failed to fetch TTS audio from Replicate: ${audioRes.status}`)
      return Buffer.from(await audioRes.arrayBuffer())
    }
    if (data.status === 'failed' || data.status === 'canceled') {
      throw new Error(`Replicate ElevenLabs TTS prediction ${data.status}: ${data.error ?? 'unknown'}`)
    }
  }
  throw new Error('Replicate ElevenLabs TTS timed out after 90s')
}

// Whisper transcription via Replicate. Accepts a public audio/video URL,
// returns word-level timestamps.
//
// History of blowups: vaibhavs10/incredibly-fast-whisper went 404, then
// victor-upmeet/whisperx also 404 on the model endpoint (both community
// models that didn't have Replicate's /models/{owner}/{name}/predictions
// endpoint enabled).
//
// Now on openai/whisper — the officially maintained port, always accessible.
// We ask for word_timestamps and derive per-word entries from segments[].words.

export interface ReplicateWhisperWord {
  word: string
  start: number
  end: number
}

export async function transcribeWithReplicate(audioUrl: string): Promise<{
  text: string
  words: ReplicateWhisperWord[]
}> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  const res = await fetch(`${REPLICATE_BASE}/models/openai/whisper/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'respond-async',
    },
    body: JSON.stringify({
      input: {
        audio: audioUrl,
        model: 'large-v3',
        transcription: 'plain text',
        translate: false,
        temperature: 0,
        condition_on_previous_text: true,
        word_timestamps: true,
      },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Replicate Whisper error ${res.status}: ${JSON.stringify(err)}`)
  }

  const prediction = await res.json()
  const predictionId: string | undefined = prediction?.id
  if (!predictionId) throw new Error('Replicate Whisper: no prediction id')

  const TIMEOUT_MS = 240_000
  const POLL_MS = 3_000
  const deadline = Date.now() + TIMEOUT_MS

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_MS))
    const poll = await fetch(`${REPLICATE_BASE}/predictions/${predictionId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!poll.ok) throw new Error(`Replicate Whisper poll error: ${poll.statusText}`)
    const data = await poll.json()

    if (data.status === 'succeeded') {
      // openai/whisper output shape (with word_timestamps=true):
      // {
      //   transcription: "…",
      //   segments: [{
      //     start, end, text,
      //     words: [{ start, end, word, probability }]
      //   }],
      //   detected_language: "english"
      // }
      const output = data.output as {
        transcription?: string
        segments?: Array<{
          text?: string
          start?: number
          end?: number
          words?: Array<{ word?: string; start?: number; end?: number }>
        }>
      }
      const text = output?.transcription ?? (output?.segments ?? []).map(s => s.text ?? '').join(' ').trim()
      const words: ReplicateWhisperWord[] = []
      for (const seg of output?.segments ?? []) {
        for (const w of seg.words ?? []) {
          const word = String(w.word ?? '').trim()
          if (!word) continue
          words.push({
            word,
            start: Number(w.start ?? 0),
            end: Number(w.end ?? 0),
          })
        }
      }
      return { text, words }
    }
    if (data.status === 'failed' || data.status === 'canceled') {
      throw new Error(`Replicate Whisper ${data.status}: ${data.error ?? 'unknown'}`)
    }
  }
  throw new Error('Replicate Whisper timed out after 240s')
}

// Sync Labs lipsync-2 — remaps lips on `videoUrl` to match `audioUrl`.
// Used to lip-sync Sora's talking head to the ElevenLabs voice overlay on Hero.
// Returns the URL of the new (synced) video. Polls inline up to ~3 minutes.
const LIPSYNC_MODEL = 'sync/lipsync-2'

export async function runLipsync(videoUrl: string, audioUrl: string): Promise<string> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  const res = await fetch(`${REPLICATE_BASE}/models/${LIPSYNC_MODEL}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'respond-async',
    },
    body: JSON.stringify({
      input: { video: videoUrl, audio: audioUrl },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Replicate lipsync error ${res.status}: ${JSON.stringify(err)}`)
  }

  const prediction = await res.json()
  const predictionId: string | undefined = prediction?.id
  if (!predictionId) throw new Error('Replicate lipsync: no prediction id returned')

  const TIMEOUT_MS = 180_000
  const POLL_MS = 3_000
  const deadline = Date.now() + TIMEOUT_MS

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_MS))
    const poll = await fetch(`${REPLICATE_BASE}/predictions/${predictionId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!poll.ok) throw new Error(`Replicate lipsync poll error: ${poll.statusText}`)
    const data = await poll.json()

    if (data.status === 'succeeded') {
      const url: string | undefined = Array.isArray(data.output) ? data.output[0] : data.output
      if (!url) throw new Error('Replicate lipsync returned no video URL')
      return url
    }
    if (data.status === 'failed' || data.status === 'canceled') {
      throw new Error(`Replicate lipsync ${data.status}: ${data.error ?? 'unknown'}`)
    }
  }
  throw new Error('Replicate lipsync timed out after 180s')
}

// Kling v3 omni-video — the A-roll for UGC. Image-to-video with NATIVE AUDIO,
// so the talking head + voice come out of one call, perfectly lip-synced.
// Max duration per call is 15s; chained clips share the same start_image.
const KLING_V3_MODEL = 'kwaivgi/kling-v3-omni-video'

export interface KlingV3Job {
  predictionId: string
}

export async function submitKlingV3OmniJob(params: {
  prompt: string
  startImageUrl: string
  durationSeconds: 5 | 10 | 15
  aspectRatio: '9:16' | '1:1' | '16:9'
  mode?: 'standard' | 'pro'
  negativePrompt?: string
  generateAudio?: boolean       // defaults true (matches UGC package). POV sets false.
}): Promise<KlingV3Job> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  const res = await fetch(`${REPLICATE_BASE}/models/${KLING_V3_MODEL}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'respond-async',
    },
    body: JSON.stringify({
      input: {
        prompt: params.prompt,
        start_image: params.startImageUrl,
        duration: params.durationSeconds,
        aspect_ratio: params.aspectRatio,
        mode: params.mode ?? 'standard',
        generate_audio: params.generateAudio ?? true,
        negative_prompt: params.negativePrompt ?? 'text, watermark, blurry, low quality, distorted face, deformed hands, extra fingers',
      },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Kling v3 omni error ${res.status}: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  const predictionId = data?.id
  if (!predictionId) throw new Error(`Kling v3: no prediction id. Response: ${JSON.stringify(data)}`)
  return { predictionId }
}

export async function getKlingV3OmniStatus(predictionId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  error?: string
}> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  const res = await fetch(`${REPLICATE_BASE}/predictions/${predictionId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`Kling v3 poll error: ${res.statusText}`)

  const data = await res.json()
  const status = data?.status as string | undefined

  if (status === 'succeeded') {
    const output = data?.output
    const videoUrl = Array.isArray(output) ? output[0] : typeof output === 'string' ? output : undefined
    return { status: 'completed', videoUrl }
  }
  if (status === 'failed' || status === 'canceled') {
    return { status: 'failed', error: data?.error ?? 'unknown' }
  }
  if (status === 'processing') return { status: 'processing' }
  return { status: 'pending' }
}

export async function getReplicateKlingStatus(predictionId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
}> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not configured')

  const res = await fetch(`${REPLICATE_BASE}/predictions/${predictionId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!res.ok) throw new Error(`Replicate status error: ${res.statusText}`)

  const data = await res.json()
  const status = data?.status as string | undefined

  if (status === 'succeeded') {
    const output = data?.output
    const videoUrl = Array.isArray(output) ? output[0] : typeof output === 'string' ? output : undefined
    return { status: 'completed', videoUrl }
  }
  if (status === 'failed' || status === 'canceled') return { status: 'failed' }
  if (status === 'processing') return { status: 'processing' }
  return { status: 'pending' }
}
