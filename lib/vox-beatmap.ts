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

  return `You are a Vox-style video producer. Generate a beat map for a 16:9 YouTube explainer video in the style of Vox Media.

TOPIC: "${topic}"
TONE: ${tone} — ${toneGuide}
TARGET DURATION: ${targetDuration} seconds total
BEAT COUNT: exactly ${beatCount} beats

Each beat lasts approximately ${avgBeatSec} seconds (can range 4–8s). Beats must sum to exactly ${targetDuration} seconds total.

For each beat write:
- narration: 15–25 words the narrator says aloud. Conversational but editorial. No filler. Each sentence punches.
- headline: 2–4 plain words (NO markdown, NO asterisks, NO bold formatting — just plain text)
- visual_description: ONE specific scene, 16:9 landscape. Prefix with format tag. NEVER describe multiple images or collages — single scene only.
    PHOTO: single editorial photo, one subject. Example: "PHOTO: extreme close-up of a racing driver's eyes in helmet visor reflection, dramatic side light"
    INFOGRAPHIC: one simple chart or one bold number — max 5 data points, minimal. Example: "INFOGRAPHIC: 3-bar chart comparing lap times, bold red bars on dark background, lots of white space"
    MAP: flat map of one region with solid color fills. Example: "MAP: flat map of Netherlands highlighted in orange, surrounding Europe in light grey"
    B-ROLL: wide cinematic establishing shot of a real place. Example: "B-ROLL: wide shot of an empty Formula 1 pit lane at dawn, low golden side lighting"
    Keep description under 20 words after the tag. No markdown bold. No asterisks.
- duration_sec: integer seconds this beat lasts (must sum to ${targetDuration})
- accent_color: a bold editorial color for this beat's chapter card

Accent color rules:
- Beat 1: strong opening color (deep navy #1a1a2e or crimson #d62828)
- Subsequent beats: rotate bold palette, no two adjacent beats same hue.
- Use: #1a1a2e, #e63946, #2ec4b6, #f77f00, #023e8a, #7b2d8b, #2d6a4f, #d62828, #c77dff, #e9c46a

CRITICAL: Output ONLY valid JSON. No markdown, no code fences, no explanation.

{
  "title": "short punchy video title",
  "beats": [
    {
      "id": "beat-1",
      "narration": "...",
      "headline": "...",
      "visual_description": "PHOTO: ...",
      "duration_sec": ${avgBeatSec},
      "accent_color": "#..."
    }
  ],
  "total_duration": ${targetDuration}
}

Output only the JSON object.`
}
