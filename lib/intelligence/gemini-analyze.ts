// Analyze a short-form vertical video using Gemini 2.5 Flash — routed
// through Replicate so we keep one dependency (REPLICATE_API_TOKEN) instead
// of a separate Google API key.
//
// The Replicate wrapper accepts a URL directly for image/video/audio input.
// Gemini 2.5 Flash handles video natively so we just point at the mp4.
// Fail-soft: returns null on any error so onboarding is never blocked.

const REPLICATE_BASE = 'https://api.replicate.com/v1'
const GEMINI_MODEL = 'google/gemini-2.5-flash'

export interface VideoAnalysis {
  platform: 'tiktok' | 'reels'
  sourceUrl: string
  videoUrl?: string
  hook: string                  // first-sentence hook
  format: string                // grwm / before_after / hot_take / unboxing / review / tutorial / pov / storytime / other
  pacing: 'slow' | 'medium' | 'fast'
  hookVisual: string            // one-line description of what happens in the first 1s visually
  cta: string                   // what the video asks the viewer to do
  characterOnCamera: boolean
  captionStyle: 'caption' | 'bold-white' | 'tiktok' | 'outline' | 'highlight' | 'bubble' | 'minimal' | 'none'
  transcript: string            // rough transcript (Gemini extracts speech)
  keyMoments: string[]          // 3-5 phrases describing what makes it work
}

const ANALYSIS_PROMPT = `You are analyzing a short-form vertical video (TikTok / Reels).

Return ONLY valid JSON, no preamble, no markdown fences:
{
  "hook": "the first-sentence hook (verbatim if spoken, else describe the visual hook)",
  "format": "grwm" | "before_after" | "hot_take" | "unboxing" | "review" | "tutorial" | "pov" | "storytime" | "other",
  "pacing": "slow" | "medium" | "fast",
  "hookVisual": "one sentence — what happens in the first 1s visually",
  "cta": "what the video asks the viewer to do. Empty string if none.",
  "characterOnCamera": true | false,
  "captionStyle": "caption" | "bold-white" | "tiktok" | "outline" | "highlight" | "bubble" | "minimal" | "none",
  "transcript": "rough transcript of what is said. Empty string if no speech.",
  "keyMoments": ["3-5 short phrases describing why this video works"]
}`

export async function analyzeVideoWithGemini(input: {
  platform: 'tiktok' | 'reels'
  sourceUrl: string
  videoUrl: string
  caption?: string
  hashtags?: string[]
}): Promise<VideoAnalysis | null> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) return null

  const contextLines: string[] = []
  if (input.caption) contextLines.push(`The video's caption on ${input.platform} was: "${input.caption}"`)
  if (input.hashtags?.length) contextLines.push(`Hashtags: ${input.hashtags.join(' ')}`)
  const prompt = contextLines.length
    ? `${ANALYSIS_PROMPT}\n\n${contextLines.join('\n')}`
    : ANALYSIS_PROMPT

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120_000)
    const res = await fetch(`${REPLICATE_BASE}/models/${GEMINI_MODEL}/predictions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      signal: controller.signal,
      body: JSON.stringify({
        input: {
          prompt,
          // Replicate's Gemini wrapper accepts a media URL for multimodal
          // input. mp4 videos are handled natively.
          media: [input.videoUrl],
        },
      }),
    })
    clearTimeout(timeout)

    if (!res.ok) {
      console.warn(`[gemini-analyze] ${res.status}: ${(await res.text()).slice(0, 200)}`)
      return null
    }
    const data = await res.json() as {
      status?: string
      output?: string | string[]
      error?: string
    }
    if (data.status === 'failed' || data.error) {
      console.warn('[gemini-analyze] failed:', data.error)
      return null
    }
    const raw = Array.isArray(data.output) ? data.output.join('') : String(data.output ?? '')
    const cleaned = raw.trim().replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(cleaned) as Partial<VideoAnalysis>

    return {
      platform: input.platform,
      sourceUrl: input.sourceUrl,
      videoUrl: input.videoUrl,
      hook: String(parsed.hook ?? '').slice(0, 300),
      format: String(parsed.format ?? 'other').slice(0, 30),
      pacing: (['slow', 'medium', 'fast'].includes(parsed.pacing as string) ? parsed.pacing : 'medium') as 'slow' | 'medium' | 'fast',
      hookVisual: String(parsed.hookVisual ?? '').slice(0, 300),
      cta: String(parsed.cta ?? '').slice(0, 200),
      characterOnCamera: Boolean(parsed.characterOnCamera),
      captionStyle: (parsed.captionStyle ?? 'caption') as VideoAnalysis['captionStyle'],
      transcript: String(parsed.transcript ?? '').slice(0, 2000),
      keyMoments: Array.isArray(parsed.keyMoments) ? parsed.keyMoments.map(String).slice(0, 6) : [],
    }
  } catch (err) {
    console.warn('[gemini-analyze] failed:', err instanceof Error ? err.message : err)
    return null
  }
}
