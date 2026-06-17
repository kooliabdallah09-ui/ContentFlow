const CREATOMATE_BASE = 'https://api.creatomate.com/v1'

export async function submitStitchJob({
  talkingHeadUrl,
  broll1Url,
  broll2Url,
  audioOverlayUrl,
}: {
  talkingHeadUrl: string
  talkingHeadDuration?: number  // ignored — Creatomate uses relative timing via TALKING_HEAD_ID.end
  broll1Url?: string
  broll2Url?: string
  audioOverlayUrl?: string  // Hero tier: ElevenLabs voice overlay — mutes Sora's audio
  spokenScript?: string     // ignored — Creatomate auto-transcribes via transcript_source
  syncedCaptions?: Array<{ text: string; start: number; end: number }>  // ignored — Creatomate has its own transcription
  watermark?: boolean       // ignored — Creatomate path doesn't render the free-tier watermark
}): Promise<{ renderId: string }> {
  const apiKey = process.env.CREATOMATE_API_KEY
  if (!apiKey) throw new Error('Creatomate API key not configured')

  const elements: object[] = []
  const TALKING_HEAD_ID = 'talking_head'

  // 0–4s: B-roll 1 (product close-up) with quick fade-out, audio muted so talking-head VO leads
  // When ElevenLabs audio overlay is provided (Hero tier), mute the Sora talking-head's
  // native audio. The overlay track plays instead. Captions are still transcribed from the
  // talking head since the lip movements are animated to the script text.
  const talkingHeadVolume = audioOverlayUrl ? 0 : 100

  if (broll1Url) {
    elements.push({
      type: 'video', source: broll1Url, track: 1,
      time: '0 s', duration: '4 s', fit: 'cover', volume: 0,
      animations: [{ time: 'end', duration: '0.3 s', easing: 'linear', type: 'fade', fade: 'out' }],
    })
    elements.push({
      type: 'video', source: talkingHeadUrl, id: TALKING_HEAD_ID, track: 1,
      time: '3.7 s', fit: 'cover', volume: talkingHeadVolume,
    })
  } else {
    elements.push({
      type: 'video', source: talkingHeadUrl, id: TALKING_HEAD_ID, track: 1,
      time: '0 s', fit: 'cover', volume: talkingHeadVolume,
    })
  }

  // Hero tier: overlay ElevenLabs voice track aligned to the talking head start
  if (audioOverlayUrl) {
    elements.push({
      type: 'audio',
      source: audioOverlayUrl,
      track: 3,
      time: broll1Url ? '3.7 s' : '0 s',
      volume: 100,
    })
  }

  // Tail: B-roll 2 (usage shot) appended after the talking head — relative timing
  if (broll2Url) {
    elements.push({
      type: 'video', source: broll2Url, track: 1,
      time: `${TALKING_HEAD_ID}.end`, duration: '4 s', fit: 'cover', volume: 0,
      animations: [{ time: 'start', duration: '0.3 s', easing: 'linear', type: 'fade', fade: 'in' }],
    })
  }

  // TikTok-style word-by-word captions transcribed from the talking-head audio
  elements.push({
    type: 'text',
    track: 2,
    time: '0 s',
    duration: 'end',
    width: '88%',
    height: '20%',
    x_alignment: '50%',
    y_alignment: '78%',
    font_family: 'Inter',
    font_weight: '900',
    font_size: '8.2 vh',
    line_height: '110%',
    text_transform: 'uppercase',
    fill_color: '#FFFFFF',
    stroke_color: '#000000',
    stroke_width: '0.8 vh',
    transcript_source: TALKING_HEAD_ID,
    transcript_effect: 'highlight',
    transcript_color: '#FFD400',
    transcript_maximum_length: 22,
    transcript_placement: 'animate',
    shadow_color: 'rgba(0,0,0,0.55)',
    shadow_blur: '0.6 vh',
  })

  const res = await fetch(`${CREATOMATE_BASE}/renders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      output_format: 'mp4',
      width: 1080,
      height: 1920,
      frame_rate: 30,
      elements,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Creatomate error ${res.status}: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  // Creatomate returns an array of render objects
  const render = Array.isArray(data) ? data[0] : data
  const renderId = render?.id
  if (!renderId) throw new Error(`Creatomate did not return a render ID. Response: ${JSON.stringify(data)}`)

  return { renderId }
}

export async function getStitchStatus(renderId: string): Promise<{
  status: 'planned' | 'waiting' | 'transcribing' | 'rendering' | 'succeeded' | 'failed'
  url?: string
}> {
  const apiKey = process.env.CREATOMATE_API_KEY
  if (!apiKey) throw new Error('Creatomate API key not configured')

  const res = await fetch(`${CREATOMATE_BASE}/renders/${renderId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!res.ok) throw new Error(`Failed to get stitch status: ${res.statusText}`)

  const data = await res.json()
  return {
    status: data.status,
    url: data.url ?? undefined,
  }
}
