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
- headline: 2–4 bold words that appear as text overlay on screen (like a chapter title or key stat)
- visual_description: a specific scene description for a 16:9 LANDSCAPE frame. Choose ONE of these Vox visual formats:
    A) PHOTOJOURNALISM: real-world editorial photograph — people, places, events. Describe subject, framing (wide/medium/close), lighting mood, location.
    B) INFOGRAPHIC: flat-color data visualization — bar chart, timeline, map, stat card. Describe what data is shown and its visual layout.
    C) MAP: bold illustrated geographic map — specify region, what areas are highlighted, color coding.
    D) DOCUMENTARY B-ROLL: establishing shot of a location, institution, or object — specific and cinematic.
    ALWAYS specify the visual format type (PHOTO / INFOGRAPHIC / MAP / B-ROLL) at the start.
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
