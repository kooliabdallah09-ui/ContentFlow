// Analyze a short-form vertical video using Gemini 2.5 Flash. Gemini can read
// mp4 URLs directly via the fileData part — no frame sampling / Whisper hop.
// Fail-soft: returns null if the key is missing or Gemini rejects the URL.

export interface VideoAnalysis {
  platform: 'tiktok' | 'reels' | 'shorts'
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

const GEMINI_MODEL = 'gemini-2.5-flash'

// Gemini's fileData part accepts a URL. Must be reachable + not too long.
// We wrap it in an inline-URI request and parse the JSON reply.
export async function analyzeVideoWithGemini(input: {
  platform: 'tiktok' | 'reels' | 'shorts'
  sourceUrl: string
  videoUrl: string
  caption?: string
  hashtags?: string[]
}): Promise<VideoAnalysis | null> {
  const key = process.env.GOOGLE_GEMINI_API_KEY
  if (!key) return null

  const promptText = `You are analyzing a short-form vertical video (TikTok / Reels / YouTube Short).

Return ONLY valid JSON, no preamble, no markdown fences:
{
  "hook": "the first-sentence hook (verbatim if spoken, else describe the visual hook)",
  "format": "grwm" | "before_after" | "hot_take" | "unboxing" | "review" | "tutorial" | "pov" | "storytime" | "other",
  "pacing": "slow" | "medium" | "fast",
  "hookVisual": "one sentence — what happens in the first 1s visually",
  "cta": "what the video asks the viewer to do (e.g. 'try this', 'follow for more'). Empty string if none.",
  "characterOnCamera": true | false,
  "captionStyle": "caption" | "bold-white" | "tiktok" | "outline" | "highlight" | "bubble" | "minimal" | "none",
  "transcript": "rough transcript of what is said. Empty string if no speech.",
  "keyMoments": ["3-5 short phrases describing why this video works"]
}

${input.caption ? `The video's caption on ${input.platform} was: "${input.caption}"` : ''}
${input.hashtags?.length ? `Hashtags used: ${input.hashtags.join(' ')}` : ''}`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 90_000)
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            parts: [
              { fileData: { fileUri: input.videoUrl, mimeType: 'video/mp4' } },
              { text: promptText },
            ],
          }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
        }),
      },
    )
    clearTimeout(timeout)
    if (!res.ok) {
      console.warn(`[gemini-analyze] ${res.status}: ${(await res.text()).slice(0, 200)}`)
      return null
    }
    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!rawText) return null
    const cleaned = rawText.trim().replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '')
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
