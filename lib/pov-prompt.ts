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

  const prompt = `You are writing a Kling v3 video prompt in the "Arcads / Claude-ad" cinematic style. Kling animates the still frame — the reference image already has the character, product/UI, and setting locked in. Your job is to describe the MOTION and the SPOKEN DIALOG.

REFERENCE EXAMPLE (for style calibration only — do NOT copy content):
"1:03 UGC POV — first-person view from a phone held in her own hand, angled down at her lap. She is on her bed, dark room lit only by the MacBook glow spilling onto her duvet. Laptop dominates the frame, Vans website visible on screen. Off-screen voice, casual, low volume: 'okay Vans just dropped their summer collection and I am obsessed.' 'obsessed' — she tilts the phone up briefly, half her face enters frame smiling, then tilts back down to the laptop. 'summer collection' — smooth zoom into the laptop screen, product grid fills the frame, eases back out. She scrolls the trackpad, screen slides down, women's tops appear in a clean grid. 'they actually sent me this early' — quick zoom into a yellow tank top on the screen. Phone held in her own hand, slight micro-shake, warm laptop glow lighting, slightly grainy amateur phone-shot feel."

RULES:
- Start with a timestamp tag matching the mood ("23:47", "1:14", "14:43").
- Then "UGC POV — " and the scene setup in one clean sentence.
- Camera is HELD IN THE CREATOR'S HAND, filming their own lap / product / laptop. Face is NOT the primary subject — the screen or product is. Face is cropped, partial, or only revealed briefly when they tilt the phone up.
- Describe the setting and lighting (nighttime + laptop glow, warm lamp, morning couch, etc.).
- Insert the character's dialog EXACTLY as written by the user, using single quotes: 'the exact line goes here'. If the user's line contains profanity or NSFW words, rewrite the line to remove those words while keeping the same casual meaning.
- Pick 2-3 keywords from that dialog. For each, add a beat: "'[keyword]' — [specific camera move]" (zoom into screen, phone tilts up to face briefly then back down, quick rack focus, hand enters frame with product, etc.).
- Include one "phone tilts up to briefly show her face saying [phrase], then back down" beat — the SIGNATURE Arcads move.
- Include one "she interacts with X" beat (scrolls trackpad, clicks CTA, holds product up to camera, etc.).
- End with: "POV handheld phone camera held in her own hand, slight micro-shake, [nighttime warm laptop glow / afternoon window light / etc.], slightly grainy, authentic amateur phone-shot UGC feel. No captions, no overlays, no on-screen text except the app UI already present."
- Character description goes inline.
- Total length: 100–180 words. No line breaks — one flowing paragraph.

DO NOT:
- Use profanity, swear words, or crude language.
- Describe undressed / underwear / suggestive framing. The creator is fully clothed in casual everyday outfit (hoodie, sweater, t-shirt, PJs top).
- Describe minors, teens, or children — the creator is a mid-20s to mid-30s adult.
- Turn this into a talking-head interview — the phone camera is HELD BY the creator, filming down. Face is secondary.
- Use bullet points, narrator commentary, or on-screen text captions.
- Invent screen content beyond what the user provided.
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

  // True POV: the phone camera is HELD BY the creator filming their own scene.
  // The lens points down at their own lap / product / laptop. We see hands,
  // maybe a slice of their body, but their face is NOT the subject — it's the
  // product / UI that dominates the frame. This is the Arcads "camera in hand"
  // aesthetic, not a talking-head portrait.
  const sceneLine = input.format.needsUiScreenshot
    ? `POV scene: the phone camera is held in the creator's own hand, pointing down at their own lap. In frame from top to bottom: the creator's chin and collarbone at the very top (face partially cropped, we see them from below the eyes down at most), then their arms and lap, and the MacBook resting on their lap taking up 60-70% of the frame. The laptop screen dominates the composition and clearly shows the ${input.productName} interface (${input.productDescription}) — the screen content stays crisp and legible, no garbled text, no fake app UI. The setting: a dark ${input.format.name.toLowerCase().includes('night') || input.format.name.toLowerCase().includes('cozy') || input.format.name.toLowerCase().includes('evening') ? 'nighttime bedroom or living room lit only by the warm glow of the laptop screen and a soft ambient lamp in the far background' : 'warm indoor space with soft window light'}. One hand rests on the trackpad. Framing: phone held at chest height, angled down at 45°.`
    : input.format.needsProductImage
      ? `POV scene: the phone camera is held in the creator's own hand, pointing at the ${input.productName} (${input.productDescription}) — product fills the center of frame, packaging and label preserved exactly. We see the creator's hand holding / using the product, and their lap or a surface below. Face cropped or fully out of frame. Setting: warm indoor space, natural light or lamp glow.`
      : `POV scene: the phone camera is held in the creator's own hand, angled slightly to catch a partial view of their surroundings — living room / bedroom / desk. Face partially cropped or absent — we see chest and hands.`

  return `Using the attached reference image as the exact character (preserve face, hair, skin tone, outfit, jewelry — this is who the hands and partial body belong to), generate a POV still frame for a UGC ad of ${character}. ${sceneLine} This is a first-person phone-camera POV — the character is FILMING, not being filmed. Handheld phone camera aesthetic (slight micro-shake, casual off-center framing), slightly grainy, authentic amateur phone-shot UGC feel — not cinematic, not studio-lit. No captions, no overlays, no on-screen text except the app UI already present. ${input.extraDirection ?? ''}`.trim()
}
