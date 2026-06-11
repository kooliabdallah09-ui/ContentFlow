const CREATOMATE_BASE = 'https://api.creatomate.com/v1'

export async function submitStitchJob({
  talkingHeadUrl,
  broll1Url,
}: {
  talkingHeadUrl: string
  broll1Url?: string
}): Promise<{ renderId: string }> {
  const apiKey = process.env.CREATOMATE_API_KEY
  if (!apiKey) throw new Error('Creatomate API key not configured')

  const elements: object[] = []

  if (broll1Url) {
    elements.push({
      type: 'video',
      source: broll1Url,
      track: 1,
      time: '0 s',
      duration: '5 s',
      fit: 'cover',
      animations: [
        { time: 'end', duration: '0.5 s', easing: 'linear', type: 'fade', fade: 'out' },
      ],
    })
    elements.push({
      type: 'video',
      source: talkingHeadUrl,
      track: 1,
      time: '4.5 s', // 0.5s overlap with B-roll fade-out
      fit: 'cover',
    })
  } else {
    elements.push({
      type: 'video',
      source: talkingHeadUrl,
      track: 1,
      time: '0 s',
      fit: 'cover',
    })
  }

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
