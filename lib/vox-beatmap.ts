export interface VoxBeat {
  id: string
  narration: string          // what narrator says aloud (~15-25 words)
  headline: string           // bold 2-4 word text overlay for this beat
  visual_description: string // what the image/scene should show
  duration_sec: number       // how long this beat lasts (4-8s)
  accent_color: string       // hex e.g. "#1a73e8"
}

export interface VoxBeatMap {
  title: string
  beats: VoxBeat[]
  total_duration: number
}

export function buildBeatMapPrompt(topic: string, tone: string, targetDuration: number): string {
  const beatCount = targetDuration <= 30 ? 4 : targetDuration <= 45 ? 5 : 6
  const avgBeatSec = Math.round(targetDuration / beatCount)

  const toneGuide =
    tone === 'energetic'
      ? 'Punchy, fast-paced, high-energy. Short punchy narration lines. Bold saturated accent colors.'
      : tone === 'documentary'
      ? 'Measured, thoughtful, cinematic. Narration reads like a documentary voice-over. Deep, rich accent colors.'
      : 'Clear, informative, confident. Narration is direct and authoritative. Clean modern accent colors.'

  return `You are a Vox-style video producer. Generate a beat map for a short explainer video.

TOPIC: "${topic}"
TONE: ${tone} — ${toneGuide}
TARGET DURATION: ${targetDuration} seconds total
BEAT COUNT: exactly ${beatCount} beats

Each beat lasts approximately ${avgBeatSec} seconds (can range 4–8s). Beats must sum to exactly ${targetDuration} seconds total.

For each beat write:
- narration: 15–25 words the narrator says aloud. Conversational but editorial. No filler. Each sentence punches.
- headline: 2–4 bold words that appear as text overlay on screen (like a chapter title or key stat)
- visual_description: what the scene should visually show — be specific about composition, subject, mood
- duration_sec: integer seconds this beat lasts (must sum to ${targetDuration})
- accent_color: a vivid hex color that sets the editorial palette for this beat (use different colors per beat for visual variety)

Accent color rules:
- Beat 1: strong opening color (deep blue, rich red, or bold black)
- Subsequent beats: rotate through a bold editorial palette. No two adjacent beats same hue family.
- Use colors like: #1a1a2e, #e63946, #2ec4b6, #f77f00, #023e8a, #7b2d8b, #2d6a4f, #d62828

CRITICAL: Output ONLY valid JSON. No markdown, no code fences, no explanation. Output exactly this structure:

{
  "title": "short punchy video title",
  "beats": [
    {
      "id": "beat-1",
      "narration": "...",
      "headline": "...",
      "visual_description": "...",
      "duration_sec": ${avgBeatSec},
      "accent_color": "#..."
    }
  ],
  "total_duration": ${targetDuration}
}

Output only the JSON object.`
}
