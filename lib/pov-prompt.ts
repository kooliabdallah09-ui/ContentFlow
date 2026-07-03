import Anthropic from '@anthropic-ai/sdk'
import type { PovFormat } from './pov-formats'

// Composes a Seedance 2.0 cinematic prompt in the Arcads/Claude-ad style:
// - Timestamp + UGC POV tag opening
// - Explicit scene setup (setting, lighting, character position, product/screen)
// - Character speaks dialog IN THE PROMPT with the exact user-provided script
// - Camera moves tied to specific spoken keywords ("[keyword]" → zoom / cut / focus)
// - Handheld phone-camera aesthetic notes
// - Ends with negative direction (no captions, no overlays)
//
// Seedance 2.0 respects this format very well — the model reads the "[keyword]"
// beats as timed camera cues.

export interface BuildPovPromptInput {
  format: PovFormat
  productName: string
  productDescription: string
  benefit: string
  script: string                       // the user's voiceover / on-camera line
  characterDescription: string         // "a young Southeast Asian woman, 20s, athletic..."
  extraDirection?: string
}

export async function buildPovSeedancePrompt(input: BuildPovPromptInput): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const scriptClean = input.script.trim()
  const character = input.characterDescription.trim() || 'a young adult, natural skin, casual outfit'

  const meta = `Format: ${input.format.name} — ${input.format.tagline}
Duration: ${input.format.durationSeconds} seconds
Aspect: ${input.format.aspectRatio}
Needs UI on screen: ${input.format.needsUiScreenshot ? 'YES — laptop or phone screen is the focal point' : 'no'}
Needs product visible: ${input.format.needsProductImage ? 'YES — product held or in frame' : 'no'}`

  const prompt = `You are writing a Seedance 2.0 video prompt in the "Arcads / Claude-ad" cinematic style.

REFERENCE EXAMPLE (for style calibration only — do NOT copy content, do NOT copy the profanity):
"14:43 UGC POV — young woman on her couch during a bright afternoon, laptop open, Vans website visible. She speaks casually to camera: 'okay Vans just dropped their summer collection and I am obsessed.' 'obsessed' — smooth zoom into laptop screen, product grid fills the frame, eases back. She scrolls the trackpad, screen slides down, women's tops appear in clean grid. 'they actually sent me this early' — quick zoom into screen, yellow tank top fills the frame."

RULES:
- Start with a timestamp tag like "14:43" or "10:12" that matches the format's mood (morning, afternoon, evening — avoid 'late-night bedroom' framing).
- Then "UGC POV — " and the scene setup in one clean sentence.
- Describe: the character position, the setting/lighting, and what product / UI is visible.
- Insert the character's dialog EXACTLY as written by the user, using single quotes: 'the exact line goes here'. If the user's line contains profanity or NSFW words, rewrite the line to remove those words while keeping the same casual meaning.
- Pick 2-3 keywords or short phrases from that dialog. For each, add a beat in the format:
  "'[keyword]' — [specific camera move that lands on that word]" (smooth zoom, slow push-in, rack focus to screen, etc.)
- Include one "she interacts with X" beat (scrolls trackpad, clicks CTA, holds product up, etc.).
- End with camera aesthetic notes: "POV handheld phone camera, natural daylight or warm indoor lighting, slightly grainy, authentic UGC feel. No captions, no overlays, no on-screen text except the app UI already present."
- Character description goes inline: describe him/her in one clause.
- Total length: 90–160 words. No line breaks — one flowing paragraph.

DO NOT (STRICT — the model has a content filter that will reject the video if you break these):
- Use profanity, swear words, or crude language of any kind — clean, casual copy only.
- Say "bedroom", "bed", "in bed", "on the bed", "late night", "1am", "midnight", "dim", "dark room". Never. Substitute with living room, couch, afternoon, evening, warm indoor lighting.
- Describe undressed scenes, underwear, intimate framing, or anyone touching skin suggestively.
- Describe minors, teens, or children — the creator is always an adult in their mid-20s to mid-30s.
- Use bullet points.
- Add narrator commentary.
- Invent screen content beyond what user provided.
- Add on-screen text captions.
- Wrap in markdown.

INPUT:
${meta}
Character: ${character}
Product / app: ${input.productName}
Description: ${input.productDescription}
Key benefit to sell: ${input.benefit}
User dialog (embed verbatim in single quotes): "${scriptClean}"
${input.extraDirection ? `Extra direction: ${input.extraDirection}` : ''}

Return ONLY the final Seedance prompt paragraph. No preamble, no explanation.`

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 900,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (msg.content[0] as { type: 'text'; text: string }).text.trim()
  // Strip any accidental code fences.
  return text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim()
}

// Prompt for the Nano Banana 2 hero-frame composite — mirrors the Arcads
// two-image pattern: "using the character from image 1 and setting from image 2".
export function buildHeroFramePrompt(input: BuildPovPromptInput): string {
  const character = input.characterDescription.trim() || 'a young adult'
  const scene = input.format.tagline.toLowerCase()

  const sceneLine = input.format.needsUiScreenshot
    ? `Scene: the creator is sitting comfortably on a couch in a bright living room during the afternoon, holding a MacBook on their lap tilted slightly toward the camera. The laptop screen fills a good portion of the lower half of the frame and clearly shows the ${input.productName} interface (${input.productDescription}) — the screen content stays crisp and legible, no garbled text. The creator's upper body and face are fully visible above the laptop, looking naturally toward the phone camera with a soft casual smile, one hand resting on the trackpad. Framing: medium shot from just above the laptop, phone-camera height.`
    : input.format.needsProductImage
      ? `Scene: the creator is casually holding or using the ${input.productName} (${input.productDescription}) — product visible, clearly recognizable, packaging and label preserved. Bright living room or kitchen during the afternoon. The creator is fully in frame, looking naturally toward the phone camera.`
      : `Scene: the creator sits comfortably in a bright afternoon living room, looking naturally toward the phone camera with a soft casual smile.`

  return `Using the attached reference image as the exact character (preserve face, hair, skin tone, outfit, jewelry, all identity details), generate a still frame for a POV UGC video of ${character} — an adult fully clothed in casual everyday outfit. ${sceneLine} POV handheld phone camera aesthetic (slight micro-shake, casual framing), natural daylight through a window or warm indoor lamps, slightly grainy, authentic phone-shot UGC feel — not cinematic, not studio-lit. No captions, no overlays, no on-screen text except the app UI already present. Public-safe living space, morning or afternoon time-of-day. ${input.extraDirection ?? ''}`.trim()
}
